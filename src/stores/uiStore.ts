// Zustand store for UI state management

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { Session, BrowserModalState } from "../types";

// Re-export for backwards compatibility
export type { BrowserModalState } from "../types";

export interface PendingLaunchRequest {
  serverUrl: string;
  sessionId: string;
  sessionName: string;
}

export interface UIStore {
  // Selection state
  selectedId: string | null;
  scrollOffset: number;

  // Modal state
  browserModal: BrowserModalState;

  // Detailed session (fetched on selection)
  detailedSession: Session | null;

  // Collapsed server groups (Set of serverIds)
  collapsedServers: Set<string>;

  // Pending TUI launch request (for attach flow)
  pendingLaunchRequest: PendingLaunchRequest | null;

  // Actions
  setSelectedId: (id: string | null) => void;
  setScrollOffset: (offset: number) => void;
  setBrowserModal: (modal: BrowserModalState) => void;
  setDetailedSession: (session: Session | null) => void;
  toggleServerCollapsed: (serverId: string) => void;
  setCollapsedServers: (serverIds: Set<string>) => void;
  toggleAllServers: (allServerIds: string[]) => void;
  setPendingLaunchRequest: (request: PendingLaunchRequest | null) => void;
  consumePendingLaunchRequest: () => PendingLaunchRequest | null;

  // Reset
  reset: () => void;
}

export const useUIStore = create<UIStore>()(
  devtools(
    (set, get) => ({
      selectedId: null,
      scrollOffset: 0,
      browserModal: null,
      detailedSession: null,
      collapsedServers: new Set<string>(),
      pendingLaunchRequest: null,

      setSelectedId: (id) => set({ selectedId: id }),
      setScrollOffset: (offset) => set({ scrollOffset: offset }),
      setBrowserModal: (modal) => set({ browserModal: modal }),
      setDetailedSession: (session) => set({ detailedSession: session }),

      toggleServerCollapsed: (serverId) =>
        set((state) => {
          const newCollapsed = new Set(state.collapsedServers);
          if (newCollapsed.has(serverId)) {
            newCollapsed.delete(serverId);
          } else {
            newCollapsed.add(serverId);
          }
          return { collapsedServers: newCollapsed };
        }),

      setCollapsedServers: (serverIds) =>
        set({ collapsedServers: new Set(serverIds) }),

      toggleAllServers: (allServerIds) =>
        set((state) => {
          // If any server is expanded, collapse all. Otherwise expand all.
          const anyExpanded = allServerIds.some(
            (id) => !state.collapsedServers.has(id),
          );
          return {
            collapsedServers: anyExpanded ? new Set(allServerIds) : new Set(),
          };
        }),

      setPendingLaunchRequest: (request) =>
        set({ pendingLaunchRequest: request }),

      consumePendingLaunchRequest: () => {
        const request = get().pendingLaunchRequest;
        set({ pendingLaunchRequest: null });
        return request;
      },

      reset: () =>
        set({
          selectedId: null,
          scrollOffset: 0,
          browserModal: null,
          detailedSession: null,
          collapsedServers: new Set<string>(),
          pendingLaunchRequest: null,
        }),
    }),
    { name: "ui-store" },
  ),
);
