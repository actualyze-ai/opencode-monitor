// Zustand store for session and server state management

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { Server, Session } from "../types";

export interface SessionStore {
  // State
  servers: Map<string, Server>;
  sessions: Map<string, Session>;

  // Actions
  setServer: (serverId: string, server: Server) => void;
  removeServer: (serverId: string) => void;
  updateServerLastSeen: (serverId: string) => void;

  setSession: (sessionId: string, session: Session) => void;
  updateSession: (sessionId: string, updates: Partial<Session>) => void;
  removeSession: (sessionId: string) => void;
  removeSessionsByServer: (serverId: string) => void;

  // Batch operations
  setSessions: (sessions: Session[]) => void;
  mergeSessions: (sessions: Session[]) => void;

  // Reset
  reset: () => void;
}

export const useSessionStore = create<SessionStore>()(
  devtools(
    (set) => ({
      servers: new Map(),
      sessions: new Map(),

      setServer: (serverId, server) =>
        set((state) => {
          const servers = new Map(state.servers);
          servers.set(serverId, server);
          return { servers };
        }),

      removeServer: (serverId) =>
        set((state) => {
          const servers = new Map(state.servers);
          servers.delete(serverId);
          return { servers };
        }),

      updateServerLastSeen: (serverId) =>
        set((state) => {
          const servers = new Map(state.servers);
          const server = servers.get(serverId);
          if (server) {
            servers.set(serverId, { ...server, lastSeen: Date.now() });
          }
          return { servers };
        }),

      setSession: (sessionId, session) =>
        set((state) => {
          const sessions = new Map(state.sessions);
          sessions.set(sessionId, session);
          return { sessions };
        }),

      updateSession: (sessionId, updates) =>
        set((state) => {
          const sessions = new Map(state.sessions);
          const existing = sessions.get(sessionId);
          if (existing) {
            sessions.set(sessionId, { ...existing, ...updates });
          }
          return { sessions };
        }),

      removeSession: (sessionId) =>
        set((state) => {
          const sessions = new Map(state.sessions);
          sessions.delete(sessionId);
          return { sessions };
        }),

      removeSessionsByServer: (serverId) =>
        set((state) => {
          const sessions = new Map(state.sessions);
          for (const [id, session] of sessions) {
            if (session.serverId === serverId) {
              sessions.delete(id);
            }
          }
          return { sessions };
        }),

      setSessions: (newSessions) =>
        set((state) => {
          const sessions = new Map(state.sessions);
          for (const session of newSessions) {
            sessions.set(session.id, session);
          }
          return { sessions };
        }),

      mergeSessions: (newSessions) =>
        set((state) => {
          const sessions = new Map(state.sessions);
          for (const session of newSessions) {
            const existing = sessions.get(session.id);
            sessions.set(session.id, { ...existing, ...session });
          }
          return { sessions };
        }),

      reset: () =>
        set({
          servers: new Map(),
          sessions: new Map(),
        }),
    }),
    { name: "session-store" },
  ),
);
