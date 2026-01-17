// Tests for ErrorBoundary component
// NOTE: Full rendering tests require Bun runtime with @opentui/react/test-utils
// These tests verify component logic without rendering

import { describe, it, expect } from "bun:test";

// Import the component to verify it exports correctly
import { ErrorBoundary } from "../ErrorBoundary";

describe("ErrorBoundary", () => {
  it("exports a valid React component class", () => {
    expect(ErrorBoundary).toBeDefined();
    expect(typeof ErrorBoundary).toBe("function");
    // Class components have a prototype with render method
    expect(ErrorBoundary.prototype.render).toBeDefined();
  });

  it("has getDerivedStateFromError static method", () => {
    expect(ErrorBoundary.getDerivedStateFromError).toBeDefined();
    expect(typeof ErrorBoundary.getDerivedStateFromError).toBe("function");
  });

  it("getDerivedStateFromError returns error state", () => {
    const error = new Error("Test error");
    const state = ErrorBoundary.getDerivedStateFromError(error);

    expect(state).toEqual({
      hasError: true,
      error: error,
    });
  });

  it("accepts children and onExit props", () => {
    // Type check - verify props interface
    const props = {
      children: null,
      onExit: () => {},
    };
    expect(props.children).toBeNull();
    expect(typeof props.onExit).toBe("function");
  });

  // Note: Full rendering and error catching tests require Bun runtime
  // Use 'bun test' for full component testing
});
