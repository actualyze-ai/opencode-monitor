// Shared test fixtures for session monitor tests

import type { Session, Server, SessionNode } from "../../types";

/**
 * Create a mock session with sensible defaults
 */
export function createSession(overrides: Partial<Session> = {}): Session {
  const id = overrides.id || "server1:session1";
  const originalId = overrides.originalId || "session1";
  const serverId = overrides.serverId || "server1";

  return {
    id,
    originalId,
    serverId,
    name: "Test Session",
    status: "idle",
    createdAt: Date.now() - 60000,
    lastActivity: Date.now(),
    ...overrides,
  };
}

/**
 * Create a mock server with sensible defaults
 */
export function createServer(overrides: Partial<Server> = {}): Server {
  return {
    id: "server1",
    name: "Test Server",
    url: "http://localhost:4096",
    lastSeen: Date.now(),
    ...overrides,
  };
}

/**
 * Create a session tree for testing hierarchical operations
 * Returns: root -> child1, child2 -> grandchild
 */
export function createSessionTree(): Session[] {
  const now = Date.now();
  const root = createSession({
    id: "server1:root",
    originalId: "root",
    name: "Root Session",
    createdAt: now - 300000,
    lastActivity: now - 100,
  });

  const child1 = createSession({
    id: "server1:child1",
    originalId: "child1",
    name: "Child 1",
    parentId: "root",
    createdAt: now - 200000,
    lastActivity: now - 200,
  });

  const child2 = createSession({
    id: "server1:child2",
    originalId: "child2",
    name: "Child 2",
    parentId: "root",
    createdAt: now - 100000,
    lastActivity: now - 300,
  });

  const grandchild = createSession({
    id: "server1:grandchild",
    originalId: "grandchild",
    name: "Grandchild",
    parentId: "child1",
    createdAt: now - 50000,
    lastActivity: now - 400,
  });

  return [root, child1, child2, grandchild];
}

/**
 * Create a flat list of unrelated sessions
 */
export function createFlatSessions(count: number): Session[] {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) =>
    createSession({
      id: `server1:session${i}`,
      originalId: `session${i}`,
      name: `Session ${i}`,
      createdAt: now - i * 10000,
      lastActivity: now - i * 1000,
    }),
  );
}

/**
 * Create sessions with various statuses for testing filtering
 */
export function createSessionsWithStatuses(): Session[] {
  const now = Date.now();
  return [
    createSession({
      id: "server1:idle",
      originalId: "idle",
      name: "Idle Session",
      status: "idle",
      lastActivity: now - 1000,
    }),
    createSession({
      id: "server1:busy",
      originalId: "busy",
      name: "Busy Session",
      status: "busy",
      lastActivity: now - 2000,
    }),
    createSession({
      id: "server1:waiting",
      originalId: "waiting",
      name: "Waiting Session",
      status: "waiting_for_permission",
      lastActivity: now - 3000,
    }),
    createSession({
      id: "server1:completed",
      originalId: "completed",
      name: "Completed Session",
      status: "completed",
      lastActivity: now - 4000,
    }),
    createSession({
      id: "server1:error",
      originalId: "error",
      name: "Error Session",
      status: "error",
      lastActivity: now - 5000,
    }),
  ];
}

/**
 * Create a session node for tree display testing
 */
export function createSessionNode(
  session: Session,
  depth: number = 0,
  isLastChild: boolean = true,
  treePrefix: string = "",
): SessionNode {
  return {
    session,
    depth,
    isLastChild,
    treePrefix,
  };
}
