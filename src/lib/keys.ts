// Composite key utilities for unique session identification across servers

/**
 * Create a composite key from server ID and session ID
 * Format: "serverId:sessionId"
 * @param serverId - Server identifier
 * @param sessionId - Session identifier
 * @returns Composite key string
 */
export function makeKey(serverId: string, sessionId: string): string {
  return `${serverId}:${sessionId}`;
}

/**
 * Parse a composite key into its components
 * @param key - Composite key in format "serverId:sessionId"
 * @returns Object with serverId and sessionId
 */
export function parseKey(key: string): { serverId: string; sessionId: string } {
  const idx = key.indexOf(":");
  if (idx === -1) return { serverId: "unknown", sessionId: key };
  return {
    serverId: key.slice(0, idx),
    sessionId: key.slice(idx + 1),
  };
}

/**
 * Extract session ID from a composite key
 * @param key - Composite key in format "serverId:sessionId"
 * @returns Session ID portion
 */
export function getSessionId(key: string): string {
  return parseKey(key).sessionId;
}
