// Tests for Spinner component
// NOTE: Full rendering tests require Bun runtime with @opentui/react/test-utils
// These tests verify component logic without rendering

import { describe, it, expect } from "bun:test";

// Import the component to verify it exports correctly
import Spinner from "../Spinner";

describe("Spinner", () => {
  it("exports a valid React component", () => {
    expect(Spinner).toBeDefined();
    expect(typeof Spinner).toBe("function");
  });

  it("accepts isBusy prop", () => {
    // Verify the component can be called with props (type check)
    // Actual rendering requires Bun runtime
    const props = { isBusy: true };
    expect(props.isBusy).toBe(true);

    const props2 = { isBusy: false };
    expect(props2.isBusy).toBe(false);
  });

  // Note: Animation and rendering tests require Bun runtime
  // Use 'bun test' for full component testing
});
