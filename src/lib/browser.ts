// Browser URL utilities for OpenCode web UI

import { spawn } from "node:child_process";
import { platform } from "node:os";
import { debug } from "./debug";
import { extractErrorMessage } from "./errors";

/**
 * Encode directory path for OpenCode web UI URL
 * Uses URL-safe base64 encoding (no padding)
 */
export function encodeDirectory(directory: string): string {
  return Buffer.from(directory)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Build the full URL to open a session in the OpenCode web UI
 */
export function buildSessionUrl(
  serverUrl: string,
  directory: string,
  sessionId: string,
): string {
  const encodedDir = encodeDirectory(directory);
  return `${serverUrl}/${encodedDir}/session/${sessionId}`;
}

/**
 * Open a URL in the default browser (cross-platform)
 */
export function openInBrowser(url: string): void {
  const os = platform();
  let command = "xdg-open";
  const args = [url];

  if (os === "darwin") {
    command = "open";
  } else if (os === "win32") {
    command = "explorer";
  }

  const argPreview = args.map((arg) => JSON.stringify(arg)).join(" ");
  debug(`Opening browser: ${command} ${argPreview}`);

  try {
    const child = spawn(command, args, { detached: true, stdio: "ignore" });
    child.on("error", (error) => {
      debug(`Failed to open browser: ${error.message}`);
    });
    child.unref();
  } catch (error) {
    debug(`Failed to open browser: ${extractErrorMessage(error)}`);
  }
}
