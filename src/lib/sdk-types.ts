// SDK response types and type guards for OpenCode API responses

/**
 * SDK session response from session.list() or session.get()
 */
export interface SDKSession {
  id: string;
  title?: string;
  tokens?: number;
  projectID?: string;
  branch?: string;
  directory?: string;
  parentID?: string;
  time?: {
    created?: number;
    updated?: number;
  };
}

/**
 * SDK message info block (nested in message)
 */
export interface SDKMessageInfo {
  role?: string;
  cost?: number;
  providerID?: string;
  modelID?: string;
  tokens?: SDKTokens;
}

/**
 * SDK token breakdown
 */
export interface SDKTokens {
  input?: number;
  output?: number;
  reasoning?: number;
  cache?: {
    read?: number;
    write?: number;
  };
}

/**
 * SDK message response from session.messages()
 */
export interface SDKMessage {
  role?: string;
  cost?: number;
  providerID?: string;
  modelID?: string;
  tokens?: SDKTokens;
  info?: SDKMessageInfo;
}

/**
 * SDK provider model info
 */
export interface SDKModel {
  id?: string;
  name?: string;
  limit?: {
    context?: number;
    output?: number;
  };
}

/**
 * SDK provider response from provider.list()
 */
export interface SDKProvider {
  id: string;
  name?: string;
  models?: Record<string, SDKModel>;
}

/**
 * SDK status response from session.status()
 */
export interface SDKStatus {
  type: string;
}

// Type guards

/**
 * Check if value is a valid SDK session
 */
export function isSDKSession(value: unknown): value is SDKSession {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.id === "string";
}

/**
 * Check if value is a valid SDK message
 */
export function isSDKMessage(value: unknown): value is SDKMessage {
  if (typeof value !== "object" || value === null) return false;
  // Messages are loosely typed - just check it's an object
  return true;
}

/**
 * Check if value is a valid SDK provider
 */
export function isSDKProvider(value: unknown): value is SDKProvider {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.id === "string";
}

/**
 * Safely extract providers from SDK response (handles array or {all: []} format)
 */
export function extractProviders(result: unknown): SDKProvider[] {
  if (Array.isArray(result)) {
    return result.filter(isSDKProvider);
  }
  if (typeof result === "object" && result !== null) {
    const obj = result as Record<string, unknown>;
    if (Array.isArray(obj.all)) {
      return obj.all.filter(isSDKProvider);
    }
  }
  return [];
}

/**
 * Safely extract sessions from SDK response
 */
export function extractSessions(result: unknown): SDKSession[] {
  if (!Array.isArray(result)) return [];
  return result.filter(isSDKSession);
}

/**
 * Safely extract messages from SDK response
 */
export function extractMessages(result: unknown): SDKMessage[] {
  if (!Array.isArray(result)) return [];
  return result.filter(isSDKMessage);
}

/**
 * Safely extract status map from SDK response
 */
export function extractStatusMap(
  result: unknown,
): Record<string, SDKStatus | undefined> {
  if (typeof result !== "object" || result === null) return {};
  return result as Record<string, SDKStatus | undefined>;
}

/**
 * Get role from message (handles both direct and info.role)
 */
export function getMessageRole(msg: SDKMessage): string | undefined {
  return msg.role ?? msg.info?.role;
}

/**
 * Get cost from message (handles both direct and info.cost)
 */
export function getMessageCost(msg: SDKMessage): number | undefined {
  return msg.cost ?? msg.info?.cost;
}

/**
 * Get tokens from message (handles both direct and info.tokens)
 */
export function getMessageTokens(msg: SDKMessage): SDKTokens | undefined {
  return msg.tokens ?? msg.info?.tokens;
}

/**
 * Get provider ID from message (handles both direct and info.providerID)
 */
export function getMessageProviderID(msg: SDKMessage): string | undefined {
  return msg.providerID ?? msg.info?.providerID;
}

/**
 * Get model ID from message (handles both direct and info.modelID)
 */
export function getMessageModelID(msg: SDKMessage): string | undefined {
  return msg.modelID ?? msg.info?.modelID;
}
