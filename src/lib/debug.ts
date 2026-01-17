// Debug logging helper with configurable log file path

import { appendFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Check if debug mode is enabled via CLI flag or environment variable
 */
const DEBUG =
  process.argv.includes("--debug") ||
  process.env.OPENCODE_MONITOR_DEBUG === "1";

/**
 * Get the debug log file path from environment or use default
 * Default: $TMPDIR/opencode-monitor-debug.log or /tmp/opencode-monitor-debug.log
 */
function getLogPath(): string {
  if (process.env.OPENCODE_MONITOR_LOG_FILE) {
    // Expand ~ to home directory
    const path = process.env.OPENCODE_MONITOR_LOG_FILE;
    if (path.startsWith("~")) {
      return join(homedir(), path.slice(1));
    }
    return path;
  }
  return join(tmpdir(), "opencode-monitor-debug.log");
}

const LOG_PATH = getLogPath();

/**
 * Write a debug message to the log file
 * Only writes if debug mode is enabled via --debug flag or OPENCODE_MONITOR_DEBUG=1
 * @param msg - Message to log
 */
export function debug(msg: string): void {
  if (!DEBUG) return;
  try {
    appendFileSync(LOG_PATH, `[${new Date().toISOString()}] ${msg}\n`);
  } catch {
    // Silently ignore write errors
  }
}
