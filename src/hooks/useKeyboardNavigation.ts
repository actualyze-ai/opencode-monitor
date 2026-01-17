// Keyboard navigation hook for session list

import { useEffect, useRef } from "react";
import { useKeyboard } from "@opentui/react";
import type { KeyEvent } from "@opentui/core";
import { CONFIG } from "../lib/config";
import { buildSessionUrl, openInBrowser } from "../lib/browser";
import { saveCache } from "../lib/cache";
import { useSessionStore, useUIStore } from "../stores";
import type { Session, ListItem, BrowserModalState } from "../types";

export interface KeyboardNavigationOptions {
  flatItems: ListItem[];
  selectedIndex: number;
  contentHeight: number;
  onExit: () => void;
  onLaunchTUI: (request: {
    serverUrl: string;
    sessionId: string;
    sessionName: string;
  }) => void;
}

async function isServerAvailable(serverUrl: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      CONFIG.availability.checkTimeout,
    );
    const response = await fetch(serverUrl, {
      method: "HEAD",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Check server availability and show appropriate modal on failure.
 * Consolidates the repeated pattern of checking availability and showing modals.
 *
 * @param serverUrl - URL to check
 * @param serverName - Display name for error modal
 * @param modalType - Type of unavailable modal to show on failure
 * @param setBrowserModal - Modal setter function
 * @param onAvailable - Callback when server is available
 */
function checkServerAndExecute(
  serverUrl: string,
  serverName: string,
  modalType: "server-unavailable" | "tui-server-unavailable",
  setBrowserModal: (modal: BrowserModalState) => void,
  onAvailable: () => void,
): void {
  isServerAvailable(serverUrl).then((available) => {
    if (!available) {
      setBrowserModal({
        type: modalType,
        serverName,
        serverUrl,
      });
    } else {
      onAvailable();
    }
  });
}

export function getItemId(item: ListItem): string {
  return item.type === "session" ? item.node.session.id : item.serverId;
}

export function useKeyboardNavigation({
  flatItems,
  selectedIndex,
  contentHeight,
  onExit,
  onLaunchTUI,
}: KeyboardNavigationOptions): void {
  const setSelectedId = useUIStore((s) => s.setSelectedId);
  const browserModal = useUIStore((s) => s.browserModal);
  const setBrowserModal = useUIStore((s) => s.setBrowserModal);
  const toggleServerCollapsed = useUIStore((s) => s.toggleServerCollapsed);
  const toggleAllServers = useUIStore((s) => s.toggleAllServers);

  // Refs to avoid stale closures in useKeyboard callback
  const selectedIndexRef = useRef(selectedIndex);
  const flatItemsRef = useRef(flatItems);
  const contentHeightRef = useRef(contentHeight);
  const browserModalRef = useRef<BrowserModalState>(null);

  // Keep refs in sync
  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
    flatItemsRef.current = flatItems;
    contentHeightRef.current = contentHeight;
    browserModalRef.current = browserModal;
  }, [selectedIndex, flatItems, contentHeight, browserModal]);

  useKeyboard((event: KeyEvent) => {
    const currentIndex = selectedIndexRef.current;
    const currentItems = flatItemsRef.current;
    const currentHeight = contentHeightRef.current;
    const currentModal = browserModalRef.current;
    const currentServers = useSessionStore.getState().servers;
    const currentSessions = useSessionStore.getState().sessions;

    const input = event.name;
    const isReturn = event.name === "return";
    const isEscape = event.name === "escape";
    const isUpArrow = event.name === "up";
    const isDownArrow = event.name === "down";
    const isPageUp = event.name === "pageup";
    const isPageDown = event.name === "pagedown";

    // Handle modal keys first
    if (currentModal) {
      if (
        currentModal.type === "server-unavailable" ||
        currentModal.type === "tui-server-unavailable" ||
        currentModal.type === "http-disabled" ||
        currentModal.type === "http-disabled-tui"
      ) {
        if (isReturn || isEscape) {
          setBrowserModal(null);
        }
        return;
      }

      // Subagent modal
      if (input === "y" || input === "Y") {
        checkServerAndExecute(
          currentModal.server.url,
          currentModal.server.name,
          "server-unavailable",
          setBrowserModal,
          () => {
            const url = buildSessionUrl(
              currentModal.server.url,
              currentModal.parentSession.directory || "",
              currentModal.parentSession.originalId,
            );
            openInBrowser(url);
            setBrowserModal(null);
          },
        );
      } else if (input === "n" || input === "N" || isEscape) {
        setBrowserModal(null);
      }
      return;
    }

    if (input === "q") {
      const currentCollapsed = useUIStore.getState().collapsedServers;
      saveCache(currentServers, currentSessions, currentCollapsed);
      onExit();
    } else if (isUpArrow || input === "k") {
      const newIdx = currentIndex - 1;
      if (newIdx >= 0) {
        const newItem = currentItems[newIdx];
        if (newItem) setSelectedId(getItemId(newItem));
      }
    } else if (isDownArrow || input === "j") {
      const newIdx = currentIndex + 1;
      if (newIdx < currentItems.length) {
        const newItem = currentItems[newIdx];
        if (newItem) setSelectedId(getItemId(newItem));
      }
    } else if (isPageUp) {
      const newIdx = Math.max(0, currentIndex - currentHeight);
      if (newIdx < currentItems.length) {
        const newItem = currentItems[newIdx];
        if (newItem) setSelectedId(getItemId(newItem));
      }
    } else if (isPageDown) {
      const newIdx = Math.min(
        currentItems.length - 1,
        currentIndex + currentHeight,
      );
      if (newIdx < currentItems.length) {
        const newItem = currentItems[newIdx];
        if (newItem) setSelectedId(getItemId(newItem));
      }
    } else if (input === "G") {
      // Jump to last item
      const newIdx = currentItems.length - 1;
      if (newIdx >= 0) {
        const newItem = currentItems[newIdx];
        if (newItem) setSelectedId(getItemId(newItem));
      }
    } else if (input === "g") {
      // Jump to first item
      if (currentItems.length > 0) {
        const newItem = currentItems[0];
        if (newItem) setSelectedId(getItemId(newItem));
      }
    } else if (input === "c" || input === "C") {
      // Toggle all server groups (collapse if any expanded, expand if all collapsed)
      const allServerIds = Array.from(
        new Set(
          currentItems.map((item) =>
            item.type === "group" ? item.serverId : item.node.session.serverId,
          ),
        ),
      );
      toggleAllServers(allServerIds);
    } else if (input === "t" || input === "T" || isReturn) {
      const item = currentItems[currentIndex];
      // Only act on sessions, not server group headers
      if (item?.type === "session") {
        const session = item.node.session;
        const server = currentServers.get(session.serverId);

        if (server?.pending) return;

        const serverName = server?.name || "Unknown server";
        const serverUrl = server?.url || "";

        // Check if HTTP server is disabled
        if (serverUrl === "disabled") {
          setBrowserModal({
            type: "http-disabled-tui",
            serverName,
          });
          return;
        }

        checkServerAndExecute(
          serverUrl,
          serverName,
          "tui-server-unavailable",
          setBrowserModal,
          () => {
            const currentCollapsed = useUIStore.getState().collapsedServers;
            saveCache(currentServers, currentSessions, currentCollapsed);
            onLaunchTUI({
              serverUrl,
              sessionId: session.originalId,
              sessionName: session.name,
            });
          },
        );
      }
    } else if (input === "b" || input === "B") {
      const item = currentItems[currentIndex];
      // Only act on sessions, not server group headers
      if (item?.type === "session") {
        const session = item.node.session;
        const server = currentServers.get(session.serverId);

        if (server?.pending) return;
        if (!server?.url || !session.directory) return;

        // Check if HTTP server is disabled
        if (server.url === "disabled") {
          setBrowserModal({
            type: "http-disabled",
            serverName: server.name,
          });
          return;
        }

        if (session.parentId) {
          const parentSession = Array.from(currentSessions.values()).find(
            (s: Session) =>
              s.originalId === session.parentId &&
              s.serverId === session.serverId,
          );
          if (parentSession) {
            setBrowserModal({
              type: "subagent",
              subagentName: session.name,
              parentSession,
              server,
            });
          }
        } else {
          const directory = session.directory;
          checkServerAndExecute(
            server.url,
            server.name,
            "server-unavailable",
            setBrowserModal,
            () => {
              const url = buildSessionUrl(
                server.url,
                directory,
                session.originalId,
              );
              openInBrowser(url);
            },
          );
        }
      }
    } else if (input === "space") {
      // Space key - toggle server collapse/expand
      const item = currentItems[currentIndex];
      if (item?.type === "group") {
        toggleServerCollapsed(item.serverId);
      }
    }
  });
}
