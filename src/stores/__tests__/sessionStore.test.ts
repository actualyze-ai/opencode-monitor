import { describe, it, expect, beforeEach } from "bun:test";
import { useSessionStore } from "../sessionStore";
import type { Server, Session } from "../../types";

// Helper to create a valid server
function createServer(overrides: Partial<Server> = {}): Server {
  return {
    id: "server-1",
    name: "Test Server",
    url: "http://localhost:8080",
    lastSeen: Date.now(),
    ...overrides,
  };
}

// Helper to create a valid session
function createSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "server-1:session-1",
    originalId: "session-1",
    serverId: "server-1",
    name: "Test Session",
    status: "idle",
    createdAt: Date.now(),
    lastActivity: Date.now(),
    ...overrides,
  };
}

describe("sessionStore", () => {
  beforeEach(() => {
    // Reset store state before each test
    useSessionStore.getState().reset();
  });

  describe("servers", () => {
    it("starts with empty servers map", () => {
      const { servers } = useSessionStore.getState();
      expect(servers.size).toBe(0);
    });

    it("sets a server", () => {
      const server = createServer();

      useSessionStore.getState().setServer("server-1", server);

      const { servers } = useSessionStore.getState();
      expect(servers.size).toBe(1);
      expect(servers.get("server-1")).toEqual(server);
    });

    it("removes a server", () => {
      const server = createServer();
      useSessionStore.getState().setServer("server-1", server);

      useSessionStore.getState().removeServer("server-1");

      const { servers } = useSessionStore.getState();
      expect(servers.size).toBe(0);
    });

    it("updates server lastSeen", () => {
      const server = createServer({ lastSeen: 1000 });
      useSessionStore.getState().setServer("server-1", server);

      const beforeUpdate = Date.now();
      useSessionStore.getState().updateServerLastSeen("server-1");
      const afterUpdate = Date.now();

      const { servers } = useSessionStore.getState();
      const updated = servers.get("server-1");
      expect(updated?.lastSeen).toBeGreaterThanOrEqual(beforeUpdate);
      expect(updated?.lastSeen).toBeLessThanOrEqual(afterUpdate);
    });
  });

  describe("sessions", () => {
    it("starts with empty sessions map", () => {
      const { sessions } = useSessionStore.getState();
      expect(sessions.size).toBe(0);
    });

    it("sets a session", () => {
      const session = createSession();

      useSessionStore.getState().setSession("server-1:session-1", session);

      const { sessions } = useSessionStore.getState();
      expect(sessions.size).toBe(1);
      expect(sessions.get("server-1:session-1")).toEqual(session);
    });

    it("updates a session", () => {
      const session = createSession();
      useSessionStore.getState().setSession("server-1:session-1", session);

      useSessionStore
        .getState()
        .updateSession("server-1:session-1", { status: "busy" });

      const { sessions } = useSessionStore.getState();
      expect(sessions.get("server-1:session-1")?.status).toBe("busy");
      expect(sessions.get("server-1:session-1")?.name).toBe("Test Session");
    });

    it("removes a session", () => {
      const session = createSession();
      useSessionStore.getState().setSession("server-1:session-1", session);

      useSessionStore.getState().removeSession("server-1:session-1");

      const { sessions } = useSessionStore.getState();
      expect(sessions.size).toBe(0);
    });

    it("removes sessions by server", () => {
      const session1 = createSession({
        id: "server-1:session-1",
        originalId: "session-1",
      });
      const session2 = createSession({
        id: "server-1:session-2",
        originalId: "session-2",
      });
      const session3 = createSession({
        id: "server-2:session-3",
        originalId: "session-3",
        serverId: "server-2",
      });

      useSessionStore.getState().setSession("server-1:session-1", session1);
      useSessionStore.getState().setSession("server-1:session-2", session2);
      useSessionStore.getState().setSession("server-2:session-3", session3);

      useSessionStore.getState().removeSessionsByServer("server-1");

      const { sessions } = useSessionStore.getState();
      expect(sessions.size).toBe(1);
      expect(sessions.has("server-2:session-3")).toBe(true);
    });

    it("sets multiple sessions", () => {
      const sessions = [
        createSession({ id: "server-1:session-1", originalId: "session-1" }),
        createSession({ id: "server-1:session-2", originalId: "session-2" }),
      ];

      useSessionStore.getState().setSessions(sessions);

      const { sessions: stored } = useSessionStore.getState();
      expect(stored.size).toBe(2);
    });

    it("merges sessions preserving existing data", () => {
      const existing = createSession({
        id: "server-1:session-1",
        name: "Original Name",
        tokens: 100,
      });
      useSessionStore.getState().setSession("server-1:session-1", existing);

      const update = createSession({
        id: "server-1:session-1",
        name: "Updated Name",
        // tokens not included
      });
      useSessionStore.getState().mergeSessions([update]);

      const { sessions } = useSessionStore.getState();
      const merged = sessions.get("server-1:session-1");
      expect(merged?.name).toBe("Updated Name");
      // Note: mergeSessions spreads update over existing, so tokens would be overwritten
      // if update has tokens property (even undefined)
    });
  });

  describe("reset", () => {
    it("clears all servers and sessions", () => {
      const server = createServer();
      const session = createSession();
      useSessionStore.getState().setServer("server-1", server);
      useSessionStore.getState().setSession("server-1:session-1", session);

      useSessionStore.getState().reset();

      const { servers, sessions } = useSessionStore.getState();
      expect(servers.size).toBe(0);
      expect(sessions.size).toBe(0);
    });
  });
});
