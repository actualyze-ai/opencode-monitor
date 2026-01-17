// WebSocket-based SDK client
// Creates an SDK-like interface that routes through WebSocket to the plugin

import type { MonitorWSServer } from "./ws-server";

/**
 * Creates an SDK-like client that routes calls through WebSocket
 * This mirrors the structure of the real OpenCode SDK client
 */
export function createWSClient(server: MonitorWSServer, serverId: string) {
  const request = (method: string, params?: unknown) =>
    server.request(serverId, method, params);

  return {
    session: {
      list: () => request("session.list"),
      get: (params: { path: { id: string } }) => request("session.get", params),
      status: () => request("session.status"),
      abort: (params: { path: { id: string } }) =>
        request("session.abort", params),
      messages: (params: {
        path: { id: string };
        query?: { limit?: number };
      }) => request("session.messages", params),
      children: (params: { path: { id: string } }) =>
        request("session.children", params),
    },
    provider: {
      list: () => request("provider.list"),
    },
  };
}

/**
 * Type for the WebSocket SDK client
 */
export type WSClient = ReturnType<typeof createWSClient>;
