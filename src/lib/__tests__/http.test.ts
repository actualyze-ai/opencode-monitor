// Tests for HTTP/SDK client utilities

import { describe, it, expect, beforeEach, mock } from "bun:test";
import {
  fetchSessionsWS,
  fetchSessionDetailsWS,
  clearProviderCache,
} from "../http";
import type { WSClient } from "../ws-sdk";

// Helper to create a mock WSClient
function createMockWSClient(overrides: Partial<WSClient> = {}): WSClient {
  return {
    session: {
      list: mock(() => Promise.resolve([])),
      get: mock(() => Promise.resolve({})),
      messages: mock(() => Promise.resolve([])),
      status: mock(() => Promise.resolve({})),
    },
    provider: {
      list: mock(() => Promise.resolve({ all: [] })),
    },
    ...overrides,
  } as unknown as WSClient;
}

describe("fetchSessionsWS", () => {
  beforeEach(() => {
    // Clear any cached state
  });

  it("returns empty array when no sessions", async () => {
    const client = createMockWSClient();
    const sessions = await fetchSessionsWS(client, "server1");
    expect(sessions).toEqual([]);
  });

  it("maps session data correctly", async () => {
    const now = Date.now();
    const listMock = mock(() =>
      Promise.resolve([
        {
          id: "sess1",
          title: "Test Session",
          tokens: 1000,
          projectID: "my-project",
          directory: "/home/user/project",
          parentID: "parent1",
          time: { created: now - 60000, updated: now },
        },
      ]),
    );
    const statusMock = mock(() =>
      Promise.resolve({
        sess1: { type: "busy" },
      }),
    );

    const client = createMockWSClient({
      session: {
        list: listMock,
        get: mock(() => Promise.resolve({})),
        messages: mock(() => Promise.resolve([])),
        status: statusMock,
      },
    } as unknown as Partial<WSClient>);

    const sessions = await fetchSessionsWS(client, "server1");

    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      id: "server1:sess1",
      originalId: "sess1",
      serverId: "server1",
      name: "Test Session",
      status: "busy",
      tokens: 1000,
      project: "my-project",
      directory: "/home/user/project",
      parentId: "parent1",
    });
  });

  it("handles all status types", async () => {
    const statuses = [
      "idle",
      "busy",
      "retry",
      "waiting_for_permission",
      "completed",
      "error",
      "aborted",
    ] as const;

    for (const statusType of statuses) {
      const client = createMockWSClient({
        session: {
          list: mock(() => Promise.resolve([{ id: "sess1" }])),
          get: mock(() => Promise.resolve({})),
          messages: mock(() => Promise.resolve([])),
          status: mock(() => Promise.resolve({ sess1: { type: statusType } })),
        },
      } as unknown as Partial<WSClient>);

      const sessions = await fetchSessionsWS(client, "server1");
      expect(sessions[0]?.status).toBe(statusType);
    }
  });

  it("defaults to idle for unknown status", async () => {
    const client = createMockWSClient({
      session: {
        list: mock(() => Promise.resolve([{ id: "sess1" }])),
        get: mock(() => Promise.resolve({})),
        messages: mock(() => Promise.resolve([])),
        status: mock(() =>
          Promise.resolve({ sess1: { type: "unknown_status" } }),
        ),
      },
    } as unknown as Partial<WSClient>);

    const sessions = await fetchSessionsWS(client, "server1");
    expect(sessions[0]?.status).toBe("idle");
  });

  it("generates default name when title is missing", async () => {
    const client = createMockWSClient({
      session: {
        list: mock(() => Promise.resolve([{ id: "abcdefgh12345678" }])),
        get: mock(() => Promise.resolve({})),
        messages: mock(() => Promise.resolve([])),
        status: mock(() => Promise.resolve({})),
      },
    } as unknown as Partial<WSClient>);

    const sessions = await fetchSessionsWS(client, "server1");
    expect(sessions[0]?.name).toBe("Session abcdefgh");
  });

  it("returns empty array on error", async () => {
    const client = createMockWSClient({
      session: {
        list: mock(() => Promise.reject(new Error("Network error"))),
        get: mock(() => Promise.resolve({})),
        messages: mock(() => Promise.resolve([])),
        status: mock(() => Promise.resolve({})),
      },
    } as unknown as Partial<WSClient>);

    const sessions = await fetchSessionsWS(client, "server1");
    expect(sessions).toEqual([]);
  });
});

describe("fetchSessionDetailsWS", () => {
  beforeEach(() => {
    // Clear provider cache before each test
    clearProviderCache("server1");
  });

  it("returns null on error", async () => {
    const client = createMockWSClient({
      session: {
        list: mock(() => Promise.resolve([])),
        get: mock(() => Promise.reject(new Error("Not found"))),
        messages: mock(() => Promise.resolve([])),
        status: mock(() => Promise.resolve({})),
      },
    } as unknown as Partial<WSClient>);

    const result = await fetchSessionDetailsWS(client, "server1", "sess1");
    expect(result).toBeNull();
  });

  it("fetches session details with token breakdown", async () => {
    const now = Date.now();
    const client = createMockWSClient({
      session: {
        list: mock(() => Promise.resolve([])),
        get: mock(() =>
          Promise.resolve({
            id: "sess1",
            title: "Detailed Session",
            tokens: 5000,
            projectID: "project",
            branch: "main",
            directory: "/home/user",
            time: { created: now - 60000, updated: now },
          }),
        ),
        messages: mock(() =>
          Promise.resolve([
            {
              role: "user",
              content: "Hello",
            },
            {
              role: "assistant",
              tokens: {
                input: 100,
                output: 200,
                reasoning: 50,
                cache: { read: 10, write: 5 },
              },
              cost: 0.01,
              providerID: "anthropic",
              modelID: "claude-3",
            },
          ]),
        ),
        status: mock(() => Promise.resolve({ sess1: { type: "idle" } })),
      },
      provider: {
        list: mock(() =>
          Promise.resolve({
            all: [
              {
                id: "anthropic",
                models: {
                  "claude-3": {
                    limit: { context: 200000 },
                  },
                },
              },
            ],
          }),
        ),
      },
    } as unknown as Partial<WSClient>);

    const result = await fetchSessionDetailsWS(client, "server1", "sess1");

    expect(result).not.toBeNull();
    expect(result?.name).toBe("Detailed Session");
    expect(result?.tokenBreakdown).toEqual({
      input: 100,
      output: 200,
      reasoning: 50,
      cacheRead: 10,
      cacheWrite: 5,
    });
    expect(result?.cost).toBe(0.01);
    expect(result?.model).toEqual({
      provider: "anthropic",
      model: "claude-3",
    });
    expect(result?.contextLimit).toBe(200000);
    expect(result?.messageCount).toBe(2);
  });

  it("handles messages with info wrapper", async () => {
    const client = createMockWSClient({
      session: {
        list: mock(() => Promise.resolve([])),
        get: mock(() => Promise.resolve({ id: "sess1", time: {} })),
        messages: mock(() =>
          Promise.resolve([
            {
              info: {
                role: "assistant",
                tokens: {
                  input: 50,
                  output: 100,
                  reasoning: 0,
                },
                cost: 0.005,
                providerID: "openai",
                modelID: "gpt-4",
              },
            },
          ]),
        ),
        status: mock(() => Promise.resolve({})),
      },
      provider: {
        list: mock(() => Promise.resolve({ all: [] })),
      },
    } as unknown as Partial<WSClient>);

    const result = await fetchSessionDetailsWS(client, "server1", "sess1");

    expect(result?.tokenBreakdown?.input).toBe(50);
    expect(result?.tokenBreakdown?.output).toBe(100);
    expect(result?.cost).toBe(0.005);
  });

  it("handles messages() failure gracefully", async () => {
    const client = createMockWSClient({
      session: {
        list: mock(() => Promise.resolve([])),
        get: mock(() =>
          Promise.resolve({ id: "sess1", title: "Session", time: {} }),
        ),
        messages: mock(() => Promise.reject(new Error("Messages failed"))),
        status: mock(() => Promise.resolve({})),
      },
      provider: {
        list: mock(() => Promise.resolve({ all: [] })),
      },
    } as unknown as Partial<WSClient>);

    const result = await fetchSessionDetailsWS(client, "server1", "sess1");

    // Should still return session, just without message-derived data
    expect(result).not.toBeNull();
    expect(result?.name).toBe("Session");
    expect(result?.tokenBreakdown).toBeUndefined();
  });

  it("caches provider list", async () => {
    const providerListMock = mock(() => Promise.resolve({ all: [] }));
    const client = createMockWSClient({
      session: {
        list: mock(() => Promise.resolve([])),
        get: mock(() => Promise.resolve({ id: "sess1", time: {} })),
        messages: mock(() => Promise.resolve([])),
        status: mock(() => Promise.resolve({})),
      },
      provider: {
        list: providerListMock,
      },
    } as unknown as Partial<WSClient>);

    // First call should fetch providers
    await fetchSessionDetailsWS(client, "server1", "sess1");
    expect(providerListMock).toHaveBeenCalledTimes(1);

    // Second call should use cache
    await fetchSessionDetailsWS(client, "server1", "sess1");
    expect(providerListMock).toHaveBeenCalledTimes(1);
  });
});

describe("clearProviderCache", () => {
  it("clears cache for specific server", async () => {
    // Use a unique server ID to avoid cache pollution from other tests
    const serverId = "clear-cache-test-server";
    clearProviderCache(serverId); // Ensure clean state

    const providerListMock = mock(() => Promise.resolve({ all: [] }));
    const client = createMockWSClient({
      session: {
        list: mock(() => Promise.resolve([])),
        get: mock(() => Promise.resolve({ id: "sess1", time: {} })),
        messages: mock(() => Promise.resolve([])),
        status: mock(() => Promise.resolve({})),
      },
      provider: {
        list: providerListMock,
      },
    } as unknown as Partial<WSClient>);

    // First call populates cache
    await fetchSessionDetailsWS(client, serverId, "sess1");
    expect(providerListMock).toHaveBeenCalledTimes(1);

    // Clear cache
    clearProviderCache(serverId);

    // Next call should fetch again
    await fetchSessionDetailsWS(client, serverId, "sess1");
    expect(providerListMock).toHaveBeenCalledTimes(2);
  });
});
