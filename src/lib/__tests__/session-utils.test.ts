// Tests for session manipulation utilities

import { describe, it, expect } from "bun:test";
import * as fc from "fast-check";
import { removeSessionsByServer } from "../session-utils";
import { createSession } from "./fixtures";

describe("removeSessionsByServer", () => {
  it("returns empty map for empty input", () => {
    const sessions = new Map();
    const result = removeSessionsByServer(sessions, "server1");
    expect(result.size).toBe(0);
  });

  it("removes all sessions for specified server", () => {
    const sessions = new Map([
      ["server1:s1", createSession({ id: "server1:s1", serverId: "server1" })],
      ["server1:s2", createSession({ id: "server1:s2", serverId: "server1" })],
      ["server2:s3", createSession({ id: "server2:s3", serverId: "server2" })],
    ]);

    const result = removeSessionsByServer(sessions, "server1");

    expect(result.size).toBe(1);
    expect(result.has("server1:s1")).toBe(false);
    expect(result.has("server1:s2")).toBe(false);
    expect(result.has("server2:s3")).toBe(true);
  });

  it("returns unchanged map when server not found", () => {
    const sessions = new Map([
      ["server1:s1", createSession({ id: "server1:s1", serverId: "server1" })],
      ["server2:s2", createSession({ id: "server2:s2", serverId: "server2" })],
    ]);

    const result = removeSessionsByServer(sessions, "server3");

    expect(result.size).toBe(2);
    expect(result.has("server1:s1")).toBe(true);
    expect(result.has("server2:s2")).toBe(true);
  });

  it("does not mutate original map", () => {
    const sessions = new Map([
      ["server1:s1", createSession({ id: "server1:s1", serverId: "server1" })],
    ]);

    const result = removeSessionsByServer(sessions, "server1");

    expect(sessions.size).toBe(1); // Original unchanged
    expect(result.size).toBe(0); // New map has removal
    expect(result).not.toBe(sessions); // Different reference
  });

  it("handles multiple servers correctly", () => {
    const sessions = new Map([
      ["s1:a", createSession({ id: "s1:a", serverId: "s1" })],
      ["s2:b", createSession({ id: "s2:b", serverId: "s2" })],
      ["s3:c", createSession({ id: "s3:c", serverId: "s3" })],
      ["s1:d", createSession({ id: "s1:d", serverId: "s1" })],
    ]);

    const result = removeSessionsByServer(sessions, "s1");

    expect(result.size).toBe(2);
    expect(result.has("s2:b")).toBe(true);
    expect(result.has("s3:c")).toBe(true);
  });

  it("property: result size <= original size", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string(), { minLength: 0, maxLength: 10 }),
        fc.string(),
        (serverIds, targetServer) => {
          const sessions = new Map(
            serverIds.map((serverId, i) => [
              `${serverId}:s${i}`,
              createSession({ id: `${serverId}:s${i}`, serverId }),
            ]),
          );

          const result = removeSessionsByServer(sessions, targetServer);
          return result.size <= sessions.size;
        },
      ),
    );
  });

  it("property: no sessions with target serverId remain", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom("s1", "s2", "s3"), {
          minLength: 1,
          maxLength: 10,
        }),
        fc.constantFrom("s1", "s2", "s3"),
        (serverIds, targetServer) => {
          const sessions = new Map(
            serverIds.map((serverId, i) => [
              `${serverId}:s${i}`,
              createSession({ id: `${serverId}:s${i}`, serverId }),
            ]),
          );

          const result = removeSessionsByServer(sessions, targetServer);

          for (const session of result.values()) {
            if (session.serverId === targetServer) {
              return false;
            }
          }
          return true;
        },
      ),
    );
  });
});
