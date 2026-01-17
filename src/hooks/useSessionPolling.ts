// Hook for periodic session polling with separate fast/slow intervals

import { useEffect, useRef } from "react";
import { CONFIG } from "../lib/config";
import { fetchSessionsWS, fetchSessionDetailsWS } from "../lib/http";
import { filterToCurrentSessionTree } from "../lib/session-filter";
import { calculateChildCounts } from "../lib/tree";
import { debug } from "../lib/debug";
import { extractErrorMessage } from "../lib/errors";
import { useSessionStore, useConnectionStore } from "../stores";

export function useSessionPolling(): void {
  const lastDetailsFetchRef = useRef<number>(0);
  const statusInFlightRef = useRef(false);
  const detailsInFlightRef = useRef(false);

  useEffect(() => {
    const refreshStatus = async () => {
      if (statusInFlightRef.current) {
        debug("[Polling] Skipping status refresh (in flight)");
        return;
      }

      statusInFlightRef.current = true;
      try {
        const { servers, sessions, mergeSessions, updateSession } =
          useSessionStore.getState();
        const { wsClients } = useConnectionStore.getState();

        if (servers.size === 0) return;

        // Fetch from all servers in parallel
        const serverResults = await Promise.all(
          Array.from(servers.keys()).map(async (serverId) => {
            const wsClient = wsClients.get(serverId);
            if (!wsClient) return [];

            try {
              const serverSessions = await fetchSessionsWS(wsClient, serverId);

              if (!useConnectionStore.getState().wsClients.has(serverId)) {
                debug(`[Polling] Skipping stale status update for ${serverId}`);
                return [];
              }

              return serverSessions;
            } catch (err: unknown) {
              debug(
                `[WS] Error refreshing status for ${serverId}: ${extractErrorMessage(err)}`,
              );
              return [];
            }
          }),
        );

        const allServerSessions = serverResults.flat();

        if (allServerSessions.length > 0) {
          // Preserve detail fields when merging
          for (const s of allServerSessions) {
            const existing = sessions.get(s.id);
            if (existing) {
              mergeSessions([
                {
                  ...s,
                  contextUsed: existing.contextUsed,
                  contextLimit: existing.contextLimit,
                  tokenBreakdown: existing.tokenBreakdown,
                  cost: existing.cost,
                  messageCount: existing.messageCount,
                  model: existing.model,
                  childCount: existing.childCount,
                },
              ]);
            } else {
              mergeSessions([s]);
            }
          }

          // Calculate child counts
          const updatedSessions = useSessionStore.getState().sessions;
          const childCounts = calculateChildCounts(updatedSessions);

          for (const [id, session] of updatedSessions) {
            const key = `${session.serverId}:${session.originalId}`;
            const count = childCounts.get(key);
            if (count && count > 0) {
              updateSession(id, { childCount: count });
            } else if (session.childCount !== undefined) {
              updateSession(id, { childCount: undefined });
            }
          }
        }
      } finally {
        statusInFlightRef.current = false;
      }
    };

    const refreshDetails = async () => {
      if (detailsInFlightRef.current) {
        debug("[Polling] Skipping details refresh (in flight)");
        return;
      }

      detailsInFlightRef.current = true;
      try {
        const { servers, updateSession } = useSessionStore.getState();
        const { wsClients } = useConnectionStore.getState();

        if (servers.size === 0) return;

        lastDetailsFetchRef.current = Date.now();
        debug("[Polling] Starting details refresh");

        // Fetch details from all servers in parallel
        await Promise.all(
          Array.from(servers.keys()).map(async (serverId) => {
            const wsClient = wsClients.get(serverId);
            if (!wsClient) return;

            try {
              const serverSessions = await fetchSessionsWS(wsClient, serverId);
              const visibleSessions =
                filterToCurrentSessionTree(serverSessions);

              const detailResults = await Promise.all(
                visibleSessions.map((s) =>
                  fetchSessionDetailsWS(wsClient, serverId, s.originalId).then(
                    (details) => {
                      if (
                        !useConnectionStore.getState().wsClients.has(serverId)
                      )
                        return null;
                      return details;
                    },
                  ),
                ),
              );

              for (const details of detailResults) {
                if (details) {
                  updateSession(details.id, details);
                }
              }
            } catch (err: unknown) {
              debug(
                `[WS] Error refreshing details for ${serverId}: ${extractErrorMessage(err)}`,
              );
            }
          }),
        );

        debug("[Polling] Details refresh complete");
      } finally {
        detailsInFlightRef.current = false;
      }
    };

    const statusTimer = setInterval(
      refreshStatus,
      CONFIG.polling.statusInterval,
    );
    const detailsTimer = setInterval(
      refreshDetails,
      CONFIG.polling.detailsInterval,
    );
    const initialDetailsTimer = setTimeout(
      refreshDetails,
      CONFIG.polling.initialDetailsDelay,
    );

    return () => {
      clearInterval(statusTimer);
      clearInterval(detailsTimer);
      clearTimeout(initialDetailsTimer);
    };
  }, []);
}
