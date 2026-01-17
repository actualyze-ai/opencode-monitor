// Smoke tests for main App component
// NOTE: Full rendering tests require Bun runtime with @opentui/react/test-utils
// These tests verify exports and basic logic without rendering

import { describe, it, expect } from "bun:test";

// Import App - this tests that the module can be loaded
import App, { consumePendingLaunchRequest } from "../app";

describe("App", () => {
  it("exports a valid React component", () => {
    expect(App).toBeDefined();
    expect(typeof App).toBe("function");
  });

  // Note: Full rendering tests require Bun runtime
  // Use 'bun test' for full component testing
});

describe("App exports", () => {
  it("exports consumePendingLaunchRequest", () => {
    expect(typeof consumePendingLaunchRequest).toBe("function");
  });

  // Note: setPendingLaunchRequest and consumePendingLaunchRequest behavior
  // is now tested in stores/__tests__/uiStore.test.ts since the state
  // was moved to the UI store for better architectural consistency.
});
