// Tests for WebSocket protocol type guards

import { describe, it, expect } from "bun:test";
import {
  isRPCResponse,
  isPluginMessage,
  isHelloMessage,
  isEventMessage,
  isGoodbyeMessage,
  isSessionStatusEvent,
  isSessionCreatedEvent,
  isSessionUpdatedEvent,
  isSessionDeletedEvent,
  isPermissionUpdatedEvent,
  isServerDisposedEvent,
  type HelloMessage,
  type EventMessage,
  type GoodbyeMessage,
  type RPCResponse,
  type SDKEvent,
} from "../ws-types";

describe("isRPCResponse", () => {
  it("returns true for valid response with result", () => {
    const response: RPCResponse = { id: 1, result: { data: "test" } };
    expect(isRPCResponse(response)).toBe(true);
  });

  it("returns true for valid response with error", () => {
    const response: RPCResponse = {
      id: 1,
      error: { code: -1, message: "error" },
    };
    expect(isRPCResponse(response)).toBe(true);
  });

  it("returns true for response with numeric id", () => {
    expect(isRPCResponse({ id: 0 })).toBe(true);
    expect(isRPCResponse({ id: 123 })).toBe(true);
    expect(isRPCResponse({ id: -1 })).toBe(true);
  });

  it("returns false for non-objects", () => {
    expect(isRPCResponse(null)).toBe(false);
    expect(isRPCResponse(undefined)).toBe(false);
    expect(isRPCResponse("string")).toBe(false);
    expect(isRPCResponse(123)).toBe(false);
    expect(isRPCResponse([])).toBe(false);
  });

  it("returns false for objects without id", () => {
    expect(isRPCResponse({})).toBe(false);
    expect(isRPCResponse({ result: "test" })).toBe(false);
  });

  it("returns false for objects with non-numeric id", () => {
    expect(isRPCResponse({ id: "1" })).toBe(false);
    expect(isRPCResponse({ id: null })).toBe(false);
    expect(isRPCResponse({ id: undefined })).toBe(false);
  });
});

describe("isPluginMessage", () => {
  it("returns true for hello message", () => {
    const msg: HelloMessage = {
      type: "hello",
      serverId: "server1",
      serverName: "Test",
      directory: "/home",
    };
    expect(isPluginMessage(msg)).toBe(true);
  });

  it("returns true for event message", () => {
    const msg: EventMessage = {
      type: "event",
      event: {
        type: "session.status",
        properties: { sessionID: "1", status: { type: "idle" } },
      },
    };
    expect(isPluginMessage(msg)).toBe(true);
  });

  it("returns true for goodbye message", () => {
    const msg: GoodbyeMessage = { type: "goodbye" };
    expect(isPluginMessage(msg)).toBe(true);
  });

  it("returns false for non-objects", () => {
    expect(isPluginMessage(null)).toBe(false);
    expect(isPluginMessage(undefined)).toBe(false);
    expect(isPluginMessage("hello")).toBe(false);
    expect(isPluginMessage(123)).toBe(false);
  });

  it("returns false for objects without type", () => {
    expect(isPluginMessage({})).toBe(false);
    expect(isPluginMessage({ serverId: "1" })).toBe(false);
  });

  it("returns false for objects with non-string type", () => {
    expect(isPluginMessage({ type: 123 })).toBe(false);
    expect(isPluginMessage({ type: null })).toBe(false);
  });
});

describe("isHelloMessage", () => {
  it("returns true for hello message", () => {
    const msg: HelloMessage = {
      type: "hello",
      serverId: "server1",
      serverName: "Test",
      directory: "/home",
    };
    expect(isHelloMessage(msg)).toBe(true);
  });

  it("returns false for other message types", () => {
    const event: EventMessage = {
      type: "event",
      event: { type: "test" },
    };
    const goodbye: GoodbyeMessage = { type: "goodbye" };

    expect(isHelloMessage(event)).toBe(false);
    expect(isHelloMessage(goodbye)).toBe(false);
  });
});

describe("isEventMessage", () => {
  it("returns true for event message", () => {
    const msg: EventMessage = {
      type: "event",
      event: { type: "session.status", properties: {} },
    };
    expect(isEventMessage(msg)).toBe(true);
  });

  it("returns false for other message types", () => {
    const hello: HelloMessage = {
      type: "hello",
      serverId: "1",
      serverName: "Test",
      directory: "/",
    };
    const goodbye: GoodbyeMessage = { type: "goodbye" };

    expect(isEventMessage(hello)).toBe(false);
    expect(isEventMessage(goodbye)).toBe(false);
  });
});

describe("isGoodbyeMessage", () => {
  it("returns true for goodbye message", () => {
    const msg: GoodbyeMessage = { type: "goodbye" };
    expect(isGoodbyeMessage(msg)).toBe(true);
  });

  it("returns false for other message types", () => {
    const hello: HelloMessage = {
      type: "hello",
      serverId: "1",
      serverName: "Test",
      directory: "/",
    };
    const event: EventMessage = {
      type: "event",
      event: { type: "test" },
    };

    expect(isGoodbyeMessage(hello)).toBe(false);
    expect(isGoodbyeMessage(event)).toBe(false);
  });
});

// =============================================================================
// SDK Event Type Guards
// =============================================================================

describe("isSessionStatusEvent", () => {
  it("returns true for valid session status event", () => {
    const event: SDKEvent = {
      type: "session.status",
      properties: {
        sessionID: "sess_123",
        status: { type: "idle" },
      },
    };
    expect(isSessionStatusEvent(event)).toBe(true);
  });

  it("returns true for busy status", () => {
    const event: SDKEvent = {
      type: "session.status",
      properties: {
        sessionID: "sess_123",
        status: { type: "busy" },
      },
    };
    expect(isSessionStatusEvent(event)).toBe(true);
  });

  it("returns false for wrong event type", () => {
    const event: SDKEvent = {
      type: "session.created",
      properties: {
        info: {
          id: "1",
          title: "Test",
          projectID: "p",
          directory: "/",
          time: { created: 0, updated: 0 },
        },
      },
    };
    expect(isSessionStatusEvent(event)).toBe(false);
  });

  it("returns false for missing properties", () => {
    const event: SDKEvent = { type: "session.status" };
    expect(isSessionStatusEvent(event)).toBe(false);
  });

  it("returns false for missing sessionID", () => {
    const event: SDKEvent = {
      type: "session.status",
      properties: { status: { type: "idle" } },
    } as SDKEvent;
    expect(isSessionStatusEvent(event)).toBe(false);
  });
});

describe("isSessionCreatedEvent", () => {
  it("returns true for valid session created event", () => {
    const event: SDKEvent = {
      type: "session.created",
      properties: {
        info: {
          id: "sess_123",
          title: "Test Session",
          projectID: "proj_1",
          directory: "/home/user",
          time: { created: 1000, updated: 1000 },
        },
      },
    };
    expect(isSessionCreatedEvent(event)).toBe(true);
  });

  it("returns false for wrong event type", () => {
    const event: SDKEvent = {
      type: "session.status",
      properties: { sessionID: "1", status: { type: "idle" } },
    };
    expect(isSessionCreatedEvent(event)).toBe(false);
  });

  it("returns false for missing info", () => {
    const event: SDKEvent = {
      type: "session.created",
      properties: {},
    } as SDKEvent;
    expect(isSessionCreatedEvent(event)).toBe(false);
  });
});

describe("isSessionUpdatedEvent", () => {
  it("returns true for valid session updated event", () => {
    const event: SDKEvent = {
      type: "session.updated",
      properties: {
        info: {
          id: "sess_123",
          title: "Updated Session",
          projectID: "proj_1",
          directory: "/home/user",
          time: { created: 1000, updated: 2000 },
        },
      },
    };
    expect(isSessionUpdatedEvent(event)).toBe(true);
  });

  it("returns false for wrong event type", () => {
    const event: SDKEvent = {
      type: "session.created",
      properties: {
        info: {
          id: "1",
          title: "",
          projectID: "",
          directory: "",
          time: { created: 0, updated: 0 },
        },
      },
    };
    expect(isSessionUpdatedEvent(event)).toBe(false);
  });
});

describe("isSessionDeletedEvent", () => {
  it("returns true for valid session deleted event", () => {
    const event: SDKEvent = {
      type: "session.deleted",
      properties: {
        info: {
          id: "sess_123",
          title: "Deleted Session",
          projectID: "proj_1",
          directory: "/home/user",
          time: { created: 1000, updated: 2000 },
        },
      },
    };
    expect(isSessionDeletedEvent(event)).toBe(true);
  });

  it("returns false for wrong event type", () => {
    const event: SDKEvent = {
      type: "session.updated",
      properties: {
        info: {
          id: "1",
          title: "",
          projectID: "",
          directory: "",
          time: { created: 0, updated: 0 },
        },
      },
    };
    expect(isSessionDeletedEvent(event)).toBe(false);
  });
});

describe("isPermissionUpdatedEvent", () => {
  it("returns true for valid permission updated event", () => {
    const event: SDKEvent = {
      type: "permission.updated",
      properties: {
        id: "perm_123",
        sessionID: "sess_123",
        title: "File Access",
        type: "file",
        metadata: { path: "/etc/passwd" },
      },
    };
    expect(isPermissionUpdatedEvent(event)).toBe(true);
  });

  it("returns false for wrong event type", () => {
    const event: SDKEvent = {
      type: "session.status",
      properties: { sessionID: "1", status: { type: "idle" } },
    };
    expect(isPermissionUpdatedEvent(event)).toBe(false);
  });

  it("returns false for missing sessionID", () => {
    const event: SDKEvent = {
      type: "permission.updated",
      properties: { id: "1", title: "Test", type: "file", metadata: {} },
    } as SDKEvent;
    expect(isPermissionUpdatedEvent(event)).toBe(false);
  });
});

describe("isServerDisposedEvent", () => {
  it("returns true for valid server disposed event", () => {
    const event: SDKEvent = {
      type: "server.instance.disposed",
      properties: {
        directory: "/home/user/project",
      },
    };
    expect(isServerDisposedEvent(event)).toBe(true);
  });

  it("returns false for wrong event type", () => {
    const event: SDKEvent = {
      type: "session.status",
      properties: { sessionID: "1", status: { type: "idle" } },
    };
    expect(isServerDisposedEvent(event)).toBe(false);
  });

  it("returns false for missing directory", () => {
    const event: SDKEvent = {
      type: "server.instance.disposed",
      properties: {},
    } as SDKEvent;
    expect(isServerDisposedEvent(event)).toBe(false);
  });
});
