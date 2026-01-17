// Simple types for OpenCode Session Monitor

export interface Server {
  id: string;
  name: string;
  url: string;
  project?: string;
  branch?: string;
  lastSeen: number;
  /** True if loaded from cache, awaiting WebSocket reconnection */
  pending?: boolean;
}

export interface TokenBreakdown {
  input: number;
  output: number;
  reasoning: number;
  cacheRead: number;
  cacheWrite: number;
}

export interface Session {
  id: string; // Composite: serverId:sessionId
  originalId: string; // For SDK calls
  serverId: string;
  name: string;
  status:
    | "idle"
    | "busy"
    | "waiting_for_permission"
    | "completed"
    | "error"
    | "aborted"
    | "retry";
  createdAt: number;
  lastActivity: number;
  statusUpdatedAt?: number; // Unix timestamp of last status update
  tokens?: number | undefined;
  contextUsed?: number | undefined;
  contextLimit?: number | undefined;
  tokenBreakdown?: TokenBreakdown | undefined;
  cost?: number | undefined;
  messageCount?: number | undefined;
  model?: { provider: string; model: string } | undefined;
  childCount?: number | undefined;
  project?: string;
  branch?: string;
  directory?: string;
  parentId?: string;
}

export interface SessionNode {
  session: Session;
  depth: number;
  isLastChild: boolean;
  treePrefix: string; // e.g., "├── " or "│   └── "
}

/**
 * List item for session list display - either a server group header or a session node
 */
export type ListItem =
  | { type: "group"; serverId: string }
  | { type: "session"; node: SessionNode };

/**
 * State for browser modal dialogs
 */
export type BrowserModalState =
  | null
  | {
      type: "subagent";
      subagentName: string;
      parentSession: Session;
      server: Server;
    }
  | {
      type: "server-unavailable";
      serverName: string;
      serverUrl: string;
    }
  | {
      type: "tui-server-unavailable";
      serverName: string;
      serverUrl: string;
    }
  | {
      type: "http-disabled";
      serverName: string;
    }
  | {
      type: "http-disabled-tui";
      serverName: string;
    };
