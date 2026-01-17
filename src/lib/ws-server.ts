// WebSocket server for reverse proxy architecture

import { EventEmitter } from "node:events";
import type { IncomingMessage } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { CONFIG, ENV_VARS } from "./config";
import { debug } from "./debug";
import {
  PortInUseError,
  RpcTimeoutError,
  NoClientError,
  ShutdownError,
  isPortInUseError,
  extractErrorMessage,
} from "./errors";
import {
  isRPCResponse,
  isPluginMessage,
  isHelloMessage,
  isEventMessage,
  isGoodbyeMessage,
  type RPCRequest,
  type RPCResponse,
  type ServerMetadata,
  type SDKEvent,
} from "./ws-types";

interface PendingRequest {
  serverId: string;
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

interface ClientInfo {
  ws: WebSocket;
  metadata: ServerMetadata;
}

export interface MonitorWSServerEvents {
  client_connected: (serverId: string, metadata: ServerMetadata) => void;
  client_disconnected: (serverId: string) => void;
  event: (serverId: string, event: SDKEvent) => void;
  error: (error: Error) => void;
}

interface QueuedRequest {
  method: string;
  params?: unknown;
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
}

let serverInstanceCounter = 0;

export class MonitorWSServer extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, ClientInfo> = new Map();
  private pendingRequests: Map<number, PendingRequest> = new Map();
  private nextRequestId = 1;
  private port: number;
  private authToken: string | undefined;
  private instanceId: number;
  private activeRequestsPerServer: Map<string, number> = new Map();
  private requestQueues: Map<string, QueuedRequest[]> = new Map();

  constructor(port: number = CONFIG.ws.port, authToken?: string) {
    super();
    this.instanceId = ++serverInstanceCounter;
    debug(`[WS] MonitorWSServer instance #${this.instanceId} created`);
    this.setMaxListeners(20);
    this.port = port;
    this.authToken = authToken ?? process.env[ENV_VARS.monitorToken];
  }

  async start(retryTimeout = 10000): Promise<void> {
    if (this.wss) {
      debug("[WS] Server already running");
      return;
    }

    const startTime = Date.now();
    const retryDelay = 100;

    while (Date.now() - startTime < retryTimeout) {
      try {
        await this.tryBindPort();
        debug(`[WS] Server #${this.instanceId} listening on port ${this.port}`);
        break;
      } catch (err: unknown) {
        if (!isPortInUseError(err)) {
          throw err;
        }

        const elapsed = Date.now() - startTime;
        if (elapsed + retryDelay >= retryTimeout) {
          throw new PortInUseError(this.port, elapsed);
        }

        debug(
          `[WS] Port ${this.port} in use, retrying... (${Math.round(elapsed / 1000)}s elapsed)`,
        );
        await new Promise((r) => setTimeout(r, retryDelay));
      }
    }

    const wss = this.wss!;
    this.setupConnectionHandler(wss);

    wss.on("error", (err) => {
      debug(`[WS] Server error: ${err.message}`);
      this.emit("error", err);
    });
  }

  private tryBindPort(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wss = new WebSocketServer({ port: this.port });

      const onListening = () => {
        wss.removeListener("error", onError);
        this.wss = wss;
        resolve();
      };

      const onError = (err: Error) => {
        wss.removeListener("listening", onListening);
        wss.close();
        reject(err);
      };

      wss.once("listening", onListening);
      wss.once("error", onError);
    });
  }

  private setupConnectionHandler(wss: WebSocketServer): void {
    wss.on("connection", (ws: WebSocket, request: IncomingMessage) => {
      let remoteAddress = request.socket.remoteAddress || "unknown";
      if (remoteAddress.startsWith("::ffff:")) {
        remoteAddress = remoteAddress.slice(7);
      }
      debug(`[WS] New connection from ${remoteAddress}`);

      let serverId: string | null = null;

      ws.on("message", (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString());

          if (isRPCResponse(msg)) {
            this.handleRPCResponse(msg);
            return;
          }

          if (isPluginMessage(msg)) {
            if (isHelloMessage(msg)) {
              if (this.authToken && msg.authToken !== this.authToken) {
                debug("[WS] Auth failed: invalid token");
                ws.close(1008, "Unauthorized");
                return;
              }

              serverId = msg.serverId;

              let serverUrl = msg.serverUrl;
              if (serverUrl === "disabled") {
                // HTTP server not enabled - keep as-is
                debug(`[WS] HTTP server disabled for this client`);
              } else if (serverUrl?.includes("AUTO")) {
                serverUrl = serverUrl.replace("AUTO", remoteAddress);
                debug(`[WS] Replaced AUTO with remote address: ${serverUrl}`);
              }

              const metadata: ServerMetadata = {
                serverId: msg.serverId,
                serverName: msg.serverName,
                serverUrl,
                project: msg.project,
                branch: msg.branch,
                directory: msg.directory,
              };

              this.clients.set(serverId, { ws, metadata });
              debug(`[WS] Client registered: ${serverId} (${msg.serverName})`);
              this.emit("client_connected", serverId, metadata);
            } else if (isEventMessage(msg)) {
              if (serverId) {
                debug(`[WS] Event from ${serverId}: ${msg.event.type}`);
                this.emit("event", serverId, msg.event);
              }
            } else if (isGoodbyeMessage(msg)) {
              debug(`[WS] Goodbye from ${serverId}`);
            }
          }
        } catch (err: unknown) {
          debug(`[WS] Failed to parse message: ${extractErrorMessage(err)}`);
        }
      });

      ws.on("close", () => {
        if (serverId && this.clients.has(serverId)) {
          debug(`[WS] Client disconnected: ${serverId}`);
          this.rejectPendingRequestsForServer(serverId, "Client disconnected");
          this.clients.delete(serverId);
          this.emit("client_disconnected", serverId);
        }
      });

      ws.on("error", (err) => {
        debug(`[WS] Client error: ${err.message}`);
        this.emit("error", err);
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.wss) {
        resolve();
        return;
      }

      debug(
        `[WS] Server #${this.instanceId} stopping - closing ${this.clients.size} client(s)`,
      );

      this.pendingRequests.forEach((pending) => {
        clearTimeout(pending.timer);
        pending.reject(new ShutdownError());
      });
      this.pendingRequests.clear();

      this.clients.forEach((client) => {
        client.ws.close();
      });
      this.clients.clear();

      const wss = this.wss;
      this.wss = null;

      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          debug("[WS] Server stopped (timeout fallback)");
          resolve();
        }
      }, 100);

      wss.close(() => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          debug("[WS] Server stopped");
          resolve();
        }
      });
    });
  }

  async request(
    serverId: string,
    method: string,
    params?: unknown,
  ): Promise<unknown> {
    const client = this.clients.get(serverId);
    if (!client) {
      throw new NoClientError(serverId);
    }

    const active = this.activeRequestsPerServer.get(serverId) || 0;

    if (active >= CONFIG.ws.maxConcurrentRequests) {
      debug(
        `[WS] Queueing request ${method} for ${serverId} (${active} active)`,
      );
      return new Promise((resolve, reject) => {
        const queue = this.requestQueues.get(serverId) || [];
        queue.push({ method, params, resolve, reject });
        this.requestQueues.set(serverId, queue);
      });
    }

    return this.executeRequest(serverId, method, params);
  }

  private async executeRequest(
    serverId: string,
    method: string,
    params?: unknown,
  ): Promise<unknown> {
    const client = this.clients.get(serverId);
    if (!client) {
      throw new NoClientError(serverId);
    }

    const active = this.activeRequestsPerServer.get(serverId) || 0;
    this.activeRequestsPerServer.set(serverId, active + 1);

    const id = this.nextRequestId++;
    const request: RPCRequest = { id, method, params };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        this.decrementActiveAndProcessQueue(serverId);
        reject(new RpcTimeoutError(method, CONFIG.ws.rpcTimeout));
      }, CONFIG.ws.rpcTimeout);

      this.pendingRequests.set(id, { serverId, resolve, reject, timer });

      try {
        client.ws.send(JSON.stringify(request));
        debug(`[WS] RPC request ${id}: ${method}`);
      } catch (err: unknown) {
        clearTimeout(timer);
        this.pendingRequests.delete(id);
        this.decrementActiveAndProcessQueue(serverId);
        reject(
          err instanceof Error ? err : new Error(extractErrorMessage(err)),
        );
      }
    });
  }

  private decrementActiveAndProcessQueue(serverId: string): void {
    const active = this.activeRequestsPerServer.get(serverId) || 1;
    this.activeRequestsPerServer.set(serverId, Math.max(0, active - 1));

    const queue = this.requestQueues.get(serverId);
    if (queue && queue.length > 0) {
      const next = queue.shift()!;
      debug(`[WS] Processing queued request ${next.method} for ${serverId}`);
      this.executeRequest(serverId, next.method, next.params)
        .then(next.resolve)
        .catch(next.reject);
    }
  }

  getConnectedServers(): string[] {
    return Array.from(this.clients.keys());
  }

  getServerMetadata(serverId: string): ServerMetadata | undefined {
    return this.clients.get(serverId)?.metadata;
  }

  isConnected(serverId: string): boolean {
    return this.clients.has(serverId);
  }

  private rejectPendingRequestsForServer(
    serverId: string,
    reason: string,
  ): void {
    for (const [id, pending] of this.pendingRequests) {
      if (pending.serverId === serverId) {
        clearTimeout(pending.timer);
        pending.reject(new Error(reason));
        this.pendingRequests.delete(id);
      }
    }

    const queue = this.requestQueues.get(serverId);
    if (queue) {
      for (const queued of queue) {
        queued.reject(new Error(reason));
      }
      this.requestQueues.delete(serverId);
    }

    this.activeRequestsPerServer.delete(serverId);
  }

  private handleRPCResponse(response: RPCResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) {
      debug(`[WS] Received response for unknown request: ${response.id}`);
      return;
    }

    clearTimeout(pending.timer);
    this.pendingRequests.delete(response.id);
    this.decrementActiveAndProcessQueue(pending.serverId);

    if (response.error) {
      pending.reject(new Error(response.error.message));
    } else {
      pending.resolve(response.result);
    }

    debug(
      `[WS] RPC response ${response.id}: ${response.error ? "error" : "success"}`,
    );
  }
}
