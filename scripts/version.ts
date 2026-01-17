#!/usr/bin/env bun
/**
 * Build-time version string generator.
 *
 * Outputs a version string for injection into the build:
 * - "oc-mon v0.1.0" if on exact git tag
 * - "oc-mon v0.1.0-b6379d" if not on tag (dev build)
 * - "oc-mon v0.1.0" if git unavailable
 *
 * Usage: bun run scripts/version.ts
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { APP_NAME } from "../src/lib/config";

function getPackageVersion(): string {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const pkgPath = join(__dirname, "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function getVersionString(): string {
  const packageVersion = getPackageVersion();

  try {
    // Check if on exact tag
    const exactTag = execSync("git describe --tags --exact-match 2>/dev/null", {
      encoding: "utf-8",
    }).trim();

    if (exactTag) {
      // On exact tag - use tag version (strip 'v' prefix if present)
      return `${APP_NAME} v${exactTag.replace(/^v/, "")}`;
    }
  } catch {
    // Not on exact tag, continue
  }

  try {
    // Get short commit hash
    const shortHash = execSync("git rev-parse --short=6 HEAD", {
      encoding: "utf-8",
    }).trim();

    return `${APP_NAME} v${packageVersion}-${shortHash}`;
  } catch {
    // Git not available
    return `${APP_NAME} v${packageVersion}`;
  }
}

// Output for tsup to capture
console.log(getVersionString());
