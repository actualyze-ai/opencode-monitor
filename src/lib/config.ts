// Centralized configuration constants

/** Application display name (used in terminal title, version strings, help text) */
export const APP_NAME = "oc-mon";

export const CONFIG = {
  /** WebSocket server settings */
  ws: {
    /** Default WebSocket server port */
    port: 41235,
    /** RPC request timeout in milliseconds */
    rpcTimeout: 30_000,
    /** Maximum concurrent RPC requests per server */
    maxConcurrentRequests: 10,
  },

  /** Polling intervals */
  polling: {
    /** Fast polling interval for status updates (milliseconds) */
    statusInterval: 5_000,
    /** Slow polling interval for full details (milliseconds) */
    detailsInterval: 10_000,
    /** Initial details fetch delay (milliseconds) */
    initialDetailsDelay: 1_000,
  },

  /** Debounce timings */
  debounce: {
    /** Grace period before removing disconnected server (milliseconds) */
    disconnect: 1_500,
    /** Minimum time between session fetches (milliseconds) */
    sessionFetch: 2_000,
  },

  /** Cache settings */
  cache: {
    /** Cache time-to-live (milliseconds) */
    ttl: 60_000,
  },

  /** Process lifecycle */
  lifecycle: {
    /** Exit code that signals controller to relaunch TUI */
    relaunchExitCode: 42,
    /** Time to wait for pending servers to reconnect (milliseconds) */
    pendingServerTimeout: 30_000,
  },

  /** Server availability check */
  availability: {
    /** Timeout for server availability check (milliseconds) */
    checkTimeout: 2_000,
  },

  /** UI modal dimensions */
  modal: {
    /** Width for subagent warning modal */
    subagentWidth: 47,
    /** Height for subagent warning modal */
    subagentHeight: 13,
    /** Width for server unavailable modal */
    serverUnavailableWidth: 46,
    /** Height for server unavailable modal */
    serverUnavailableHeight: 13,
    /** Width for TUI server unavailable modal */
    tuiServerUnavailableWidth: 50,
    /** Height for TUI server unavailable modal */
    tuiServerUnavailableHeight: 14,
  },
} as const;

/** Environment variable names */
export const ENV_VARS = {
  /** Monitor host(s) for plugin to connect to */
  monitorHost: "OPENCODE_MONITOR_HOST",
  /** WebSocket port */
  monitorPort: "OPENCODE_MONITOR_PORT",
  /** Authentication token */
  monitorToken: "OPENCODE_MONITOR_TOKEN",
  /** Debug log file path */
  logFile: "OPENCODE_MONITOR_LOG_FILE",
  /** Console log redirect path */
  consoleLog: "OPENCODE_MONITOR_CONSOLE_LOG",
  /** Session cache file path */
  cacheFile: "OPENCODE_MONITOR_CACHE_FILE",
  /** Relaunch session ID (internal) */
  relaunchSession: "OPENCODE_MONITOR_RELAUNCH_SESSION",
} as const;
