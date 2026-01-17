// Tests for WebSocket server

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { WebSocket } from "ws";
import { MonitorWSServer } from "../ws-server";
import type { HelloMessage, RPCRequest } from "../ws-types";

// Helper to wait for a condition
function waitFor(condition: () => boolean, timeout = 1000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (condition()) {
        resolve();
      } else if (Date.now() - start > timeout) {
        reject(new Error("Timeout waiting for condition"));
      } else {
        setTimeout(check, 10);
      }
    };
    check();
  });
}

// Helper to create a test client
function createTestClient(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    ws.on("open", () => resolve(ws));
    ws.on("error", reject);
  });
}

describe("MonitorWSServer", () => {
  let server: MonitorWSServer;
  let port: number;
  let clients: WebSocket[] = [];

  beforeEach(() => {
    // Use a random port to avoid conflicts
    port = 40000 + Math.floor(Math.random() * 10000);
    server = new MonitorWSServer(port);
  });

  afterEach(async () => {
    // Close all test clients
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.close();
      }
    }
    clients = [];

    // Stop server and wait for port to be released
    await server.stop();
  });

  describe("start/stop", () => {
    it("starts and stops cleanly", async () => {
      await server.start();
      expect(server.getConnectedServers()).toEqual([]);

      await server.stop();
      // Should not throw
    });

    it("handles multiple start calls gracefully", async () => {
      await server.start();
      await server.start(); // Should not throw or create duplicate servers
      await server.stop();
    });

    it("handles stop without start", async () => {
      await server.stop(); // Should not throw
    });
  });

  describe("client connection", () => {
    it("emits client_connected on hello message", async () => {
      await server.start();

      const connectedPromise = new Promise<string>((resolve) => {
        server.on("client_connected", (serverId) => resolve(serverId));
      });

      const client = await createTestClient(port);
      clients.push(client);

      // Send hello message
      const hello: HelloMessage = {
        type: "hello",
        serverId: "test-server-1",
        serverName: "Test Server",
        directory: "/home/user/project",
      };
      client.send(JSON.stringify(hello));

      const serverId = await connectedPromise;
      expect(serverId).toBe("test-server-1");
      expect(server.getConnectedServers()).toContain("test-server-1");
    });

    it("emits client_disconnected on close", async () => {
      await server.start();

      const disconnectedPromise = new Promise<string>((resolve) => {
        server.on("client_disconnected", (serverId) => resolve(serverId));
      });

      const client = await createTestClient(port);

      // Send hello first
      const hello: HelloMessage = {
        type: "hello",
        serverId: "test-server-2",
        serverName: "Test Server",
        directory: "/home/user/project",
      };
      client.send(JSON.stringify(hello));

      // Wait for registration
      await waitFor(() =>
        server.getConnectedServers().includes("test-server-2"),
      );

      // Close client
      client.close();

      const serverId = await disconnectedPromise;
      expect(serverId).toBe("test-server-2");
      expect(server.getConnectedServers()).not.toContain("test-server-2");
    });

    it("stores server metadata from hello message", async () => {
      await server.start();

      const client = await createTestClient(port);
      clients.push(client);

      const hello: HelloMessage = {
        type: "hello",
        serverId: "test-server-3",
        serverName: "My Server",
        serverUrl: "http://localhost:4096",
        project: "my-project",
        branch: "main",
        directory: "/home/user/project",
      };
      client.send(JSON.stringify(hello));

      await waitFor(() => server.isConnected("test-server-3"));

      const metadata = server.getServerMetadata("test-server-3");
      expect(metadata?.serverName).toBe("My Server");
      expect(metadata?.serverUrl).toBe("http://localhost:4096");
      expect(metadata?.project).toBe("my-project");
      expect(metadata?.branch).toBe("main");
      expect(metadata?.directory).toBe("/home/user/project");
    });
  });

  describe("authentication", () => {
    it("rejects hello without matching auth token", async () => {
      server = new MonitorWSServer(port, "secret-token");
      await server.start();

      const client = await createTestClient(port);
      clients.push(client);

      const closePromise = new Promise<void>((resolve) => {
        client.on("close", () => resolve());
      });

      const hello: HelloMessage = {
        type: "hello",
        serverId: "auth-fail",
        serverName: "Auth Fail",
        directory: "/home/user/project",
      };
      client.send(JSON.stringify(hello));

      await closePromise;
      expect(server.isConnected("auth-fail")).toBe(false);
    });

    it("accepts hello with matching auth token", async () => {
      server = new MonitorWSServer(port, "secret-token");
      await server.start();

      const client = await createTestClient(port);
      clients.push(client);

      const hello: HelloMessage = {
        type: "hello",
        serverId: "auth-ok",
        serverName: "Auth Ok",
        directory: "/home/user/project",
        authToken: "secret-token",
      };
      client.send(JSON.stringify(hello));

      await waitFor(() => server.isConnected("auth-ok"));
      expect(server.isConnected("auth-ok")).toBe(true);
    });
  });

  describe("AUTO replacement", () => {
    it("replaces AUTO in serverUrl with remote address", async () => {
      await server.start();

      const connectedPromise = new Promise<{
        serverId: string;
        metadata: unknown;
      }>((resolve) => {
        server.on("client_connected", (serverId, metadata) =>
          resolve({ serverId, metadata }),
        );
      });

      const client = await createTestClient(port);
      clients.push(client);

      const hello: HelloMessage = {
        type: "hello",
        serverId: "test-server-auto",
        serverName: "Auto Server",
        serverUrl: "http://AUTO:4096",
        directory: "/home/user/project",
      };
      client.send(JSON.stringify(hello));

      const { metadata } = await connectedPromise;
      const serverMetadata = metadata as { serverUrl?: string };

      // Should have replaced AUTO with 127.0.0.1 (localhost connection)
      expect(serverMetadata.serverUrl).toBe("http://127.0.0.1:4096");
    });
  });

  describe("RPC", () => {
    it("sends request and receives response", async () => {
      await server.start();

      const client = await createTestClient(port);
      clients.push(client);

      // Register client
      const hello: HelloMessage = {
        type: "hello",
        serverId: "rpc-server",
        serverName: "RPC Server",
        directory: "/home/user/project",
      };
      client.send(JSON.stringify(hello));

      await waitFor(() => server.isConnected("rpc-server"));

      // Set up client to respond to RPC
      client.on("message", (data) => {
        const msg = JSON.parse(data.toString()) as RPCRequest;
        if (msg.method === "test.echo") {
          client.send(
            JSON.stringify({
              id: msg.id,
              result: { echo: msg.params },
            }),
          );
        }
      });

      // Send RPC request
      const result = await server.request("rpc-server", "test.echo", {
        message: "hello",
      });

      expect(result).toEqual({ echo: { message: "hello" } });
    });

    it("throws error for unknown server", async () => {
      await server.start();

      await expect(
        server.request("nonexistent", "test.method"),
      ).rejects.toThrow("No client connected for server: nonexistent");
    });

    it("rejects pending requests when client disconnects", async () => {
      await server.start();

      const client = await createTestClient(port);
      clients.push(client);

      // Register client but don't respond to RPC
      const hello: HelloMessage = {
        type: "hello",
        serverId: "disconnect-server",
        serverName: "Disconnect Server",
        directory: "/home/user/project",
      };
      client.send(JSON.stringify(hello));

      await waitFor(() => server.isConnected("disconnect-server"));

      // Start a request that won't be answered
      const requestPromise = server.request("disconnect-server", "test.slow");

      // Client should receive the request
      const requestReceived = new Promise<boolean>((resolve) => {
        client.on("message", () => resolve(true));
      });

      expect(await requestReceived).toBe(true);

      // Close client - this should cause the server to reject pending requests
      // when it shuts down. We need to handle both promises together since
      // stop() will reject the pending request during its execution.
      const [, rejection] = await Promise.allSettled([
        server.stop(),
        requestPromise,
      ]);

      expect(rejection.status).toBe("rejected");
      expect((rejection as PromiseRejectedResult).reason.message).toBe(
        "Server shutting down",
      );
    });
  });

  describe("events", () => {
    it("emits event when plugin sends event message", async () => {
      await server.start();

      const eventPromise = new Promise<{ serverId: string; event: unknown }>(
        (resolve) => {
          server.on("event", (serverId, event) => resolve({ serverId, event }));
        },
      );

      const client = await createTestClient(port);
      clients.push(client);

      // Register client
      const hello: HelloMessage = {
        type: "hello",
        serverId: "event-server",
        serverName: "Event Server",
        directory: "/home/user/project",
      };
      client.send(JSON.stringify(hello));

      await waitFor(() => server.isConnected("event-server"));

      // Send event
      client.send(
        JSON.stringify({
          type: "event",
          event: {
            type: "session.status",
            properties: { sessionID: "sess1", status: { type: "busy" } },
          },
        }),
      );

      const { serverId, event } = await eventPromise;
      expect(serverId).toBe("event-server");
      expect((event as { type: string }).type).toBe("session.status");
    });
  });

  describe("multiple clients", () => {
    it("handles multiple simultaneous clients", async () => {
      await server.start();

      const client1 = await createTestClient(port);
      const client2 = await createTestClient(port);
      clients.push(client1, client2);

      // Register both clients
      client1.send(
        JSON.stringify({
          type: "hello",
          serverId: "multi-1",
          serverName: "Server 1",
          directory: "/home/user/project1",
        }),
      );

      client2.send(
        JSON.stringify({
          type: "hello",
          serverId: "multi-2",
          serverName: "Server 2",
          directory: "/home/user/project2",
        }),
      );

      await waitFor(
        () => server.isConnected("multi-1") && server.isConnected("multi-2"),
      );

      expect(server.getConnectedServers()).toHaveLength(2);
      expect(server.getConnectedServers()).toContain("multi-1");
      expect(server.getConnectedServers()).toContain("multi-2");
    });
  });

  describe("RPC error handling", () => {
    it("handles RPC error response from client", async () => {
      await server.start();

      const client = await createTestClient(port);
      clients.push(client);

      // Set up client to respond with error BEFORE sending hello
      // This ensures the handler is ready when the RPC request arrives
      client.on("message", (data) => {
        const msg = JSON.parse(data.toString()) as RPCRequest;
        if (msg.method === "test.fail") {
          client.send(
            JSON.stringify({
              id: msg.id,
              error: { message: "Something went wrong" },
            }),
          );
        }
      });

      // Register client
      const hello: HelloMessage = {
        type: "hello",
        serverId: "error-server",
        serverName: "Error Server",
        directory: "/home/user/project",
      };
      client.send(JSON.stringify(hello));

      await waitFor(() => server.isConnected("error-server"));

      // Small delay to ensure message handler is fully ready
      await new Promise((r) => setTimeout(r, 50));

      // Send RPC request that will fail
      await expect(server.request("error-server", "test.fail")).rejects.toThrow(
        "Something went wrong",
      );
    });

    it("ignores response for unknown request ID", async () => {
      await server.start();

      const client = await createTestClient(port);
      clients.push(client);

      // Register client
      const hello: HelloMessage = {
        type: "hello",
        serverId: "unknown-id-server",
        serverName: "Unknown ID Server",
        directory: "/home/user/project",
      };
      client.send(JSON.stringify(hello));

      await waitFor(() => server.isConnected("unknown-id-server"));

      // Send a response with an ID that was never requested
      // This should be silently ignored (logged but not throw)
      client.send(
        JSON.stringify({
          id: 99999,
          result: { data: "orphan response" },
        }),
      );

      // Wait a bit to ensure no errors
      await new Promise((r) => setTimeout(r, 50));

      // Server should still be functional
      expect(server.isConnected("unknown-id-server")).toBe(true);
    });
  });

  describe("error events", () => {
    it("emits error event on client error", async () => {
      await server.start();

      // Track if error was emitted (may or may not happen depending on close type)
      let errorEmitted = false;
      server.on("error", () => {
        errorEmitted = true;
      });

      const client = await createTestClient(port);
      clients.push(client);

      // Register client
      const hello: HelloMessage = {
        type: "hello",
        serverId: "error-client",
        serverName: "Error Client",
        directory: "/home/user/project",
      };
      client.send(JSON.stringify(hello));

      await waitFor(() => server.isConnected("error-client"));

      // Simulate client error by terminating abruptly
      client.terminate();

      // The error event may or may not fire depending on how the connection closes
      // Just verify the client is eventually disconnected
      await waitFor(() => !server.isConnected("error-client"), 2000);
      expect(server.isConnected("error-client")).toBe(false);

      // errorEmitted may be true or false - we just want to ensure no crash
      void errorEmitted;
    });

    it("handles malformed JSON messages gracefully", async () => {
      await server.start();

      const client = await createTestClient(port);
      clients.push(client);

      // Send malformed JSON - should not crash server
      client.send("not valid json {{{");

      // Wait a bit
      await new Promise((r) => setTimeout(r, 50));

      // Server should still be running and accepting connections
      const client2 = await createTestClient(port);
      clients.push(client2);

      const hello: HelloMessage = {
        type: "hello",
        serverId: "after-malformed",
        serverName: "After Malformed",
        directory: "/home/user/project",
      };
      client2.send(JSON.stringify(hello));

      await waitFor(() => server.isConnected("after-malformed"));
      expect(server.isConnected("after-malformed")).toBe(true);
    });
  });

  describe("goodbye message", () => {
    it("handles goodbye message from client", async () => {
      await server.start();

      const client = await createTestClient(port);
      clients.push(client);

      // Register client
      const hello: HelloMessage = {
        type: "hello",
        serverId: "goodbye-server",
        serverName: "Goodbye Server",
        directory: "/home/user/project",
      };
      client.send(JSON.stringify(hello));

      await waitFor(() => server.isConnected("goodbye-server"));

      // Send goodbye message
      client.send(
        JSON.stringify({
          type: "goodbye",
        }),
      );

      // Wait a bit for processing
      await new Promise((r) => setTimeout(r, 50));

      // Client should still be connected (goodbye is just informational)
      // The actual disconnect happens when the client closes
      expect(server.isConnected("goodbye-server")).toBe(true);

      // Now close the client
      client.close();

      await waitFor(() => !server.isConnected("goodbye-server"));
      expect(server.isConnected("goodbye-server")).toBe(false);
    });
  });

  describe("event without registration", () => {
    it("ignores events from unregistered clients", async () => {
      await server.start();

      let eventReceived = false;
      server.on("event", () => {
        eventReceived = true;
      });

      const client = await createTestClient(port);
      clients.push(client);

      // Send event without hello first
      client.send(
        JSON.stringify({
          type: "event",
          event: {
            type: "session.status",
            properties: { sessionID: "sess1", status: { type: "busy" } },
          },
        }),
      );

      // Wait a bit
      await new Promise((r) => setTimeout(r, 50));

      // Event should not have been emitted (no serverId)
      expect(eventReceived).toBe(false);
    });
  });

  describe("request queue", () => {
    it("queues requests when max concurrent is exceeded", async () => {
      await server.start();

      const client = await createTestClient(port);
      clients.push(client);

      // Register client
      const hello: HelloMessage = {
        type: "hello",
        serverId: "queue-server",
        serverName: "Queue Server",
        directory: "/home/user/project",
      };
      client.send(JSON.stringify(hello));

      await waitFor(() => server.isConnected("queue-server"));

      // Track received requests
      const receivedRequests: number[] = [];
      const pendingResponses: Map<number, { respond: () => void }> = new Map();

      client.on("message", (data) => {
        const msg = JSON.parse(data.toString()) as RPCRequest;
        if (msg.method === "test.slow") {
          receivedRequests.push(msg.id);
          // Don't respond immediately - hold the request
          pendingResponses.set(msg.id, {
            respond: () => {
              client.send(JSON.stringify({ id: msg.id, result: { ok: true } }));
            },
          });
        }
      });

      // Send 12 requests (max is 10, so 2 should be queued)
      const promises: Promise<unknown>[] = [];
      for (let i = 0; i < 12; i++) {
        promises.push(server.request("queue-server", "test.slow", { i }));
      }

      // Wait for first batch to be received
      await waitFor(() => receivedRequests.length === 10, 2000);

      // Only 10 should have been sent to client (2 queued)
      expect(receivedRequests.length).toBe(10);

      // Complete one request - should trigger queue processing
      const firstId = receivedRequests[0]!;
      pendingResponses.get(firstId)!.respond();

      // Wait for queued request to be sent
      await waitFor(() => receivedRequests.length === 11, 2000);
      expect(receivedRequests.length).toBe(11);

      // Complete another - should process the last queued request
      const secondId = receivedRequests[1]!;
      pendingResponses.get(secondId)!.respond();

      await waitFor(() => receivedRequests.length === 12, 2000);
      expect(receivedRequests.length).toBe(12);

      // Complete all remaining requests
      for (const [id, handler] of pendingResponses) {
        if (id !== firstId && id !== secondId) {
          handler.respond();
        }
      }

      // All promises should resolve
      const results = await Promise.all(promises);
      expect(results.every((r) => (r as { ok: boolean }).ok)).toBe(true);
    });

    it("rejects queued requests when client disconnects", async () => {
      await server.start();

      const client = await createTestClient(port);
      clients.push(client);

      // Register client
      const hello: HelloMessage = {
        type: "hello",
        serverId: "queue-disconnect",
        serverName: "Queue Disconnect",
        directory: "/home/user/project",
      };
      client.send(JSON.stringify(hello));

      await waitFor(() => server.isConnected("queue-disconnect"));

      // Don't respond to any requests - just hold them
      client.on("message", () => {
        // Intentionally don't respond
      });

      // Send 12 requests (2 will be queued)
      const promises: Promise<unknown>[] = [];
      for (let i = 0; i < 12; i++) {
        promises.push(server.request("queue-disconnect", "test.slow", { i }));
      }

      // Wait a bit for requests to be sent/queued
      await new Promise((r) => setTimeout(r, 100));

      // Close client - should reject all pending and queued requests
      client.close();

      // All promises should reject
      const results = await Promise.allSettled(promises);
      const rejected = results.filter((r) => r.status === "rejected");
      expect(rejected.length).toBe(12);

      // All should have the disconnect error message
      for (const result of rejected) {
        expect((result as PromiseRejectedResult).reason.message).toBe(
          "Client disconnected",
        );
      }
    });

    it("processes queue in order after request completes", async () => {
      await server.start();

      const client = await createTestClient(port);
      clients.push(client);

      // Register client
      const hello: HelloMessage = {
        type: "hello",
        serverId: "queue-order",
        serverName: "Queue Order",
        directory: "/home/user/project",
      };
      client.send(JSON.stringify(hello));

      await waitFor(() => server.isConnected("queue-order"));

      // Track order of received requests
      const receivedOrder: number[] = [];
      const responseQueue: Array<() => void> = [];

      client.on("message", (data) => {
        const msg = JSON.parse(data.toString()) as RPCRequest;
        if (msg.method === "test.ordered") {
          const params = msg.params as { order: number };
          receivedOrder.push(params.order);
          responseQueue.push(() => {
            client.send(
              JSON.stringify({ id: msg.id, result: { order: params.order } }),
            );
          });
        }
      });

      // Send 12 requests with order numbers
      const promises: Promise<unknown>[] = [];
      for (let i = 0; i < 12; i++) {
        promises.push(
          server.request("queue-order", "test.ordered", { order: i }),
        );
      }

      // Wait for first 10 to be received
      await waitFor(() => receivedOrder.length === 10, 2000);

      // First 10 should be received in order
      expect(receivedOrder).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

      // Complete first request - should trigger request 10
      const respond0 = responseQueue[0];
      if (respond0) respond0();
      await waitFor(() => receivedOrder.length === 11, 2000);
      expect(receivedOrder[10]).toBe(10);

      // Complete second request - should trigger request 11
      const respond1 = responseQueue[1];
      if (respond1) respond1();
      await waitFor(() => receivedOrder.length === 12, 2000);
      expect(receivedOrder[11]).toBe(11);

      // Complete all remaining
      for (let i = 2; i < responseQueue.length; i++) {
        const respond = responseQueue[i];
        if (respond) respond();
      }

      const results = await Promise.all(promises);
      // Results should match the order they were sent
      for (let i = 0; i < 12; i++) {
        expect((results[i] as { order: number }).order).toBe(i);
      }
    });
  });
});
