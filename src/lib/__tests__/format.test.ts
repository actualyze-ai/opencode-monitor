// Tests for format utilities

import { describe, it, expect, afterEach, setSystemTime } from "bun:test";
import * as fc from "fast-check";
import {
  getStatusColor,
  formatTimestamp,
  formatContextUsage,
  getContextUsageColor,
} from "../format";
import { extractErrorMessage } from "../errors";

describe("getStatusColor", () => {
  it("returns green for idle", () => {
    expect(getStatusColor("idle")).toBe("green");
  });

  it("returns blue for busy", () => {
    expect(getStatusColor("busy")).toBe("blue");
  });

  it("returns magenta for retry", () => {
    expect(getStatusColor("retry")).toBe("magenta");
  });

  it("returns yellow for waiting_for_permission", () => {
    expect(getStatusColor("waiting_for_permission")).toBe("yellow");
  });

  it("returns gray for completed", () => {
    expect(getStatusColor("completed")).toBe("gray");
  });

  it("returns red for error", () => {
    expect(getStatusColor("error")).toBe("red");
  });

  it("returns red for aborted", () => {
    expect(getStatusColor("aborted")).toBe("red");
  });

  it("returns white for unknown status", () => {
    expect(getStatusColor("unknown" as never)).toBe("white");
    expect(getStatusColor("random" as never)).toBe("white");
  });
});

describe("formatTimestamp", () => {
  afterEach(() => {
    // Reset to real time after each test
    setSystemTime();
  });

  it("formats seconds ago for < 60s", () => {
    const now = Date.now();
    setSystemTime(new Date(now));

    expect(formatTimestamp(now - 5000)).toBe("5s ago");
    expect(formatTimestamp(now - 30000)).toBe("30s ago");
    expect(formatTimestamp(now - 59000)).toBe("59s ago");
  });

  it("formats minutes ago for < 60m", () => {
    const now = Date.now();
    setSystemTime(new Date(now));

    expect(formatTimestamp(now - 60000)).toBe("1m ago");
    expect(formatTimestamp(now - 300000)).toBe("5m ago");
    expect(formatTimestamp(now - 3540000)).toBe("59m ago");
  });

  it("formats hours ago for < 24h", () => {
    const now = Date.now();
    setSystemTime(new Date(now));

    expect(formatTimestamp(now - 3600000)).toBe("1h ago");
    expect(formatTimestamp(now - 7200000)).toBe("2h ago");
    expect(formatTimestamp(now - 82800000)).toBe("23h ago");
  });

  it("formats date for older timestamps", () => {
    // Set a fixed time: Jan 15, 2024 at 2:30 PM
    const fixedNow = new Date("2024-01-15T14:30:00");
    setSystemTime(fixedNow);

    // 2 days ago: Jan 13, 2024 at 10:24 AM
    const twoDaysAgo = new Date("2024-01-13T10:24:00").getTime();
    const result = formatTimestamp(twoDaysAgo);

    // Should be in format "Mon DD H:MMa/p"
    expect(result).toMatch(/Jan 13 10:24a/);
  });

  it("handles zero timestamp", () => {
    const now = Date.now();
    setSystemTime(new Date(now));

    // Very old timestamp - should format as date
    const result = formatTimestamp(0);
    expect(result).toMatch(/\w+ \d+ \d+:\d+[ap]/);
  });

  it("handles future timestamps gracefully", () => {
    const now = Date.now();
    setSystemTime(new Date(now));

    // Future timestamp - negative diff results in negative seconds
    // The implementation doesn't handle this specially, so we document actual behavior
    expect(formatTimestamp(now + 10000)).toBe("-10s ago");
  });

  // Boundary tests for exact transitions
  describe("boundary conditions", () => {
    it("transitions from seconds to minutes at exactly 60 seconds", () => {
      const now = Date.now();
      setSystemTime(new Date(now));

      // 59 seconds = still seconds
      expect(formatTimestamp(now - 59000)).toBe("59s ago");
      // 60 seconds = 1 minute
      expect(formatTimestamp(now - 60000)).toBe("1m ago");
      // 61 seconds = still 1 minute (rounds down)
      expect(formatTimestamp(now - 61000)).toBe("1m ago");
    });

    it("transitions from minutes to hours at exactly 60 minutes", () => {
      const now = Date.now();
      setSystemTime(new Date(now));

      // 59 minutes = still minutes
      expect(formatTimestamp(now - 59 * 60 * 1000)).toBe("59m ago");
      // 60 minutes = 1 hour
      expect(formatTimestamp(now - 60 * 60 * 1000)).toBe("1h ago");
      // 61 minutes = still 1 hour (rounds down)
      expect(formatTimestamp(now - 61 * 60 * 1000)).toBe("1h ago");
    });

    it("transitions from hours to date at exactly 24 hours", () => {
      // Set a fixed time: Jan 15, 2024 at 2:30 PM
      const fixedNow = new Date("2024-01-15T14:30:00");
      setSystemTime(fixedNow);

      // 23 hours = still hours
      expect(formatTimestamp(fixedNow.getTime() - 23 * 60 * 60 * 1000)).toBe(
        "23h ago",
      );
      // 24 hours = date format
      const result24h = formatTimestamp(
        fixedNow.getTime() - 24 * 60 * 60 * 1000,
      );
      expect(result24h).toMatch(/Jan 14 \d+:\d+[ap]/);
      // 25 hours = date format
      const result25h = formatTimestamp(
        fixedNow.getTime() - 25 * 60 * 60 * 1000,
      );
      expect(result25h).toMatch(/Jan 14 \d+:\d+[ap]/);
    });
  });
});

describe("formatContextUsage", () => {
  it("returns empty string for undefined/zero used", () => {
    expect(formatContextUsage()).toBe("");
    expect(formatContextUsage(0)).toBe("");
    expect(formatContextUsage(undefined, 100000)).toBe("");
  });

  it("formats usage without max", () => {
    expect(formatContextUsage(50000)).toBe("50k");
    expect(formatContextUsage(1500)).toBe("2k"); // rounds to nearest k
    expect(formatContextUsage(100)).toBe("100"); // below 1000, shows raw number
  });

  it("formats usage with max as percentage", () => {
    expect(formatContextUsage(50000, 100000)).toBe("50k (50%)");
    expect(formatContextUsage(75000, 100000)).toBe("75k (75%)");
    expect(formatContextUsage(100000, 100000)).toBe("100k (100%)");
  });

  it("handles edge cases", () => {
    // Very small values
    expect(formatContextUsage(1, 1000)).toBe("1 (0%)");
    // Large values
    expect(formatContextUsage(1000000, 2000000)).toBe("1000k (50%)");
  });

  it("property: output always contains k suffix when used >= 1000", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1000, max: 10000000 }), (used) => {
        const result = formatContextUsage(used);
        return result.includes("k");
      }),
    );
  });

  it("property: percentage is always 0-100 when used <= max", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1000000 }), (max) => {
        // Generate used value that's <= max
        const used = Math.floor(Math.random() * max) + 1;
        const result = formatContextUsage(used, max);
        const match = result.match(/\((\d+)%\)/);
        if (match?.[1]) {
          const pct = parseInt(match[1], 10);
          return pct >= 0 && pct <= 100;
        }
        return true;
      }),
    );
  });
});

describe("getContextUsageColor", () => {
  // Implementation uses hex colors and thresholds: >80% red, >50% yellow, else green
  // Returns #666666 (gray) when max is undefined or zero

  it("returns green hex for low usage (<= 50%)", () => {
    expect(getContextUsageColor(1, 100)).toBe("#6bcf7f");
    expect(getContextUsageColor(50, 100)).toBe("#6bcf7f");
  });

  it("returns yellow hex for medium usage (51-80%)", () => {
    expect(getContextUsageColor(51, 100)).toBe("#ffd93d");
    expect(getContextUsageColor(70, 100)).toBe("#ffd93d");
    expect(getContextUsageColor(80, 100)).toBe("#ffd93d");
  });

  it("returns red hex for high usage (> 80%)", () => {
    expect(getContextUsageColor(81, 100)).toBe("#ff6b6b");
    expect(getContextUsageColor(90, 100)).toBe("#ff6b6b");
    expect(getContextUsageColor(100, 100)).toBe("#ff6b6b");
  });

  it("returns gray hex when max is undefined or zero", () => {
    expect(getContextUsageColor(50, undefined)).toBe("#666666");
    expect(getContextUsageColor(50, 0)).toBe("#666666");
  });

  it("returns gray hex when used is undefined or zero", () => {
    expect(getContextUsageColor(undefined, 100)).toBe("#666666");
    expect(getContextUsageColor(0, 100)).toBe("#666666");
  });

  it("property: always returns valid hex color", () => {
    const validColors = ["#6bcf7f", "#ffd93d", "#ff6b6b", "#666666"];
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000000 }),
        fc.option(fc.integer({ min: 0, max: 1000000 }), { nil: undefined }),
        (used, max) => {
          const color = getContextUsageColor(used, max);
          return validColors.includes(color);
        },
      ),
    );
  });
});

describe("extractErrorMessage", () => {
  it("extracts message from Error instance", () => {
    const error = new Error("Something went wrong");
    expect(extractErrorMessage(error)).toBe("Something went wrong");
  });

  it("extracts message from Error subclass", () => {
    const error = new TypeError("Invalid type");
    expect(extractErrorMessage(error)).toBe("Invalid type");
  });

  it("converts string to itself", () => {
    expect(extractErrorMessage("plain string error")).toBe(
      "plain string error",
    );
  });

  it("converts number to string", () => {
    expect(extractErrorMessage(404)).toBe("404");
    expect(extractErrorMessage(0)).toBe("0");
  });

  it("converts null to string", () => {
    expect(extractErrorMessage(null)).toBe("null");
  });

  it("converts undefined to string", () => {
    expect(extractErrorMessage(undefined)).toBe("undefined");
  });

  it("converts object to string", () => {
    expect(extractErrorMessage({ code: 500 })).toBe("[object Object]");
  });

  it("converts boolean to string", () => {
    expect(extractErrorMessage(false)).toBe("false");
    expect(extractErrorMessage(true)).toBe("true");
  });

  it("property: always returns a string for common types", () => {
    // Test with realistic error types (not arbitrary objects with broken toString)
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string(),
          fc.integer(),
          fc.boolean(),
          fc.constant(null),
          fc.constant(undefined),
          fc.string().map((msg) => new Error(msg)),
        ),
        (value) => {
          const result = extractErrorMessage(value);
          return typeof result === "string";
        },
      ),
    );
  });

  it("property: Error instances return their message", () => {
    fc.assert(
      fc.property(fc.string(), (message) => {
        const error = new Error(message);
        return extractErrorMessage(error) === message;
      }),
    );
  });
});
