/**
 * Session manipulation utilities
 */

import type { Session } from "../types";

/**
 * Remove all sessions belonging to a specific server
 * @param sessions - Current sessions Map
 * @param serverId - Server ID to remove sessions for
 * @returns New Map with sessions removed
 */
export function removeSessionsByServer(
  sessions: Map<string, Session>,
  serverId: string,
): Map<string, Session> {
  const next = new Map(sessions);
  for (const [key, session] of next) {
    if (session.serverId === serverId) {
      next.delete(key);
    }
  }
  return next;
}
