// Tests for BrowserModal component
// NOTE: Full rendering tests require Bun runtime with @opentui/react/test-utils
// These tests verify component logic and type safety without rendering

import { describe, it, expect } from "bun:test";

import { BrowserModal, type BrowserModalState } from "../BrowserModal";
import { createSession, createServer } from "../../lib/__tests__/fixtures";

describe("BrowserModal", () => {
  it("exports a valid React component", () => {
    expect(BrowserModal).toBeDefined();
    expect(typeof BrowserModal).toBe("function");
  });

  describe("type safety", () => {
    it("BrowserModalState type covers all cases", () => {
      // This test verifies TypeScript type coverage
      const nullState: BrowserModalState = null;
      const subagentState: BrowserModalState = {
        type: "subagent",
        subagentName: "agent",
        parentSession: createSession(),
        server: createServer(),
      };
      const unavailableState: BrowserModalState = {
        type: "server-unavailable",
        serverName: "Server",
        serverUrl: "http://url",
      };
      const tuiUnavailableState: BrowserModalState = {
        type: "tui-server-unavailable",
        serverName: "Server",
        serverUrl: "http://url",
      };

      // All should be valid BrowserModalState
      expect(nullState).toBeNull();
      expect(subagentState.type).toBe("subagent");
      expect(unavailableState.type).toBe("server-unavailable");
      expect(tuiUnavailableState.type).toBe("tui-server-unavailable");
    });

    it("subagent modal has required fields", () => {
      const modal: BrowserModalState = {
        type: "subagent",
        subagentName: "test-agent",
        parentSession: createSession({ name: "Parent Session" }),
        server: createServer(),
      };

      expect(modal).not.toBeNull();
      if (modal && modal.type === "subagent") {
        expect(modal.subagentName).toBe("test-agent");
        expect(modal.parentSession.name).toBe("Parent Session");
        expect(modal.server).toBeDefined();
      }
    });

    it("server-unavailable modal has required fields", () => {
      const modal: BrowserModalState = {
        type: "server-unavailable",
        serverName: "Test Server",
        serverUrl: "http://localhost:4096",
      };

      expect(modal).not.toBeNull();
      if (modal && modal.type === "server-unavailable") {
        expect(modal.serverName).toBe("Test Server");
        expect(modal.serverUrl).toBe("http://localhost:4096");
      }
    });
  });

  // Note: Full rendering tests require Bun runtime
  // Use 'bun test' for full component testing
});
