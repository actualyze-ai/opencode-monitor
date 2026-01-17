// Desktop notification system with clickable URLs

import notifier from "node-notifier";
import { debug } from "./debug";
import { buildSessionUrl } from "./browser";

/**
 * Notification type determines title, sound, and timeout
 */
export type NotificationType = "complete" | "permission";

interface NotificationConfig {
  title: string;
  sound: boolean | string;
  timeout: number;
}

const NOTIFICATION_CONFIGS: Record<NotificationType, NotificationConfig> = {
  complete: {
    title: "Session Complete",
    sound: true,
    timeout: 5, // 5 seconds before auto-dismiss
  },
  permission: {
    title: "Permission Required",
    sound: "Basso",
    timeout: 300, // 5 minutes max to prevent accumulation
  },
};

/**
 * Send a session notification. Clicking opens the session in the browser.
 */
function notify(
  type: NotificationType,
  sessionName: string,
  serverName: string,
  serverUrl: string,
  sessionId: string,
  directory: string,
): void {
  const config = NOTIFICATION_CONFIGS[type];
  debug(`notify[${type}]: ${sessionName} on ${serverName}`);

  const url = buildSessionUrl(serverUrl, directory, sessionId);
  debug(`  URL: ${url}`);

  notifier.notify({
    title: config.title,
    message: `${sessionName}\n${serverName}`,
    sound: config.sound,
    open: url, // Opens browser on click
    wait: true, // Enable click handling
    timeout: config.timeout,
  });
}

/**
 * Send notification when a session completes (busy -> idle)
 * Clicking opens the session in the browser
 */
export function notifySessionComplete(
  sessionName: string,
  serverName: string,
  serverUrl: string,
  sessionId: string,
  directory: string,
): void {
  notify("complete", sessionName, serverName, serverUrl, sessionId, directory);
}

/**
 * Send notification when a session needs permission approval
 * Clicking opens the session in the browser
 */
export function notifyPermissionRequired(
  sessionName: string,
  serverName: string,
  serverUrl: string,
  sessionId: string,
  directory: string,
): void {
  notify(
    "permission",
    sessionName,
    serverName,
    serverUrl,
    sessionId,
    directory,
  );
}
