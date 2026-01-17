// Tests for status mapping utilities

import { describe, it, expect } from "bun:test";
import * as fc from "fast-check";
import { mapStatusType } from "../status";

describe("mapStatusType", () => {
  it("maps busy to busy", () => {
    expect(mapStatusType("busy")).toBe("busy");
  });

  it("maps retry to retry", () => {
    expect(mapStatusType("retry")).toBe("retry");
  });

  it("maps waiting_for_permission to waiting_for_permission", () => {
    expect(mapStatusType("waiting_for_permission")).toBe(
      "waiting_for_permission",
    );
  });

  it("maps completed to completed", () => {
    expect(mapStatusType("completed")).toBe("completed");
  });

  it("maps error to error", () => {
    expect(mapStatusType("error")).toBe("error");
  });

  it("maps aborted to aborted", () => {
    expect(mapStatusType("aborted")).toBe("aborted");
  });

  it("maps idle to idle", () => {
    expect(mapStatusType("idle")).toBe("idle");
  });

  it("maps undefined to idle", () => {
    expect(mapStatusType(undefined)).toBe("idle");
  });

  it("maps unknown strings to idle", () => {
    expect(mapStatusType("unknown")).toBe("idle");
    expect(mapStatusType("random")).toBe("idle");
    expect(mapStatusType("")).toBe("idle");
    expect(mapStatusType("BUSY")).toBe("idle"); // case sensitive
  });

  it("property: always returns a valid status", () => {
    const validStatuses = [
      "idle",
      "busy",
      "retry",
      "waiting_for_permission",
      "completed",
      "error",
      "aborted",
    ];

    fc.assert(
      fc.property(fc.string(), (input) => {
        const result = mapStatusType(input);
        return validStatuses.includes(result);
      }),
    );
  });

  it("property: known statuses map to themselves", () => {
    const knownStatuses = [
      "busy",
      "retry",
      "waiting_for_permission",
      "completed",
      "error",
      "aborted",
    ];

    fc.assert(
      fc.property(fc.constantFrom(...knownStatuses), (status) => {
        return mapStatusType(status) === status;
      }),
    );
  });
});
