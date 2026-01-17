// Tests for session cache

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { writeFileSync, unlinkSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSession, createServer } from "./fixtures";
import { saveCache, loadCache } from "../cache";

describe("cache", () => {
  // Use a unique temp file for each test run
  const testCacheFile = join(tmpdir(), `test-cache-${process.pid}.json`);

  beforeEach(() => {
    // Set the cache file path via env var
    process.env.OPENCODE_MONITOR_CACHE_FILE = testCacheFile;

    // Clean up any existing test file
    if (existsSync(testCacheFile)) {
      unlinkSync(testCacheFile);
    }
  });

  afterEach(() => {
    // Clean up test file
    if (existsSync(testCacheFile)) {
      unlinkSync(testCacheFile);
    }
  });

  describe("saveCache", () => {
    it("writes valid JSON to file", () => {
      const servers = new Map([["server1", createServer()]]);
      const sessions = new Map([["server1:session1", createSession()]]);

      saveCache(servers, sessions);

      expect(existsSync(testCacheFile)).toBe(true);

      // Verify it's valid JSON
      const content = readFileSync(testCacheFile, "utf-8");
      const parsed = JSON.parse(content);

      expect(parsed).toHaveProperty("timestamp");
      expect(parsed).toHaveProperty("servers");
      expect(parsed).toHaveProperty("sessions");
      expect(parsed.servers).toHaveLength(1);
      expect(parsed.sessions).toHaveLength(1);
    });

    it("handles empty maps", () => {
      const servers = new Map();
      const sessions = new Map();

      saveCache(servers, sessions);

      const content = readFileSync(testCacheFile, "utf-8");
      const parsed = JSON.parse(content);

      expect(parsed.servers).toHaveLength(0);
      expect(parsed.sessions).toHaveLength(0);
    });
  });

  describe("loadCache", () => {
    it("returns null for missing file", () => {
      expect(loadCache()).toBeNull();
    });

    it("returns null for stale cache (>60s)", () => {
      const staleCache = {
        timestamp: Date.now() - 70000, // 70 seconds ago
        servers: [createServer()],
        sessions: [createSession()],
      };

      writeFileSync(testCacheFile, JSON.stringify(staleCache));

      expect(loadCache()).toBeNull();
    });

    it("returns data for fresh cache", () => {
      const freshCache = {
        timestamp: Date.now() - 30000, // 30 seconds ago
        servers: [createServer()],
        sessions: [createSession()],
      };

      writeFileSync(testCacheFile, JSON.stringify(freshCache));

      const result = loadCache();

      expect(result).not.toBeNull();
      expect(result!.servers.size).toBe(1);
      expect(result!.sessions.size).toBe(1);
    });

    it("handles corrupted JSON gracefully", () => {
      writeFileSync(testCacheFile, "not valid json {{{");

      expect(loadCache()).toBeNull();
    });

    it("handles empty file gracefully", () => {
      writeFileSync(testCacheFile, "");

      expect(loadCache()).toBeNull();
    });
  });

  describe("roundtrip", () => {
    it("saveCache then loadCache preserves data", () => {
      const server = createServer({ id: "test-server", name: "Test" });
      const session = createSession({
        id: "test-server:test-session",
        originalId: "test-session",
        serverId: "test-server",
        name: "Test Session",
      });

      const servers = new Map([["test-server", server]]);
      const sessions = new Map([["test-server:test-session", session]]);

      saveCache(servers, sessions);
      const result = loadCache();

      expect(result).not.toBeNull();
      expect(result!.servers.get("test-server")?.name).toBe("Test");
      expect(result!.sessions.get("test-server:test-session")?.name).toBe(
        "Test Session",
      );
    });

    it("preserves all session fields", () => {
      const session = createSession({
        id: "s1:sess1",
        originalId: "sess1",
        serverId: "s1",
        name: "Full Session",
        status: "busy",
        tokens: 1000,
        contextUsed: 5000,
        contextLimit: 10000,
        cost: 0.05,
        messageCount: 10,
        project: "test-project",
        branch: "main",
        directory: "/home/user/project",
        parentId: "parent-session",
      });

      const servers = new Map();
      const sessions = new Map([["s1:sess1", session]]);

      saveCache(servers, sessions);
      const result = loadCache();

      const loaded = result!.sessions.get("s1:sess1");
      expect(loaded?.status).toBe("busy");
      expect(loaded?.tokens).toBe(1000);
      expect(loaded?.contextUsed).toBe(5000);
      expect(loaded?.contextLimit).toBe(10000);
      expect(loaded?.cost).toBe(0.05);
      expect(loaded?.messageCount).toBe(10);
      expect(loaded?.project).toBe("test-project");
      expect(loaded?.branch).toBe("main");
      expect(loaded?.directory).toBe("/home/user/project");
      expect(loaded?.parentId).toBe("parent-session");
    });
  });
});
