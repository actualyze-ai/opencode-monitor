// Hook for WebSocket server management

import { useEffect, useRef } from "react";
import { CONFIG } from "../lib/config";
import { MonitorWSServer } from "../lib/ws-server";
import { createWSClient } from "../lib/ws-sdk";
import {
  fetchSessionsWS,
  fetchSessionDetailsWS,
  clearProviderCache,
} from "../lib/http";
import { filterToCurrentSessionTree } from "../lib/session-filter";
import { getSessionId } from "../lib/keys";
import { notifySessionComplete, notifyPermissionRequired } from "../lib/notify";
import { debug } from "../lib/debug";
import { mapStatusType } from "../lib/status";
import { useSessionStore, useConnectionStore } from "../stores";
import type { Server, Session } from "../types";
import {
  type ServerMetadata,
  type SDKEvent,
  isSessionStatusEvent,
  isPermissionUpdatedEvent,
} from "../lib/ws-types";

export interface UseWebSocketOptions {
  port: number;
  notificationsEnabled: boolean;
  initialServers?: Map<string, Server> | undefined;
  initialSessions?: Map<string, Session> | undefined;
}

export function useWebSocket({
  port,
  notificationsEnabled,
  initialServers,
  initialSessions,
}: UseWebSocketOptions): void {
  const sessionFetchInFlightRef = useRef<Map<string, boolean>>(new Map());
  const lastSessionFetchTimeRef = useRef<Map<string, number>>(new Map());
  const pendingDisconnectTimersRef = useRef<Map<string, NodeJS.Timeout>>(
    new Map(),
  );

  // Initialize stores with cached data
  useEffect(() => {
    if (initialServers) {
      for (const [id, server] of initialServers) {
        useSessionStore.getState().setServer(id, { ...server, pending: true });
      }
    }
    if (initialSessions) {
      for (const [id, session] of initialSessions) {
        useSessionStore.getState().setSession(id, session);
      }
    }
  }, []);

  useEffect(() => {
    debug(
      `[WS] useEffect running - port=${port}, notificationsEnabled=${notificationsEnabled}`,
    );
    const wsServer = new MonitorWSServer(port);
    useConnectionStore.getState().setWsServer(wsServer);

    wsServer.on(
      "client_connected",
      async (serverId: string, metadata: ServerMetadata) => {
        debug(`[WS] Client connected: ${serverId} (${metadata.serverName})`);

        // Cancel pending disconnect timer
        const pendingTimer = pendingDisconnectTimersRef.current.get(serverId);
        if (pendingTimer) {
          debug(
            `[WS] Cancelling pending disconnect for ${serverId} - reconnected`,
          );
          clearTimeout(pendingTimer);
          pendingDisconnectTimersRef.current.delete(serverId);
        }

        const server: Server = {
          id: serverId,
          name: metadata.serverName,
          url: metadata.serverUrl || "",
          lastSeen: Date.now(),
        };
        if (metadata.project) server.project = metadata.project;
        if (metadata.branch) server.branch = metadata.branch;

        useSessionStore.getState().setServer(serverId, server);

        const wsClient = createWSClient(wsServer, serverId);
        useConnectionStore.getState().setWsClient(serverId, wsClient);

        debug(`[WS] Fetching sessions from ${metadata.serverName}`);
        const serverSessions = await fetchSessionsWS(wsClient, serverId);
        debug(
          `[WS] Fetched ${serverSessions.length} sessions from ${metadata.serverName}`,
        );

        if (!useConnectionStore.getState().wsClients.has(serverId)) return;

        const visibleSessions = filterToCurrentSessionTree(serverSessions);
        const detailResults = await Promise.all(
          visibleSessions.map((s) =>
            fetchSessionDetailsWS(wsClient, serverId, s.originalId).catch(
              () => null,
            ),
          ),
        );

        if (!useConnectionStore.getState().wsClients.has(serverId)) return;

        // Clear stale sessions and add new ones
        useSessionStore.getState().removeSessionsByServer(serverId);
        useSessionStore.getState().setSessions(serverSessions);

        // Merge in details
        for (const details of detailResults) {
          if (details) {
            useSessionStore.getState().updateSession(details.id, details);
          }
        }
      },
    );

    wsServer.on("client_disconnected", (serverId: string) => {
      debug(`[WS] Client disconnected: ${serverId} - starting grace period`);

      useConnectionStore.getState().removeWsClient(serverId);
      clearProviderCache(serverId);

      const existingTimer = pendingDisconnectTimersRef.current.get(serverId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(() => {
        pendingDisconnectTimersRef.current.delete(serverId);

        if (useConnectionStore.getState().wsClients.has(serverId)) {
          debug(
            `[WS] Server ${serverId} reconnected during grace period - skipping removal`,
          );
          return;
        }

        debug(`[WS] Grace period expired for ${serverId} - removing`);
        useSessionStore.getState().removeServer(serverId);
        useSessionStore.getState().removeSessionsByServer(serverId);
      }, CONFIG.debounce.disconnect);

      pendingDisconnectTimersRef.current.set(serverId, timer);
    });

    // Event handler map for cleaner dispatch
    const eventHandlers: Record<
      string,
      (serverId: string, event: SDKEvent) => void
    > = {
      "session.status": (serverId, event) =>
        handleStatusEvent(serverId, event, notificationsEnabled),
      "permission.updated": (serverId, event) =>
        handlePermissionEvent(serverId, event, notificationsEnabled),
      "session.created": (serverId) =>
        handleSessionCreatedEvent(
          serverId,
          sessionFetchInFlightRef.current,
          lastSessionFetchTimeRef.current,
        ),
      "session.deleted": handleSessionDeletedEvent,
    };

    wsServer.on("event", (serverId: string, event: SDKEvent) => {
      debug(`[WS] Event from ${serverId}: ${event.type}`);
      const handler = eventHandlers[event.type];
      if (handler) {
        handler(serverId, event);
      }
    });

    wsServer.start().catch((err) => {
      debug(`[WS] Failed to start server: ${err.message}`);
    });

    // Cleanup pending servers after timeout
    const pendingCleanupTimer = setTimeout(() => {
      const { servers, removeServer, removeSessionsByServer } =
        useSessionStore.getState();
      const pendingServerIds = new Set<string>();

      for (const [id, server] of servers) {
        if (server.pending) {
          pendingServerIds.add(id);
        }
      }

      if (pendingServerIds.size === 0) return;

      debug(`[WS] Removing ${pendingServerIds.size} stale cached server(s)`);

      for (const id of pendingServerIds) {
        removeServer(id);
        removeSessionsByServer(id);
      }
    }, CONFIG.lifecycle.pendingServerTimeout);

    return () => {
      debug(`[WS] useEffect cleanup running - stopping WebSocket server`);
      clearTimeout(pendingCleanupTimer);

      for (const timer of pendingDisconnectTimersRef.current.values()) {
        clearTimeout(timer);
      }
      pendingDisconnectTimersRef.current.clear();

      wsServer.removeAllListeners();
      wsServer.stop();
      useConnectionStore.getState().clearWsClients();
      useConnectionStore.getState().setWsServer(null);
    };
  }, [port, notificationsEnabled]);
}

function handleStatusEvent(
  serverId: string,
  event: SDKEvent,
  notificationsEnabled: boolean,
): void {
  if (!isSessionStatusEvent(event)) {
    debug(`  Invalid session.status event structure`);
    return;
  }

  const { sessionID, status } = event.properties;
  const newStatus = mapStatusType(status.type);

  const { sessions, servers } = useSessionStore.getState();

  const sessionKey = Array.from(sessions.keys()).find(
    (key) =>
      getSessionId(key) === sessionID &&
      sessions.get(key)?.serverId === serverId,
  );

  if (!sessionKey) {
    debug(`  Session not found for status update: ${sessionID}`);
    return;
  }

  const existingSession = sessions.get(sessionKey);
  if (!existingSession || existingSession.status === newStatus) {
    return;
  }

  debug(
    `  Status transition: ${existingSession.status} -> ${newStatus} for session ${existingSession.name}`,
  );

  const isCompletion = newStatus === "idle" || newStatus === "completed";
  if (
    notificationsEnabled &&
    isCompletion &&
    (existingSession.status === "busy" || existingSession.status === "retry")
  ) {
    const server = servers.get(existingSession.serverId);
    const serverName = server?.name || "Unknown server";
    // Don't include URL if HTTP server is disabled (would create malformed URLs)
    const serverUrl =
      server?.url && server.url !== "disabled" ? server.url : "";
    debug(`  TRIGGERING completion notification for ${existingSession.name}`);
    notifySessionComplete(
      existingSession.name,
      serverName,
      serverUrl,
      existingSession.originalId,
      existingSession.directory || "",
    );
  }

  useSessionStore.getState().updateSession(sessionKey, {
    status: newStatus,
    statusUpdatedAt: Date.now(),
    lastActivity: Date.now(),
  });
}

function handlePermissionEvent(
  serverId: string,
  event: SDKEvent,
  notificationsEnabled: boolean,
): void {
  if (!isPermissionUpdatedEvent(event)) {
    debug(`  Invalid permission.updated event structure`);
    return;
  }

  const { sessionID } = event.properties;

  if (!notificationsEnabled) return;

  const { sessions, servers } = useSessionStore.getState();

  for (const [key, session] of sessions) {
    if (getSessionId(key) === sessionID && session.serverId === serverId) {
      const server = servers.get(session.serverId);
      const serverName = server?.name || "Unknown server";
      // Don't include URL if HTTP server is disabled (would create malformed URLs)
      const serverUrl =
        server?.url && server.url !== "disabled" ? server.url : "";
      debug(`  TRIGGERING permission notification for ${session.name}`);
      notifyPermissionRequired(
        session.name,
        serverName,
        serverUrl,
        session.originalId,
        session.directory || "",
      );

      useSessionStore.getState().updateSession(key, {
        status: "waiting_for_permission",
        statusUpdatedAt: Date.now(),
        lastActivity: Date.now(),
      });
      break;
    }
  }
}

function handleSessionCreatedEvent(
  serverId: string,
  inFlight: Map<string, boolean>,
  lastFetchTime: Map<string, number>,
): void {
  const wsClient = useConnectionStore.getState().wsClients.get(serverId);
  if (!wsClient) return;

  const lastFetch = lastFetchTime.get(serverId) || 0;
  const now = Date.now();

  if (now - lastFetch < CONFIG.debounce.sessionFetch) {
    debug(`[WS] Debouncing session.created for ${serverId}`);
    return;
  }

  if (inFlight.get(serverId)) {
    debug(`[WS] Skipping session.created for ${serverId} (fetch in flight)`);
    return;
  }

  lastFetchTime.set(serverId, now);
  inFlight.set(serverId, true);

  fetchSessionsWS(wsClient, serverId)
    .then(async (serverSessions) => {
      if (!useConnectionStore.getState().wsClients.has(serverId)) return;
      useSessionStore.getState().mergeSessions(serverSessions);

      // Fetch details for all visible sessions so new children have context data
      const visibleSessions = filterToCurrentSessionTree(serverSessions);
      debug(
        `[WS] Fetching details for ${visibleSessions.length} visible sessions after session.created`,
      );

      const detailResults = await Promise.all(
        visibleSessions.map((s) =>
          fetchSessionDetailsWS(wsClient, serverId, s.originalId).catch(
            () => null,
          ),
        ),
      );

      if (!useConnectionStore.getState().wsClients.has(serverId)) return;

      for (const details of detailResults) {
        if (details) {
          useSessionStore.getState().updateSession(details.id, details);
        }
      }
    })
    .finally(() => {
      inFlight.set(serverId, false);
    });
}

function handleSessionDeletedEvent(serverId: string, event: SDKEvent): void {
  const props = event.properties as { info: { id: string } };
  const { info } = props;

  const { sessions, removeSession } = useSessionStore.getState();

  for (const [key, session] of sessions) {
    if (session.originalId === info.id && session.serverId === serverId) {
      removeSession(key);
      break;
    }
  }
}
