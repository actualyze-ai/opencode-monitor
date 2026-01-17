// Standardized error types for the session monitor

/**
 * Base error class for session monitor errors.
 * All custom errors extend this for consistent handling.
 */
export class MonitorError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "MonitorError";
  }
}

/**
 * Error thrown when a WebSocket connection fails or times out.
 */
export class ConnectionError extends MonitorError {
  constructor(
    message: string,
    public readonly serverId?: string,
  ) {
    super(message, "CONNECTION_ERROR");
    this.name = "ConnectionError";
  }
}

/**
 * Error thrown when a port is already in use.
 */
export class PortInUseError extends MonitorError {
  constructor(
    public readonly port: number,
    public readonly elapsed?: number,
  ) {
    const elapsedStr = elapsed ? ` after ${Math.round(elapsed / 1000)}s` : "";
    super(`Port ${port} is already in use${elapsedStr}`, "PORT_IN_USE");
    this.name = "PortInUseError";
  }
}

/**
 * Error thrown when an RPC call times out.
 */
export class RpcTimeoutError extends MonitorError {
  constructor(
    public readonly method: string,
    public readonly timeoutMs: number,
  ) {
    super(`RPC timeout: ${method} (${timeoutMs}ms)`, "RPC_TIMEOUT");
    this.name = "RpcTimeoutError";
  }
}

/**
 * Error thrown when no client is connected for a server.
 */
export class NoClientError extends MonitorError {
  constructor(public readonly serverId: string) {
    super(`No client connected for server: ${serverId}`, "NO_CLIENT");
    this.name = "NoClientError";
  }
}

/**
 * Error thrown when server is shutting down.
 */
export class ShutdownError extends MonitorError {
  constructor(message = "Server shutting down") {
    super(message, "SHUTDOWN");
    this.name = "ShutdownError";
  }
}

/**
 * Type guard to check if an error is a MonitorError.
 */
export function isMonitorError(error: unknown): error is MonitorError {
  return error instanceof MonitorError;
}

/**
 * Type guard to check if an error indicates port in use.
 */
export function isPortInUseError(error: unknown): boolean {
  if (error instanceof PortInUseError) return true;
  if (error instanceof Error) {
    return (
      error.message.includes("EADDRINUSE") || error.message.includes("in use")
    );
  }
  return false;
}

/**
 * Extract error message from unknown error type.
 * Handles Error instances, strings, and other types.
 */
export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Extract error code from MonitorError or return "UNKNOWN".
 */
export function extractErrorCode(error: unknown): string {
  if (isMonitorError(error)) return error.code;
  return "UNKNOWN";
}
