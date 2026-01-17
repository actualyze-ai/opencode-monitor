// opencode-monitor.js - OpenCode plugin for session monitoring
//
// This plugin connects to the OpenCode Monitor TUI via WebSocket
// and acts as a reverse proxy for SDK requests.
//
// Install: Copy or symlink to ~/.config/opencode/plugin/
// Configure: Set OPENCODE_MONITOR_HOST to your TUI's IP address
//
// Environment variables:
//   OPENCODE_MONITOR_HOST  - IP address of machine running the monitor TUI (default: 127.0.0.1)
//   OPENCODE_MONITOR_PORT  - WebSocket port (default: 41235)
//   OPENCODE_MONITOR_TOKEN - Shared token for monitor authentication (optional)
//   OPENCODE_SERVER_URL    - Full URL override for this OpenCode server (e.g., https://myserver.com:8443)
//                            Takes precedence over all other server settings
//   OPENCODE_SERVER_HOST   - IP/hostname to advertise for this server (default: auto-detect from WS connection)
//                            Set this when the TUI runs on a different machine
//   OPENCODE_SERVER_PORT   - Port override for this OpenCode server
//                            Use when behind NAT/port forwarding where external port differs from internal
//   OPENCODE_MONITOR_DEBUG - Set to "1" to enable debug logging

import { execSync } from "node:child_process";
import { basename, join } from "node:path";
import { hostname, tmpdir } from "node:os";
import { appendFileSync } from "node:fs";
import { WebSocket } from "ws";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const HOST = process.env.OPENCODE_MONITOR_HOST || "127.0.0.1";
const PORT = parseInt(process.env.OPENCODE_MONITOR_PORT, 10) || 41235;

// Server URL override - takes precedence over all other server settings
const SERVER_URL_OVERRIDE = process.env.OPENCODE_SERVER_URL || null;

// SERVER_HOST can be:
// - Not set or "auto" → TUI will use the remote address from the WebSocket connection
// - An explicit IP → used as-is (e.g., "127.0.0.1" for local-only)
const SERVER_HOST_ENV = process.env.OPENCODE_SERVER_HOST;
const SERVER_HOST =
  !SERVER_HOST_ENV || SERVER_HOST_ENV.toLowerCase() === "auto"
    ? "AUTO"
    : SERVER_HOST_ENV;

// SERVER_PORT override - use when behind NAT/port forwarding
const SERVER_PORT_OVERRIDE = process.env.OPENCODE_SERVER_PORT
  ? parseInt(process.env.OPENCODE_SERVER_PORT, 10)
  : null;

const DEBUG = process.env.OPENCODE_MONITOR_DEBUG === "1";
const LOG_FILE =
  process.env.OPENCODE_PLUGIN_LOG_FILE || join(tmpdir(), "opencode-plugin.log");
const AUTH_TOKEN = process.env.OPENCODE_MONITOR_TOKEN;

// Reconnection settings
const RECONNECT_INITIAL_DELAY = 1000; // 1 second
const RECONNECT_MAX_DELAY = 10000; // 10 seconds
const RECONNECT_MULTIPLIER = 1.5;

function debug(...args) {
  if (DEBUG) console.error("[opencode-monitor]", ...args);
}

function log(message) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;
  if (DEBUG) console.error(line.trim());
  try {
    appendFileSync(LOG_FILE, line);
  } catch {
    // Ignore file write errors
  }
}

function getGitBranch(cwd) {
  try {
    return (
      execSync("git rev-parse --abbrev-ref HEAD", {
        cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      })
        .trim()
        .split("\n")
        .pop() || null
    );
  } catch {
    return null;
  }
}

/**
 * Discover the OpenCode server URL via lsof
 *
 * Priority:
 * 1. OPENCODE_SERVER_URL - Full URL override (highest priority, no health check)
 * 2. OPENCODE_SERVER_PORT + OPENCODE_SERVER_HOST - Partial override (no health check)
 * 3. lsof detection + OPENCODE_SERVER_HOST - Auto-detect port (requires health check)
 *
 * Returns { url: string, needsHealthCheck: boolean }
 * url is "disabled" if no HTTP server is detected.
 */
function discoverServerUrl() {
  // 1. Full URL override takes precedence - trust the user
  if (SERVER_URL_OVERRIDE) {
    debug(`Using server URL override: ${SERVER_URL_OVERRIDE}`);
    return {
      url: SERVER_URL_OVERRIDE.replace(/\/$/, ""),
      needsHealthCheck: false,
    };
  }

  // 2. If port is overridden, use it with SERVER_HOST - trust the user
  if (SERVER_PORT_OVERRIDE) {
    const url = `http://${SERVER_HOST}:${SERVER_PORT_OVERRIDE}`;
    debug(`Using server port override: ${url}`);
    return { url, needsHealthCheck: false };
  }

  // 3. Auto-detect port via lsof - needs health check to verify
  try {
    const output = execSync(
      `lsof -iTCP -sTCP:LISTEN -a -p ${process.pid} -Fn -P 2>/dev/null`,
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    );

    // Parse lsof output to find port (format: "n*:PORT" or "n127.0.0.1:PORT")
    const portMatch = output.match(/n[^:]*:(\d+)/);
    if (portMatch) {
      const port = portMatch[1];
      const url = `http://${SERVER_HOST}:${port}`;
      debug(`Discovered server URL via lsof: ${url}`);
      return { url, needsHealthCheck: true };
    }
  } catch {
    // lsof failed or no listening port found
  }

  // No server URL found - HTTP server is not enabled
  return { url: "disabled", needsHealthCheck: false };
}

/**
 * Check if the server URL is actually responding
 * @param {string} url - The server URL to check (may contain "AUTO")
 * @returns {Promise<boolean>} - True if server is healthy
 */
async function checkServerHealth(url) {
  // For health check, use localhost since AUTO isn't a real host
  const checkUrl = url.replace("AUTO", "127.0.0.1");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 500);

    const response = await fetch(`${checkUrl}/global/health`, {
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      if (data.healthy === true) {
        debug(`Health check passed for ${checkUrl}`);
        return true;
      }
    }
  } catch (err) {
    debug(`Health check failed for ${checkUrl}: ${err.message}`);
  }

  return false;
}

// ---------------------------------------------------------------------------
// SDK Call Router
// ---------------------------------------------------------------------------

/**
 * Route an RPC method call to the SDK client
 */
async function routeSDKCall(client, method, params) {
  const parts = method.split(".");
  if (parts.length !== 2) {
    throw new Error(`Invalid method format: ${method}`);
  }

  const [namespace, action] = parts;
  const sdk = client[namespace];

  if (!sdk || typeof sdk[action] !== "function") {
    throw new Error(`Unknown method: ${method}`);
  }

  debug(`Routing SDK call: ${method}`, params);
  const result = await sdk[action](params);
  return result.data;
}

// ---------------------------------------------------------------------------
// Plugin export
// ---------------------------------------------------------------------------

export const OpencodeMonitor = async ({ project, directory, client }) => {
  const serverId = `${hostname()}-${process.pid}`;
  const dirName = basename(directory);
  const branch = getGitBranch(directory);
  const serverName = project?.name || dirName;

  // Discover the OpenCode server URL for attach/browser functionality
  // Retry a few times since the server may not be listening immediately
  let serverUrl = "disabled";
  for (let i = 0; i < 5 && serverUrl === "disabled"; i++) {
    const { url: candidateUrl, needsHealthCheck } = discoverServerUrl();

    if (candidateUrl !== "disabled") {
      if (!needsHealthCheck) {
        // User override - trust it without health check
        serverUrl = candidateUrl;
      } else {
        // Auto-detected - verify the server is actually responding
        const isHealthy = await checkServerHealth(candidateUrl);
        if (isHealthy) {
          serverUrl = candidateUrl;
        } else {
          debug(`Server at ${candidateUrl} not healthy yet, retrying...`);
        }
      }
    }

    if (serverUrl === "disabled" && i < 4) {
      // Wait a bit before retrying
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  log(
    `Plugin started for ${serverName} (PID: ${process.pid}, URL: ${serverUrl || "unknown"})`,
  );
  debug(`Connecting to: ws://${HOST}:${PORT}`);

  let ws = null;
  let reconnectDelay = RECONNECT_INITIAL_DELAY;
  let reconnectTimer = null;
  let shuttingDown = false;

  /**
   * Send a message to the TUI
   */
  function send(msg) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }

  /**
   * Send hello message with server metadata
   */
  function sendHello() {
    const hello = {
      type: "hello",
      serverId,
      serverName,
      serverUrl, // Include server URL for attach/browser functionality
      project: project?.name,
      branch,
      directory,
      authToken: AUTH_TOKEN,
    };
    if (send(hello)) {
      log(`Sent hello: ${serverName} @ ${serverUrl || "unknown"}`);
    }
  }

  /**
   * Send goodbye message
   */
  function sendGoodbye() {
    send({ type: "goodbye" });
    log("Sent goodbye");
  }

  /**
   * Handle incoming RPC request from TUI
   */
  async function handleRPCRequest(msg) {
    const { id, method, params } = msg;
    debug(`RPC request ${id}: ${method}`);

    try {
      const result = await routeSDKCall(client, method, params);
      send({ id, result });
      debug(`RPC response ${id}: success`);
    } catch (err) {
      send({ id, error: { code: -1, message: err.message } });
      debug(`RPC response ${id}: error - ${err.message}`);
    }
  }

  /**
   * Connect to the TUI WebSocket server
   */
  function connect() {
    if (shuttingDown) return;

    const url = `ws://${HOST}:${PORT}`;
    debug(`Connecting to ${url}`);

    try {
      ws = new WebSocket(url);
    } catch (err) {
      log(`Failed to create WebSocket: ${err.message}`);
      scheduleReconnect();
      return;
    }

    ws.on("open", () => {
      log(`Connected to TUI at ${url}`);
      reconnectDelay = RECONNECT_INITIAL_DELAY; // Reset on successful connect
      sendHello();
    });

    ws.on("message", async (data) => {
      try {
        const msg = JSON.parse(data.toString());

        // Check if it's an RPC request (has id and method)
        if (typeof msg.id === "number" && typeof msg.method === "string") {
          await handleRPCRequest(msg);
        }
      } catch (err) {
        debug(`Failed to handle message: ${err.message}`);
      }
    });

    ws.on("close", () => {
      log("Disconnected from TUI");
      ws = null;
      if (!shuttingDown) {
        scheduleReconnect();
      }
    });

    ws.on("error", (err) => {
      debug(`WebSocket error: ${err.message}`);
      // Close event will handle reconnection
    });
  }

  /**
   * Schedule a reconnection attempt with exponential backoff
   */
  function scheduleReconnect() {
    if (shuttingDown || reconnectTimer) return;

    debug(`Scheduling reconnect in ${reconnectDelay}ms`);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, reconnectDelay);

    // Exponential backoff
    reconnectDelay = Math.min(
      reconnectDelay * RECONNECT_MULTIPLIER,
      RECONNECT_MAX_DELAY,
    );
  }

  /**
   * Handle shutdown
   */
  function handleShutdown() {
    if (shuttingDown) return;
    shuttingDown = true;

    log("Shutting down");

    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    if (ws) {
      sendGoodbye();
      // Give time for goodbye to send
      setTimeout(() => {
        if (ws) {
          ws.close();
          ws = null;
        }
      }, 100);
    }
  }

  // Start connection
  connect();

  // Shutdown handling
  process.on("SIGINT", handleShutdown);
  process.on("SIGTERM", handleShutdown);
  process.on("exit", handleShutdown);

  return {
    // Forward SDK events to TUI
    event: ({ event }) => {
      if (send({ type: "event", event })) {
        debug(`Forwarded event: ${event.type}`);
      }
    },
    dispose: handleShutdown,
  };
};
