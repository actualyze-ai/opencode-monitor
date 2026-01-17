// Session cache for instant display on relaunch

import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CONFIG, ENV_VARS } from "./config";
import { debug } from "./debug";
import { extractErrorMessage } from "./errors";
import type { Server, Session } from "../types";

function getCachePath(): string {
  const envPath = process.env[ENV_VARS.cacheFile];
  if (envPath) {
    return envPath;
  }
  return join(tmpdir(), "opencode-monitor-cache.json");
}

interface SessionCache {
  timestamp: number;
  servers: Server[];
  sessions: Session[];
  collapsedServers?: string[]; // Optional for backwards compatibility
}

/**
 * Save current server and session state to cache file
 * Used for instant display when relaunching after TUI attach
 * @param servers - Map of servers
 * @param sessions - Map of sessions
 * @param collapsedServers - Set of collapsed server IDs
 */
export function saveCache(
  servers: Map<string, Server>,
  sessions: Map<string, Session>,
  collapsedServers?: Set<string>,
): void {
  try {
    const cache: SessionCache = {
      timestamp: Date.now(),
      servers: Array.from(servers.values()),
      sessions: Array.from(sessions.values()),
    };
    if (collapsedServers && collapsedServers.size > 0) {
      cache.collapsedServers = Array.from(collapsedServers);
    }
    writeFileSync(getCachePath(), JSON.stringify(cache));
  } catch (err: unknown) {
    debug(`[Cache] Failed to save: ${extractErrorMessage(err)}`);
  }
}

/**
 * Load cached server and session state
 * Returns null if cache is stale (>60s) or doesn't exist
 * @returns Cached data or null
 */
export function loadCache(): {
  servers: Map<string, Server>;
  sessions: Map<string, Session>;
  collapsedServers: Set<string>;
} | null {
  try {
    const data = readFileSync(getCachePath(), "utf-8");
    const cache: SessionCache = JSON.parse(data);

    // Check if cache is stale
    if (Date.now() - cache.timestamp > CONFIG.cache.ttl) {
      return null;
    }

    return {
      servers: new Map(cache.servers.map((s) => [s.id, s])),
      sessions: new Map(cache.sessions.map((s) => [s.id, s])),
      collapsedServers: new Set(cache.collapsedServers ?? []),
    };
  } catch (err: unknown) {
    debug(`[Cache] Failed to load: ${extractErrorMessage(err)}`);
    return null;
  }
}
