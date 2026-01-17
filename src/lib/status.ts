/**
 * Status mapping utilities for OpenCode session states
 */

import type { Session } from "../types";

/**
 * Map SDK status type string to Session status enum
 * @param statusType - Raw status type from SDK (e.g., "busy", "idle")
 * @returns Normalized Session status
 */
export function mapStatusType(
  statusType: string | undefined,
): Session["status"] {
  switch (statusType) {
    case "busy":
      return "busy";
    case "retry":
      return "retry";
    case "waiting_for_permission":
      return "waiting_for_permission";
    case "completed":
      return "completed";
    case "error":
      return "error";
    case "aborted":
      return "aborted";
    default:
      return "idle";
  }
}
