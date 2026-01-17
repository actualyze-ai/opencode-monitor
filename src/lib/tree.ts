// Session tree building logic

import type { Session, SessionNode } from "../types";

/**
 * Build a parent-to-children map from parentId relationships.
 * Note: parentId is the ORIGINAL session ID, not the composite ID.
 * So we key by originalId for lookups to work correctly.
 * @param sessions - Array of sessions to build map from
 * @returns Map of originalId -> child sessions
 */
export function buildChildrenMap(sessions: Session[]): Map<string, Session[]> {
  const childrenMap = new Map<string, Session[]>();

  for (const session of sessions) {
    if (session.parentId) {
      // parentId references parent's originalId
      const children = childrenMap.get(session.parentId) || [];
      children.push(session);
      childrenMap.set(session.parentId, children);
    }
  }

  return childrenMap;
}

/**
 * Build hierarchical session nodes from a flat session list.
 * Returns sessions organized with depth and tree prefix for display.
 */
export function buildSessionNodes(sessions: Session[]): SessionNode[] {
  if (sessions.length === 0) return [];

  // Map by originalId for parent lookups (parentId uses originalId)
  const sessionByOriginal = new Map<string, Session>();
  for (const session of sessions) {
    sessionByOriginal.set(session.originalId, session);
  }

  const childrenMap = buildChildrenMap(sessions);

  // Find root(s) - sessions with no parent or whose parent isn't in the list
  const roots = sessions.filter(
    (s) => !s.parentId || !sessionByOriginal.has(s.parentId),
  );

  // Build nodes recursively
  const nodes: SessionNode[] = [];

  /**
   * Add a node and its children to the flat list.
   * @param session - The session to add
   * @param depth - Current depth in tree (0 = root)
   * @param prefixStack - Stack of prefix segments for ancestors
   * @param isLast - Whether this is the last child of its parent
   */
  function addNode(
    session: Session,
    depth: number,
    prefixStack: string[],
    isLast: boolean,
  ) {
    // Build tree prefix from ancestor stack + current connector
    let treePrefix = "";
    if (depth > 0) {
      // Add ancestor prefixes
      treePrefix = prefixStack.join("");
      // Add connector for this node
      treePrefix += isLast ? "└── " : "├── ";
    }

    nodes.push({
      session,
      depth,
      isLastChild: isLast,
      treePrefix,
    });

    // Get children (keyed by originalId)
    const children = childrenMap.get(session.originalId) || [];
    // Sort children by creation time for consistent ordering
    children.sort((a, b) => a.createdAt - b.createdAt);

    // Build new prefix stack for children
    const childPrefixStack = [...prefixStack];
    if (depth > 0) {
      // Add continuation line or space based on whether parent was last
      childPrefixStack.push(isLast ? "    " : "│   ");
    }

    children.forEach((child, index) => {
      const isLastChild = index === children.length - 1;
      addNode(child, depth + 1, childPrefixStack, isLastChild);
    });
  }

  // Sort roots by last activity (most recent first)
  roots.sort((a, b) => b.lastActivity - a.lastActivity);

  // Add all roots (each is "last" in its own context at depth 0)
  roots.forEach((root, index) => {
    const isLastRoot = index === roots.length - 1;
    addNode(root, 0, [], isLastRoot);
  });

  return nodes;
}

/**
 * Calculate child counts for all sessions.
 * Returns a Map keyed by "serverId:parentId" with count of children.
 * @param sessions - Sessions as Map or array
 * @returns Map of parent key to child count
 */
export function calculateChildCounts(
  sessions: Map<string, Session> | Session[],
): Map<string, number> {
  const childCounts = new Map<string, number>();
  const sessionArray =
    sessions instanceof Map ? Array.from(sessions.values()) : sessions;

  for (const session of sessionArray) {
    if (!session.parentId) continue;
    const key = `${session.serverId}:${session.parentId}`;
    childCounts.set(key, (childCounts.get(key) ?? 0) + 1);
  }
  return childCounts;
}
