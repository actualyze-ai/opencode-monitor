// Tests for SDK types and type guards

import { describe, it, expect } from "bun:test";
import {
  isSDKSession,
  isSDKMessage,
  isSDKProvider,
  extractProviders,
  extractSessions,
  extractMessages,
  extractStatusMap,
  getMessageRole,
  getMessageCost,
  getMessageTokens,
  getMessageProviderID,
  getMessageModelID,
} from "../sdk-types";

describe("SDK type guards", () => {
  describe("isSDKSession", () => {
    it("returns true for valid session", () => {
      expect(isSDKSession({ id: "sess_123" })).toBe(true);
      expect(isSDKSession({ id: "sess_123", title: "Test" })).toBe(true);
    });

    it("returns false for invalid values", () => {
      expect(isSDKSession(null)).toBe(false);
      expect(isSDKSession(undefined)).toBe(false);
      expect(isSDKSession({})).toBe(false);
      expect(isSDKSession({ id: 123 })).toBe(false);
      expect(isSDKSession("string")).toBe(false);
    });
  });

  describe("isSDKMessage", () => {
    it("returns true for objects", () => {
      expect(isSDKMessage({})).toBe(true);
      expect(isSDKMessage({ role: "user" })).toBe(true);
    });

    it("returns false for non-objects", () => {
      expect(isSDKMessage(null)).toBe(false);
      expect(isSDKMessage(undefined)).toBe(false);
      expect(isSDKMessage("string")).toBe(false);
    });
  });

  describe("isSDKProvider", () => {
    it("returns true for valid provider", () => {
      expect(isSDKProvider({ id: "anthropic" })).toBe(true);
      expect(isSDKProvider({ id: "openai", name: "OpenAI" })).toBe(true);
    });

    it("returns false for invalid values", () => {
      expect(isSDKProvider(null)).toBe(false);
      expect(isSDKProvider({})).toBe(false);
      expect(isSDKProvider({ id: 123 })).toBe(false);
    });
  });
});

describe("SDK extractors", () => {
  describe("extractProviders", () => {
    it("extracts from array", () => {
      const result = extractProviders([{ id: "anthropic" }, { id: "openai" }]);
      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe("anthropic");
    });

    it("extracts from {all: []} format", () => {
      const result = extractProviders({
        all: [{ id: "anthropic" }, { id: "openai" }],
      });
      expect(result).toHaveLength(2);
    });

    it("filters invalid providers", () => {
      const result = extractProviders([
        { id: "valid" },
        { notId: "invalid" },
        null,
      ]);
      expect(result).toHaveLength(1);
    });

    it("returns empty array for invalid input", () => {
      expect(extractProviders(null)).toEqual([]);
      expect(extractProviders(undefined)).toEqual([]);
      expect(extractProviders("string")).toEqual([]);
    });
  });

  describe("extractSessions", () => {
    it("extracts valid sessions", () => {
      const result = extractSessions([
        { id: "sess_1" },
        { id: "sess_2", title: "Test" },
      ]);
      expect(result).toHaveLength(2);
    });

    it("filters invalid sessions", () => {
      const result = extractSessions([
        { id: "valid" },
        { notId: "invalid" },
        null,
      ]);
      expect(result).toHaveLength(1);
    });

    it("returns empty array for non-array", () => {
      expect(extractSessions(null)).toEqual([]);
      expect(extractSessions({})).toEqual([]);
    });
  });

  describe("extractMessages", () => {
    it("extracts messages from array", () => {
      const result = extractMessages([{ role: "user" }, { role: "assistant" }]);
      expect(result).toHaveLength(2);
    });

    it("returns empty array for non-array", () => {
      expect(extractMessages(null)).toEqual([]);
      expect(extractMessages({})).toEqual([]);
    });
  });

  describe("extractStatusMap", () => {
    it("returns status map from object", () => {
      const result = extractStatusMap({
        sess_1: { type: "idle" },
        sess_2: { type: "busy" },
      });
      expect(result.sess_1?.type).toBe("idle");
      expect(result.sess_2?.type).toBe("busy");
    });

    it("returns empty object for invalid input", () => {
      expect(extractStatusMap(null)).toEqual({});
      expect(extractStatusMap(undefined)).toEqual({});
    });
  });
});

describe("SDK message helpers", () => {
  describe("getMessageRole", () => {
    it("gets role from direct property", () => {
      expect(getMessageRole({ role: "user" })).toBe("user");
    });

    it("gets role from info.role", () => {
      expect(getMessageRole({ info: { role: "assistant" } })).toBe("assistant");
    });

    it("prefers direct role over info.role", () => {
      expect(
        getMessageRole({ role: "user", info: { role: "assistant" } }),
      ).toBe("user");
    });

    it("returns undefined when no role", () => {
      expect(getMessageRole({})).toBeUndefined();
    });
  });

  describe("getMessageCost", () => {
    it("gets cost from direct property", () => {
      expect(getMessageCost({ cost: 0.01 })).toBe(0.01);
    });

    it("gets cost from info.cost", () => {
      expect(getMessageCost({ info: { cost: 0.02 } })).toBe(0.02);
    });

    it("returns undefined when no cost", () => {
      expect(getMessageCost({})).toBeUndefined();
    });
  });

  describe("getMessageTokens", () => {
    it("gets tokens from direct property", () => {
      const tokens = { input: 100, output: 50 };
      expect(getMessageTokens({ tokens })).toEqual(tokens);
    });

    it("gets tokens from info.tokens", () => {
      const tokens = { input: 100, output: 50 };
      expect(getMessageTokens({ info: { tokens } })).toEqual(tokens);
    });

    it("returns undefined when no tokens", () => {
      expect(getMessageTokens({})).toBeUndefined();
    });
  });

  describe("getMessageProviderID", () => {
    it("gets providerID from direct property", () => {
      expect(getMessageProviderID({ providerID: "anthropic" })).toBe(
        "anthropic",
      );
    });

    it("gets providerID from info.providerID", () => {
      expect(getMessageProviderID({ info: { providerID: "openai" } })).toBe(
        "openai",
      );
    });
  });

  describe("getMessageModelID", () => {
    it("gets modelID from direct property", () => {
      expect(getMessageModelID({ modelID: "claude-3" })).toBe("claude-3");
    });

    it("gets modelID from info.modelID", () => {
      expect(getMessageModelID({ info: { modelID: "gpt-4" } })).toBe("gpt-4");
    });
  });
});
