import { describe, it, expect } from "bun:test";
import * as fc from "fast-check";
import {
  MonitorError,
  ConnectionError,
  PortInUseError,
  RpcTimeoutError,
  NoClientError,
  ShutdownError,
  isMonitorError,
  isPortInUseError,
  extractErrorMessage,
  extractErrorCode,
} from "../errors";

describe("MonitorError", () => {
  it("creates error with message and code", () => {
    const error = new MonitorError("Test error", "TEST_CODE");
    expect(error.message).toBe("Test error");
    expect(error.code).toBe("TEST_CODE");
    expect(error.name).toBe("MonitorError");
    expect(error instanceof Error).toBe(true);
  });
});

describe("ConnectionError", () => {
  it("creates error with message and optional serverId", () => {
    const error = new ConnectionError("Connection failed", "server-1");
    expect(error.message).toBe("Connection failed");
    expect(error.code).toBe("CONNECTION_ERROR");
    expect(error.serverId).toBe("server-1");
    expect(error.name).toBe("ConnectionError");
    expect(error instanceof MonitorError).toBe(true);
  });

  it("works without serverId", () => {
    const error = new ConnectionError("Connection failed");
    expect(error.serverId).toBeUndefined();
  });
});

describe("PortInUseError", () => {
  it("creates error with port number", () => {
    const error = new PortInUseError(8080);
    expect(error.message).toBe("Port 8080 is already in use");
    expect(error.code).toBe("PORT_IN_USE");
    expect(error.port).toBe(8080);
    expect(error.elapsed).toBeUndefined();
    expect(error.name).toBe("PortInUseError");
  });

  it("includes elapsed time in message when provided", () => {
    const error = new PortInUseError(8080, 5000);
    expect(error.message).toBe("Port 8080 is already in use after 5s");
    expect(error.elapsed).toBe(5000);
  });
});

describe("RpcTimeoutError", () => {
  it("creates error with method and timeout", () => {
    const error = new RpcTimeoutError("session.list", 5000);
    expect(error.message).toBe("RPC timeout: session.list (5000ms)");
    expect(error.code).toBe("RPC_TIMEOUT");
    expect(error.method).toBe("session.list");
    expect(error.timeoutMs).toBe(5000);
    expect(error.name).toBe("RpcTimeoutError");
  });
});

describe("NoClientError", () => {
  it("creates error with serverId", () => {
    const error = new NoClientError("server-123");
    expect(error.message).toBe("No client connected for server: server-123");
    expect(error.code).toBe("NO_CLIENT");
    expect(error.serverId).toBe("server-123");
    expect(error.name).toBe("NoClientError");
  });
});

describe("ShutdownError", () => {
  it("creates error with default message", () => {
    const error = new ShutdownError();
    expect(error.message).toBe("Server shutting down");
    expect(error.code).toBe("SHUTDOWN");
    expect(error.name).toBe("ShutdownError");
  });

  it("accepts custom message", () => {
    const error = new ShutdownError("Custom shutdown reason");
    expect(error.message).toBe("Custom shutdown reason");
  });
});

describe("isMonitorError", () => {
  it("returns true for MonitorError instances", () => {
    expect(isMonitorError(new MonitorError("test", "TEST"))).toBe(true);
    expect(isMonitorError(new ConnectionError("test"))).toBe(true);
    expect(isMonitorError(new PortInUseError(8080))).toBe(true);
    expect(isMonitorError(new RpcTimeoutError("test", 1000))).toBe(true);
    expect(isMonitorError(new NoClientError("test"))).toBe(true);
    expect(isMonitorError(new ShutdownError())).toBe(true);
  });

  it("returns false for non-MonitorError values", () => {
    expect(isMonitorError(new Error("test"))).toBe(false);
    expect(isMonitorError("string error")).toBe(false);
    expect(isMonitorError(null)).toBe(false);
    expect(isMonitorError(undefined)).toBe(false);
    expect(isMonitorError(42)).toBe(false);
    expect(isMonitorError({})).toBe(false);
  });
});

describe("isPortInUseError", () => {
  it("returns true for PortInUseError instances", () => {
    expect(isPortInUseError(new PortInUseError(8080))).toBe(true);
  });

  it("returns true for Error with EADDRINUSE message", () => {
    expect(
      isPortInUseError(new Error("EADDRINUSE: address already in use")),
    ).toBe(true);
  });

  it("returns true for Error with 'in use' message", () => {
    expect(isPortInUseError(new Error("Port is in use"))).toBe(true);
  });

  it("returns false for other errors", () => {
    expect(isPortInUseError(new Error("Connection refused"))).toBe(false);
    expect(isPortInUseError(new Error("Network error"))).toBe(false);
  });

  it("returns false for non-Error values", () => {
    expect(isPortInUseError("EADDRINUSE")).toBe(false);
    expect(isPortInUseError(null)).toBe(false);
    expect(isPortInUseError(undefined)).toBe(false);
  });
});

describe("extractErrorMessage", () => {
  it("extracts message from Error instance", () => {
    expect(extractErrorMessage(new Error("Test error"))).toBe("Test error");
  });

  it("extracts message from MonitorError", () => {
    expect(extractErrorMessage(new MonitorError("Monitor error", "TEST"))).toBe(
      "Monitor error",
    );
  });

  it("converts string to string", () => {
    expect(extractErrorMessage("string error")).toBe("string error");
  });

  it("converts number to string", () => {
    expect(extractErrorMessage(404)).toBe("404");
  });

  it("converts null to string", () => {
    expect(extractErrorMessage(null)).toBe("null");
  });

  it("converts undefined to string", () => {
    expect(extractErrorMessage(undefined)).toBe("undefined");
  });
});

describe("extractErrorCode", () => {
  it("extracts code from MonitorError", () => {
    expect(extractErrorCode(new MonitorError("test", "TEST_CODE"))).toBe(
      "TEST_CODE",
    );
    expect(extractErrorCode(new ConnectionError("test"))).toBe(
      "CONNECTION_ERROR",
    );
    expect(extractErrorCode(new PortInUseError(8080))).toBe("PORT_IN_USE");
  });

  it("returns UNKNOWN for non-MonitorError", () => {
    expect(extractErrorCode(new Error("test"))).toBe("UNKNOWN");
    expect(extractErrorCode("string")).toBe("UNKNOWN");
    expect(extractErrorCode(null)).toBe("UNKNOWN");
  });
});

// Property-based tests
describe("property-based tests", () => {
  it("MonitorError preserves message and code", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (message: string, code: string) => {
        const error = new MonitorError(message, code);
        expect(error.message).toBe(message);
        expect(error.code).toBe(code);
      }),
    );
  });

  it("PortInUseError includes port in message", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 65535 }), (port: number) => {
        const error = new PortInUseError(port);
        expect(error.message).toContain(String(port));
        expect(error.port).toBe(port);
      }),
    );
  });

  it("extractErrorMessage handles any string", () => {
    fc.assert(
      fc.property(fc.string(), (str: string) => {
        expect(extractErrorMessage(str)).toBe(str);
      }),
    );
  });

  it("extractErrorMessage extracts Error message", () => {
    fc.assert(
      fc.property(fc.string(), (message: string) => {
        const error = new Error(message);
        expect(extractErrorMessage(error)).toBe(message);
      }),
    );
  });
});
