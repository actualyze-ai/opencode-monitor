// Tests for browser utilities - pure functions only
// openInBrowser tests are in browser-spawn.test.ts to isolate module mocking

import { describe, it, expect } from "bun:test";
import * as fc from "fast-check";
import { encodeDirectory, buildSessionUrl } from "../browser";

describe("encodeDirectory", () => {
  it("encodes simple paths correctly", () => {
    const encoded = encodeDirectory("/home/user/project");
    // Should be URL-safe base64 without padding
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
    expect(encoded).not.toContain("=");
  });

  it("uses URL-safe base64 characters", () => {
    // Test a string that would produce + and / in standard base64
    const encoded = encodeDirectory("/path/with/special?chars&more");
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("removes padding", () => {
    // Different length strings to test padding removal
    expect(encodeDirectory("a")).not.toContain("=");
    expect(encodeDirectory("ab")).not.toContain("=");
    expect(encodeDirectory("abc")).not.toContain("=");
    expect(encodeDirectory("abcd")).not.toContain("=");
  });

  it("handles empty string", () => {
    expect(encodeDirectory("")).toBe("");
  });

  it("handles paths with spaces", () => {
    const encoded = encodeDirectory("/home/user/my project");
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("handles unicode paths", () => {
    const encoded = encodeDirectory("/home/用户/项目");
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  describe("property-based tests", () => {
    it("output contains only URL-safe characters", () => {
      fc.assert(
        fc.property(fc.string(), (directory) => {
          const encoded = encodeDirectory(directory);
          // URL-safe base64: A-Z, a-z, 0-9, -, _
          expect(encoded).toMatch(/^[A-Za-z0-9_-]*$/);
        }),
      );
    });

    it("output never contains padding", () => {
      fc.assert(
        fc.property(fc.string(), (directory) => {
          const encoded = encodeDirectory(directory);
          expect(encoded).not.toContain("=");
        }),
      );
    });

    it("output never contains standard base64 special chars", () => {
      fc.assert(
        fc.property(fc.string(), (directory) => {
          const encoded = encodeDirectory(directory);
          expect(encoded).not.toContain("+");
          expect(encoded).not.toContain("/");
        }),
      );
    });
  });
});

describe("buildSessionUrl", () => {
  it("constructs correct URL format", () => {
    const url = buildSessionUrl(
      "http://localhost:4096",
      "/home/user/project",
      "session123",
    );

    expect(url).toMatch(
      /^http:\/\/localhost:4096\/[A-Za-z0-9_-]+\/session\/session123$/,
    );
  });

  it("handles trailing slash in serverUrl", () => {
    const url1 = buildSessionUrl(
      "http://localhost:4096",
      "/home/user",
      "sess1",
    );
    const url2 = buildSessionUrl(
      "http://localhost:4096/",
      "/home/user",
      "sess1",
    );

    // Both should work, though url2 will have double slash
    expect(url1).toContain("/session/sess1");
    expect(url2).toContain("/session/sess1");
  });

  it("handles empty directory", () => {
    const url = buildSessionUrl("http://localhost:4096", "", "session123");
    expect(url).toBe("http://localhost:4096//session/session123");
  });

  it("handles complex session IDs", () => {
    const url = buildSessionUrl(
      "http://localhost:4096",
      "/home",
      "session-with-dashes_and_underscores",
    );
    expect(url).toContain("/session/session-with-dashes_and_underscores");
  });

  describe("property-based tests", () => {
    it("output always contains /session/ path segment", () => {
      fc.assert(
        fc.property(
          fc.webUrl(),
          fc.string(),
          fc.string({ minLength: 1 }),
          (serverUrl, directory, sessionId) => {
            const url = buildSessionUrl(serverUrl, directory, sessionId);
            expect(url).toContain("/session/");
          },
        ),
      );
    });

    it("output always ends with sessionId", () => {
      fc.assert(
        fc.property(
          fc.webUrl(),
          fc.string(),
          fc.string({ minLength: 1 }).filter((s) => !s.includes("/")),
          (serverUrl, directory, sessionId) => {
            const url = buildSessionUrl(serverUrl, directory, sessionId);
            expect(url.endsWith(sessionId)).toBe(true);
          },
        ),
      );
    });
  });
});

// Note: openInBrowser tests require module mocking which affects global state.
// These tests are skipped to avoid polluting other test files.
// The function is tested manually and through integration tests.
describe("openInBrowser", () => {
  it.skip("uses platform-specific commands", () => {
    // Skipped: requires module mocking that affects global state
    // See browser-spawn.test.ts for isolated tests
  });
});
