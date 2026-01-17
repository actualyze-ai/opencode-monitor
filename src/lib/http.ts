// SDK client for OpenCode - WebSocket-based implementation
import { debug } from "./debug";
import { extractErrorMessage } from "./errors";
import { mapStatusType } from "./status";
import type { Session, TokenBreakdown } from "../types";
import { makeKey } from "./keys";
import type { WSClient } from "./ws-sdk";
import {
  type SDKMessage,
  type SDKProvider,
  type SDKSession,
  extractProviders,
  extractSessions,
  extractMessages,
  extractStatusMap,
  getMessageRole,
  getMessageCost,
  getMessageTokens,
  getMessageProviderID,
  getMessageModelID,
} from "./sdk-types";

interface ProviderCacheEntry {
  providers: SDKProvider[];
  timestamp: number;
}

const PROVIDER_CACHE_TTL_MS = 5 * 60 * 1000;
const providerCache = new Map<string, ProviderCacheEntry>();

/**
 * Get cached provider list or fetch fresh data
 */
async function getCachedProviders(
  client: WSClient,
  serverId: string,
): Promise<SDKProvider[]> {
  const cached = providerCache.get(serverId);
  const now = Date.now();

  if (cached && now - cached.timestamp < PROVIDER_CACHE_TTL_MS) {
    return cached.providers;
  }

  try {
    const providerResult = await client.provider.list();
    const providers = extractProviders(providerResult);

    providerCache.set(serverId, { providers, timestamp: now });
    debug(`[WS] Provider cache refreshed for ${serverId}`);
    return providers;
  } catch {
    // Return cached data even if expired, or empty array
    return cached?.providers || [];
  }
}

/**
 * Clear provider cache for a server (call on disconnect)
 */
export function clearProviderCache(serverId: string): void {
  providerCache.delete(serverId);
}

/**
 * Fetch sessions via WebSocket RPC
 * @param client - WebSocket client for the server
 * @param serverId - Server identifier
 * @returns Array of sessions from the server
 */
export async function fetchSessionsWS(
  client: WSClient,
  serverId: string,
): Promise<Session[]> {
  try {
    // Fetch session list and statuses in parallel
    const [listResult, statusResult] = await Promise.all([
      client.session.list(),
      client.session.status(),
    ]);

    const sessions = extractSessions(listResult);
    const statuses = extractStatusMap(statusResult);

    return sessions.map((session) => {
      const sessionId = session.id;
      const status = statuses[sessionId];
      const statusType = status?.type ?? "idle";
      const sessionStatus = mapStatusType(statusType);

      const result: Session = {
        id: makeKey(serverId, sessionId),
        originalId: sessionId,
        serverId,
        name: session.title || `Session ${sessionId.slice(0, 8)}`,
        status: sessionStatus,
        statusUpdatedAt: Date.now(),
        createdAt: session.time?.created || Date.now(),
        lastActivity: session.time?.updated || Date.now(),
      };

      if (session.tokens !== undefined) result.tokens = session.tokens;
      if (session.projectID) result.project = session.projectID;
      if (session.directory) result.directory = session.directory;
      if (session.parentID) result.parentId = session.parentID;

      return result;
    });
  } catch (err: unknown) {
    debug(`[WS] Error fetching sessions: ${extractErrorMessage(err)}`);
    return [];
  }
}

// --- Helper functions for message processing ---

/**
 * Find the last assistant message with token data
 */
function findLastAssistantWithTokens(
  messages: SDKMessage[],
): SDKMessage | undefined {
  return [...messages].reverse().find((msg) => {
    const role = getMessageRole(msg);
    const tokens = getMessageTokens(msg);
    return role === "assistant" && tokens?.output;
  });
}

/**
 * Extract token breakdown from a message
 */
function extractTokenBreakdown(msg: SDKMessage): TokenBreakdown | undefined {
  const tokens = getMessageTokens(msg);
  if (!tokens) return undefined;

  return {
    input: tokens.input ?? 0,
    output: tokens.output ?? 0,
    reasoning: tokens.reasoning ?? 0,
    cacheRead: tokens.cache?.read ?? 0,
    cacheWrite: tokens.cache?.write ?? 0,
  };
}

/**
 * Calculate context used from token breakdown
 */
function calculateContextUsed(breakdown: TokenBreakdown): number {
  return (
    breakdown.input +
    breakdown.output +
    breakdown.reasoning +
    breakdown.cacheRead +
    breakdown.cacheWrite
  );
}

/**
 * Find context limit from provider/model info
 */
function findContextLimit(
  providers: SDKProvider[],
  providerID: string,
  modelID: string,
): number | undefined {
  const provider = providers.find((p) => p.id === providerID);
  const modelInfo = provider?.models?.[modelID];
  return modelInfo?.limit?.context;
}

/**
 * Calculate total cost from all assistant messages
 */
function calculateTotalCost(messages: SDKMessage[]): number | undefined {
  const total = messages
    .filter((msg) => {
      const role = getMessageRole(msg);
      const cost = getMessageCost(msg);
      return role === "assistant" && typeof cost === "number";
    })
    .reduce((sum, msg) => sum + (getMessageCost(msg) ?? 0), 0);

  return total > 0 ? total : undefined;
}

/**
 * Count user and assistant messages
 */
function countMessages(messages: SDKMessage[]): number {
  return messages.filter((msg) => {
    const role = getMessageRole(msg);
    return role === "user" || role === "assistant";
  }).length;
}

// --- Main fetch function ---

/**
 * Fetch detailed session data via WebSocket RPC
 * @param client - WebSocket client for the server
 * @param serverId - Server identifier
 * @param sessionId - Session ID to fetch details for
 * @returns Session with full details or null on error
 */
export async function fetchSessionDetailsWS(
  client: WSClient,
  serverId: string,
  sessionId: string,
): Promise<Session | null> {
  try {
    // Fetch session details, messages (full), and status in parallel
    // Provider list is cached separately to reduce API calls
    const [sessionResult, messagesResult, statusResult, providers] =
      await Promise.all([
        client.session.get({ path: { id: sessionId } }),
        client.session
          .messages({ path: { id: sessionId } })
          .catch((err: Error) => {
            debug(`[WS] messages() failed: ${err.message}`);
            return [];
          }),
        client.session.status().catch(() => ({})),
        getCachedProviders(client, serverId),
      ]);

    // Extract status for this session
    const statuses = extractStatusMap(statusResult);
    const statusType = statuses[sessionId]?.type ?? "idle";
    const sessionStatus = mapStatusType(statusType);

    // Parse session and messages with type safety
    const s = sessionResult as SDKSession | null;
    if (!s?.id) {
      debug(`[WS] Invalid session result for ${sessionId}`);
      return null;
    }

    const messages = extractMessages(messagesResult);

    // Extract token and model info from last assistant message
    const lastAssistant = findLastAssistantWithTokens(messages);
    const tokenBreakdown = lastAssistant
      ? extractTokenBreakdown(lastAssistant)
      : undefined;
    const contextUsed = tokenBreakdown
      ? calculateContextUsed(tokenBreakdown)
      : undefined;

    // Extract model info
    let model: { provider: string; model: string } | undefined;
    let contextLimit: number | undefined;

    if (lastAssistant) {
      const providerID = getMessageProviderID(lastAssistant);
      const modelID = getMessageModelID(lastAssistant);

      if (providerID && modelID) {
        model = { provider: providerID, model: modelID };
        contextLimit = findContextLimit(providers, providerID, modelID);
      }
    }

    // Calculate cost and message count
    const cost = calculateTotalCost(messages);
    const messageCount = countMessages(messages);

    // Build result
    const result: Session = {
      id: makeKey(serverId, s.id),
      originalId: s.id,
      serverId,
      name: s.title || `Session ${s.id.slice(0, 8)}`,
      status: sessionStatus,
      statusUpdatedAt: Date.now(),
      createdAt: s.time?.created || Date.now(),
      lastActivity: s.time?.updated || Date.now(),
    };

    // Add optional fields
    if (s.tokens !== undefined) result.tokens = s.tokens;
    if (contextUsed !== undefined) result.contextUsed = contextUsed;
    if (contextLimit !== undefined) result.contextLimit = contextLimit;
    if (tokenBreakdown) result.tokenBreakdown = tokenBreakdown;
    if (cost !== undefined) result.cost = cost;
    if (messageCount > 0) result.messageCount = messageCount;
    if (model) result.model = model;
    if (s.projectID) result.project = s.projectID;
    if (s.branch) result.branch = s.branch;
    if (s.directory) result.directory = s.directory;
    if (s.parentID) result.parentId = s.parentID;

    return result;
  } catch (err: unknown) {
    debug(`[WS] fetchSessionDetailsWS error: ${extractErrorMessage(err)}`);
    return null;
  }
}
