// Zustand store for WebSocket connection state

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { WSClient } from "../lib/ws-sdk";
import type { MonitorWSServer } from "../lib/ws-server";

export interface ConnectionStore {
  // WebSocket server instance
  wsServer: MonitorWSServer | null;

  // WS clients per server (for RPC calls)
  wsClients: Map<string, WSClient>;

  // Actions
  setWsServer: (server: MonitorWSServer | null) => void;
  setWsClient: (serverId: string, client: WSClient) => void;
  removeWsClient: (serverId: string) => void;
  clearWsClients: () => void;
}

export const useConnectionStore = create<ConnectionStore>()(
  devtools(
    (set) => ({
      wsServer: null,
      wsClients: new Map(),

      setWsServer: (server) => set({ wsServer: server }),

      setWsClient: (serverId, client) =>
        set((state) => {
          const wsClients = new Map(state.wsClients);
          wsClients.set(serverId, client);
          return { wsClients };
        }),

      removeWsClient: (serverId) =>
        set((state) => {
          const wsClients = new Map(state.wsClients);
          wsClients.delete(serverId);
          return { wsClients };
        }),

      clearWsClients: () => set({ wsClients: new Map() }),
    }),
    { name: "connection-store" },
  ),
);
