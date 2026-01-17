import { describe, it, expect, beforeEach } from "bun:test";
import { useUIStore, type BrowserModalState } from "../uiStore";
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

describe("uiStore", () => {
  beforeEach(() => {
    useUIStore.getState().reset();
  });

  describe("selection state", () => {
    it("starts with null selectedId", () => {
      const { selectedId } = useUIStore.getState();
      expect(selectedId).toBeNull();
    });

    it("sets selectedId", () => {
      useUIStore.getState().setSelectedId("server-1:session-1");

      const { selectedId } = useUIStore.getState();
      expect(selectedId).toBe("server-1:session-1");
    });

    it("clears selectedId", () => {
      useUIStore.getState().setSelectedId("server-1:session-1");
      useUIStore.getState().setSelectedId(null);

      const { selectedId } = useUIStore.getState();
      expect(selectedId).toBeNull();
    });
  });

  describe("scroll state", () => {
    it("starts with scrollOffset 0", () => {
      const { scrollOffset } = useUIStore.getState();
      expect(scrollOffset).toBe(0);
    });

    it("sets scrollOffset", () => {
      useUIStore.getState().setScrollOffset(10);

      const { scrollOffset } = useUIStore.getState();
      expect(scrollOffset).toBe(10);
    });
  });

  describe("browser modal state", () => {
    it("starts with null browserModal", () => {
      const { browserModal } = useUIStore.getState();
      expect(browserModal).toBeNull();
    });

    it("sets subagent modal", () => {
      const server = createServer();
      const session = createSession();
      const modal: BrowserModalState = {
        type: "subagent",
        subagentName: "test-agent",
        parentSession: session,
        server,
      };

      useUIStore.getState().setBrowserModal(modal);

      const { browserModal } = useUIStore.getState();
      expect(browserModal).toEqual(modal);
    });

    it("sets server-unavailable modal", () => {
      const modal: BrowserModalState = {
        type: "server-unavailable",
        serverName: "Test Server",
        serverUrl: "http://localhost:8080",
      };

      useUIStore.getState().setBrowserModal(modal);

      const { browserModal } = useUIStore.getState();
      expect(browserModal).toEqual(modal);
    });

    it("sets tui-server-unavailable modal", () => {
      const modal: BrowserModalState = {
        type: "tui-server-unavailable",
        serverName: "Test Server",
        serverUrl: "http://localhost:8080",
      };

      useUIStore.getState().setBrowserModal(modal);

      const { browserModal } = useUIStore.getState();
      expect(browserModal).toEqual(modal);
    });

    it("clears browserModal", () => {
      useUIStore.getState().setBrowserModal({
        type: "server-unavailable",
        serverName: "Test",
        serverUrl: "http://test",
      });
      useUIStore.getState().setBrowserModal(null);

      const { browserModal } = useUIStore.getState();
      expect(browserModal).toBeNull();
    });
  });

  describe("detailed session state", () => {
    it("starts with null detailedSession", () => {
      const { detailedSession } = useUIStore.getState();
      expect(detailedSession).toBeNull();
    });

    it("sets detailedSession", () => {
      const session = createSession({ tokens: 1000, cost: 0.05 });

      useUIStore.getState().setDetailedSession(session);

      const { detailedSession } = useUIStore.getState();
      expect(detailedSession).toEqual(session);
    });

    it("clears detailedSession", () => {
      useUIStore.getState().setDetailedSession(createSession());
      useUIStore.getState().setDetailedSession(null);

      const { detailedSession } = useUIStore.getState();
      expect(detailedSession).toBeNull();
    });
  });

  describe("pending launch request", () => {
    it("starts with null pendingLaunchRequest", () => {
      const { pendingLaunchRequest } = useUIStore.getState();
      expect(pendingLaunchRequest).toBeNull();
    });

    it("sets pendingLaunchRequest", () => {
      const request = {
        serverUrl: "http://localhost:8080",
        sessionId: "session-1",
        sessionName: "Test Session",
      };

      useUIStore.getState().setPendingLaunchRequest(request);

      const { pendingLaunchRequest } = useUIStore.getState();
      expect(pendingLaunchRequest).toEqual(request);
    });

    it("consumes pendingLaunchRequest and clears it", () => {
      const request = {
        serverUrl: "http://localhost:8080",
        sessionId: "session-1",
        sessionName: "Test Session",
      };

      useUIStore.getState().setPendingLaunchRequest(request);
      const consumed = useUIStore.getState().consumePendingLaunchRequest();

      expect(consumed).toEqual(request);
      expect(useUIStore.getState().pendingLaunchRequest).toBeNull();
    });

    it("returns null when consuming empty pendingLaunchRequest", () => {
      const consumed = useUIStore.getState().consumePendingLaunchRequest();
      expect(consumed).toBeNull();
    });
  });

  describe("collapsed servers state", () => {
    it("starts with empty collapsedServers set", () => {
      const { collapsedServers } = useUIStore.getState();
      expect(collapsedServers.size).toBe(0);
    });

    it("toggles server collapsed state", () => {
      useUIStore.getState().toggleServerCollapsed("server-1");
      expect(useUIStore.getState().collapsedServers.has("server-1")).toBe(true);

      useUIStore.getState().toggleServerCollapsed("server-1");
      expect(useUIStore.getState().collapsedServers.has("server-1")).toBe(
        false,
      );
    });

    it("sets collapsed servers", () => {
      useUIStore
        .getState()
        .setCollapsedServers(new Set(["server-1", "server-2"]));

      const { collapsedServers } = useUIStore.getState();
      expect(collapsedServers.size).toBe(2);
      expect(collapsedServers.has("server-1")).toBe(true);
      expect(collapsedServers.has("server-2")).toBe(true);
    });

    it("toggles all servers - collapses when any expanded", () => {
      // Start with some expanded (server-2 and server-3 are expanded)
      useUIStore.getState().setCollapsedServers(new Set(["server-1"]));

      // Toggle all - should collapse all since some are expanded
      useUIStore
        .getState()
        .toggleAllServers(["server-1", "server-2", "server-3"]);

      const { collapsedServers } = useUIStore.getState();
      expect(collapsedServers.size).toBe(3);
      expect(collapsedServers.has("server-1")).toBe(true);
      expect(collapsedServers.has("server-2")).toBe(true);
      expect(collapsedServers.has("server-3")).toBe(true);
    });

    it("toggles all servers - expands when all collapsed", () => {
      // Start with all collapsed
      useUIStore
        .getState()
        .setCollapsedServers(new Set(["server-1", "server-2", "server-3"]));
      expect(useUIStore.getState().collapsedServers.size).toBe(3);

      // Toggle all - should expand all since all are collapsed
      useUIStore
        .getState()
        .toggleAllServers(["server-1", "server-2", "server-3"]);

      const { collapsedServers } = useUIStore.getState();
      expect(collapsedServers.size).toBe(0);
    });
  });

  describe("reset", () => {
    it("resets all state to initial values", () => {
      // Set various state
      useUIStore.getState().setSelectedId("test-id");
      useUIStore.getState().setScrollOffset(50);
      useUIStore.getState().setBrowserModal({
        type: "server-unavailable",
        serverName: "Test",
        serverUrl: "http://test",
      });
      useUIStore.getState().setDetailedSession(createSession());
      useUIStore.getState().setPendingLaunchRequest({
        serverUrl: "http://test",
        sessionId: "test",
        sessionName: "Test",
      });
      useUIStore
        .getState()
        .setCollapsedServers(new Set(["server-1", "server-2"]));

      // Reset
      useUIStore.getState().reset();

      // Verify all reset
      const state = useUIStore.getState();
      expect(state.selectedId).toBeNull();
      expect(state.scrollOffset).toBe(0);
      expect(state.browserModal).toBeNull();
      expect(state.detailedSession).toBeNull();
      expect(state.pendingLaunchRequest).toBeNull();
      expect(state.collapsedServers.size).toBe(0);
    });
  });
});
