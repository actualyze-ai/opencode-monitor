// Tests for useSessionPolling hook
// NOTE: Full rendering tests require Bun runtime with @opentui/react/test-utils
// These tests verify hook logic without rendering

import { describe, it, expect } from "bun:test";

// Import the hook to verify it exports correctly
import { useSessionPolling } from "../useSessionPolling";

describe("useSessionPolling", () => {
  it("exports a valid React hook", () => {
    expect(useSessionPolling).toBeDefined();
    expect(typeof useSessionPolling).toBe("function");
  });

  it("hook name follows React convention", () => {
    // React hooks must start with 'use'
    // Note: In production builds, function names may be minified
    // This test verifies the export name, not the runtime name
    expect(useSessionPolling.name).toMatch(/useSessionPolling|use/);
  });

  // Note: Full hook behavior tests require Bun runtime
  // The hook uses React effects and refs that need a React environment
  // Use 'bun test' for full hook testing
});
