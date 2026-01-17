// Tests for composite key utilities

import { describe, it, expect } from "bun:test";
import * as fc from "fast-check";
import { makeKey, parseKey, getSessionId } from "../keys";

describe("keys", () => {
  describe("makeKey", () => {
    it("creates composite key in serverId:sessionId format", () => {
      expect(makeKey("server1", "session1")).toBe("server1:session1");
    });

    it("handles empty strings", () => {
      expect(makeKey("", "session1")).toBe(":session1");
      expect(makeKey("server1", "")).toBe("server1:");
      expect(makeKey("", "")).toBe(":");
    });

    it("handles special characters", () => {
      expect(makeKey("server-1", "session_1")).toBe("server-1:session_1");
      expect(makeKey("host:port", "id")).toBe("host:port:id");
    });
  });

  describe("parseKey", () => {
    it("extracts serverId and sessionId from composite key", () => {
      expect(parseKey("server1:session1")).toEqual({
        serverId: "server1",
        sessionId: "session1",
      });
    });

    it("handles missing colon by returning unknown serverId", () => {
      expect(parseKey("noseparator")).toEqual({
        serverId: "unknown",
        sessionId: "noseparator",
      });
    });

    it("handles empty string", () => {
      expect(parseKey("")).toEqual({
        serverId: "unknown",
        sessionId: "",
      });
    });

    it("only splits on first colon (sessionId can contain colons)", () => {
      expect(parseKey("server1:session:with:colons")).toEqual({
        serverId: "server1",
        sessionId: "session:with:colons",
      });
    });

    it("handles key starting with colon", () => {
      expect(parseKey(":session1")).toEqual({
        serverId: "",
        sessionId: "session1",
      });
    });

    it("handles key ending with colon", () => {
      expect(parseKey("server1:")).toEqual({
        serverId: "server1",
        sessionId: "",
      });
    });
  });

  describe("getSessionId", () => {
    it("extracts session ID from composite key", () => {
      expect(getSessionId("server1:session1")).toBe("session1");
    });

    it("returns full string if no colon present", () => {
      expect(getSessionId("noseparator")).toBe("noseparator");
    });

    it("handles colons in session ID", () => {
      expect(getSessionId("server1:session:with:colons")).toBe(
        "session:with:colons",
      );
    });
  });

  describe("property-based tests", () => {
    it("makeKey output always contains exactly one colon at minimum", () => {
      fc.assert(
        fc.property(fc.string(), fc.string(), (serverId, sessionId) => {
          const key = makeKey(serverId, sessionId);
          // At least one colon (the separator we add)
          expect(key.includes(":")).toBe(true);
        }),
      );
    });

    it("roundtrip: parseKey(makeKey(a, b)) preserves serverId", () => {
      fc.assert(
        fc.property(
          // Exclude strings containing colons for serverId to ensure clean roundtrip
          fc.string().filter((s) => !s.includes(":")),
          fc.string(),
          (serverId, sessionId) => {
            const key = makeKey(serverId, sessionId);
            const parsed = parseKey(key);
            expect(parsed.serverId).toBe(serverId);
          },
        ),
      );
    });

    it("roundtrip: parseKey(makeKey(a, b)) preserves sessionId when serverId has no colons", () => {
      fc.assert(
        fc.property(
          // Exclude strings containing colons for serverId to ensure clean roundtrip
          fc.string().filter((s) => !s.includes(":")),
          fc.string(),
          (serverId, sessionId) => {
            const key = makeKey(serverId, sessionId);
            const parsed = parseKey(key);
            expect(parsed.sessionId).toBe(sessionId);
          },
        ),
      );
    });

    it("getSessionId equals parseKey().sessionId", () => {
      fc.assert(
        fc.property(fc.string(), (key) => {
          expect(getSessionId(key)).toBe(parseKey(key).sessionId);
        }),
      );
    });
  });
});
