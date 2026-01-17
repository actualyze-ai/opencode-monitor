// WebSocket protocol types for reverse proxy architecture

// =============================================================================
// TUI → Plugin (RPC Requests)
// =============================================================================

/**
 * JSON-RPC style request from TUI to Plugin
 */
export interface RPCRequest {
  id: number;
  method: string; // e.g., "session.list", "session.get", "provider.list"
  params?: unknown;
}

/**
 * JSON-RPC style response from Plugin to TUI
 */
export interface RPCResponse {
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
}

// =============================================================================
// Plugin → TUI (Push Messages)
// =============================================================================

/**
 * Initial handshake when plugin connects
 */
export interface HelloMessage {
  type: "hello";
  serverId: string;
  serverName: string;
  serverUrl?: string; // OpenCode server URL for attach/browser
  project?: string;
  branch?: string;
  directory: string;
  authToken?: string;
}

/**
 * SDK event forwarded from plugin
 */
export interface EventMessage {
  type: "event";
  event: SDKEvent;
}

/**
 * Graceful disconnect notification
 */
export interface GoodbyeMessage {
  type: "goodbye";
}

/**
 * Union of all plugin → TUI messages
 */
export type PluginMessage = HelloMessage | EventMessage | GoodbyeMessage;

// =============================================================================
// SDK Event Types (subset we care about)
// =============================================================================

export interface SDKSessionStatusEvent {
  type: "session.status";
  properties: {
    sessionID: string;
    status: SessionStatus;
  };
}

export interface SDKSessionCreatedEvent {
  type: "session.created";
  properties: {
    info: SDKSession;
  };
}

export interface SDKSessionUpdatedEvent {
  type: "session.updated";
  properties: {
    info: SDKSession;
  };
}

export interface SDKSessionDeletedEvent {
  type: "session.deleted";
  properties: {
    info: SDKSession;
  };
}

export interface SDKPermissionUpdatedEvent {
  type: "permission.updated";
  properties: {
    id: string;
    sessionID: string;
    title: string;
    type: string;
    metadata: Record<string, unknown>;
  };
}

export interface SDKServerDisposedEvent {
  type: "server.instance.disposed";
  properties: {
    directory: string;
  };
}

/**
 * Union of SDK events we handle
 */
export type SDKEvent =
  | SDKSessionStatusEvent
  | SDKSessionCreatedEvent
  | SDKSessionUpdatedEvent
  | SDKSessionDeletedEvent
  | SDKPermissionUpdatedEvent
  | SDKServerDisposedEvent
  | { type: string; properties?: unknown }; // Catch-all for other events

/**
 * Session status from SDK
 */
export type SessionStatus =
  | { type: "idle" }
  | { type: "retry"; attempt: number; message: string; next: number }
  | { type: "busy" };

/**
 * Session info from SDK
 */
export interface SDKSession {
  id: string;
  title: string;
  projectID: string;
  directory: string;
  parentID?: string;
  time: {
    created: number;
    updated: number;
  };
}

// =============================================================================
// Server Metadata (from hello message)
// =============================================================================

export interface ServerMetadata {
  serverId: string;
  serverName: string;
  serverUrl?: string | undefined; // OpenCode server URL for attach/browser
  project?: string | undefined;
  branch?: string | undefined;
  directory: string;
}

// =============================================================================
// Type Guards
// =============================================================================

export function isRPCResponse(msg: unknown): msg is RPCResponse {
  return (
    typeof msg === "object" &&
    msg !== null &&
    "id" in msg &&
    typeof (msg as RPCResponse).id === "number"
  );
}

export function isPluginMessage(msg: unknown): msg is PluginMessage {
  return (
    typeof msg === "object" &&
    msg !== null &&
    "type" in msg &&
    typeof (msg as PluginMessage).type === "string"
  );
}

export function isHelloMessage(msg: PluginMessage): msg is HelloMessage {
  return msg.type === "hello";
}

export function isEventMessage(msg: PluginMessage): msg is EventMessage {
  return msg.type === "event";
}

export function isGoodbyeMessage(msg: PluginMessage): msg is GoodbyeMessage {
  return msg.type === "goodbye";
}

// =============================================================================
// SDK Event Type Guards
// =============================================================================

/**
 * Check if event is a session status event
 */
export function isSessionStatusEvent(
  event: SDKEvent,
): event is SDKSessionStatusEvent {
  return (
    event.type === "session.status" &&
    typeof event.properties === "object" &&
    event.properties !== null &&
    "sessionID" in event.properties &&
    "status" in event.properties
  );
}

/**
 * Check if event is a session created event
 */
export function isSessionCreatedEvent(
  event: SDKEvent,
): event is SDKSessionCreatedEvent {
  return (
    event.type === "session.created" &&
    typeof event.properties === "object" &&
    event.properties !== null &&
    "info" in event.properties
  );
}

/**
 * Check if event is a session updated event
 */
export function isSessionUpdatedEvent(
  event: SDKEvent,
): event is SDKSessionUpdatedEvent {
  return (
    event.type === "session.updated" &&
    typeof event.properties === "object" &&
    event.properties !== null &&
    "info" in event.properties
  );
}

/**
 * Check if event is a session deleted event
 */
export function isSessionDeletedEvent(
  event: SDKEvent,
): event is SDKSessionDeletedEvent {
  return (
    event.type === "session.deleted" &&
    typeof event.properties === "object" &&
    event.properties !== null &&
    "info" in event.properties
  );
}

/**
 * Check if event is a permission updated event
 */
export function isPermissionUpdatedEvent(
  event: SDKEvent,
): event is SDKPermissionUpdatedEvent {
  return (
    event.type === "permission.updated" &&
    typeof event.properties === "object" &&
    event.properties !== null &&
    "sessionID" in event.properties
  );
}

/**
 * Check if event is a server disposed event
 */
export function isServerDisposedEvent(
  event: SDKEvent,
): event is SDKServerDisposedEvent {
  return (
    event.type === "server.instance.disposed" &&
    typeof event.properties === "object" &&
    event.properties !== null &&
    "directory" in event.properties
  );
}
