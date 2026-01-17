// Session filtering and tree building logic

import type { Session } from "../types";
import { buildChildrenMap } from "./tree";

/**
 * Find the "current" active session from a list.
 * Priority: busy/waiting > root with recent activity > most recent
 * @param sessions - Array of sessions to search
 * @returns The current session, or undefined if no sessions exist
 */
export function findCurrentSession(sessions: Session[]): Session | undefined {
  if (sessions.length === 0) return undefined;

  // First, look for any actively running session
  const activeSession = sessions.find(
    (s) => s.status === "busy" || s.status === "waiting_for_permission",
  );
  if (activeSession) return activeSession;

  // Find root sessions (no parent) and pick the one with most recent activity
  const rootSessions = sessions.filter((s) => !s.parentId);
  if (rootSessions.length > 0) {
    return rootSessions.reduce((latest, s) =>
      s.lastActivity > latest.lastActivity ? s : latest,
    );
  }

  // Fallback: session with most recent activity
  return sessions.reduce((latest, s) =>
    s.lastActivity > latest.lastActivity ? s : latest,
  );
}

/**
 * Build a session tree starting from the current session.
 * Includes: current session + its parent (if any) + all children (recursive) + siblings.
 * @param currentSession - The session to build tree around
 * @param allSessions - All available sessions
 * @returns Array of sessions in the tree
 */
export function buildSessionTree(
  currentSession: Session,
  allSessions: Session[],
): Session[] {
  // Map by originalId for parent lookups (parentId uses originalId)
  const sessionByOriginal = new Map(allSessions.map((s) => [s.originalId, s]));
  const childrenMap = buildChildrenMap(allSessions);
  const result = new Set<Session>();

  // Add current session
  result.add(currentSession);

  // Add parent if exists (parentId is originalId)
  if (currentSession.parentId) {
    const parent = sessionByOriginal.get(currentSession.parentId);
    if (parent) {
      result.add(parent);
    }
  }

  // Add all descendants (children, grandchildren, etc.)
  const addDescendants = (session: Session) => {
    const children = childrenMap.get(session.originalId) || [];
    for (const child of children) {
      if (!result.has(child)) {
        result.add(child);
        addDescendants(child);
      }
    }
  };

  addDescendants(currentSession);

  // Also include siblings (other children of the same parent)
  if (currentSession.parentId) {
    const siblings = childrenMap.get(currentSession.parentId) || [];
    for (const sibling of siblings) {
      if (!result.has(sibling)) {
        result.add(sibling);
        addDescendants(sibling);
      }
    }
  }

  return Array.from(result);
}

/**
 * Filter sessions to only include the current session tree.
 * @param sessions - All sessions to filter
 * @returns Current session + parent + children + siblings
 */
export function filterToCurrentSessionTree(sessions: Session[]): Session[] {
  if (sessions.length === 0) return [];

  const currentSession = findCurrentSession(sessions);
  if (!currentSession) return [];

  return buildSessionTree(currentSession, sessions);
}
