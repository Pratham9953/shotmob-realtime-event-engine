import type { Server as HttpServer } from "node:http";
import { createAdapter } from "@socket.io/redis-adapter";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { Server } from "socket.io";
import { env, allowedClientOrigins } from "../config/env";
import { logger } from "../config/logger";
import { redisPublisher, redisSubscriber } from "../redis/redis";
import { SOCKET_EVENTS_CHANNEL } from "../queues/queueNames";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
  ServerEventName,
  ServerEventPayload,
  SocketPublishMessage
} from "./socket.types";

type SocketServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

let io: SocketServer | null = null;
let workerBroadcastSubscribed = false;

const SERVER_EVENT_NAMES: readonly ServerEventName[] = [
  "raw-event",
  "processed-event",
  "video-status",
  "error"
];

export function getSocketServer(): SocketServer {
  if (!io) {
    throw new Error("Socket.IO server has not been initialized");
  }

  return io;
}

export async function initializeSocketServer(
  httpServer: HttpServer
): Promise<SocketServer> {
  io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    Record<string, never>,
    SocketData
  >(httpServer, {
    cors: {
      origin: allowedClientOrigins,
      credentials: true
    }
  });

  // Redis adapter makes room broadcasting work when you horizontally scale API instances.
  io.adapter(createAdapter(redisPublisher, redisSubscriber));

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;

    if (typeof token !== "string" || !token.trim()) {
      next();
      return;
    }

    try {
      const decodedToken = jwt.verify(token, env.JWT_SECRET) as JwtPayload & {
        sub?: string;
        email?: string;
      };

      if (!decodedToken.sub || !decodedToken.email) {
        next(new Error("Invalid socket auth token"));
        return;
      }

      socket.data.user = {
        id: decodedToken.sub,
        email: decodedToken.email
      };

      next();
    } catch {
      next(new Error("Invalid socket auth token"));
    }
  });

  io.on("connection", (socket) => {
    logger.info(
      {
        socketId: socket.id,
        user: socket.data.user
      },
      "Socket connected"
    );

    socket.on("join-match", (payload, ack) => {
      if (!payload?.matchId) {
        ack?.({
          success: false,
          message: "matchId is required"
        });
        return;
      }

      socket.join(getMatchRoomName(payload.matchId));

      ack?.({
        success: true
      });
    });

    socket.on("leave-match", (payload) => {
      if (!payload?.matchId) return;

      socket.leave(getMatchRoomName(payload.matchId));
    });

    socket.on("disconnect", (reason) => {
      logger.info(
        {
          socketId: socket.id,
          reason
        },
        "Socket disconnected"
      );
    });
  });

  await subscribeToWorkerBroadcasts();

  return io;
}

export function getMatchRoomName(matchId: string): string {
  return `match:${matchId}`;
}

export function emitToMatchRoom<TEventName extends ServerEventName>(
  matchId: string,
  eventName: TEventName,
  payload: ServerEventPayload<TEventName>
): void {
  const socketServer = getSocketServer();

  /**
   * Socket.IO's typed emit can become too strict when eventName comes from a generic.
   * This localized typed emitter avoids unsafe `never` casting while preserving our event map.
   */
  const roomEmitter = socketServer.to(getMatchRoomName(matchId)) as {
    emit<TName extends ServerEventName>(
      eventName: TName,
      payload: ServerEventPayload<TName>
    ): boolean;
  };

  roomEmitter.emit(eventName, payload);
}

async function subscribeToWorkerBroadcasts(): Promise<void> {
  if (workerBroadcastSubscribed) {
    return;
  }

  workerBroadcastSubscribed = true;

  await redisSubscriber.subscribe(SOCKET_EVENTS_CHANNEL);

  redisSubscriber.on("message", (_channel, rawMessage) => {
    try {
      const message = parseSocketPublishMessage(rawMessage);

      if (!message) {
        logger.warn({ rawMessage }, "Invalid socket broadcast message ignored");
        return;
      }

      emitWorkerMessage(message);
    } catch (error) {
      logger.error(
        {
          error,
          rawMessage
        },
        "Failed to parse socket broadcast message"
      );
    }
  });
}

function emitWorkerMessage(message: SocketPublishMessage): void {
  switch (message.eventName) {
    case "raw-event":
      emitToMatchRoom(message.matchId, "raw-event", message.payload);
      return;

    case "processed-event":
      emitToMatchRoom(message.matchId, "processed-event", message.payload);
      return;

    case "video-status":
      emitToMatchRoom(message.matchId, "video-status", message.payload);
      return;

    case "error":
      if (!isErrorPayload(message.payload)) {
        logger.warn(
          {
            payload: message.payload
          },
          "Invalid socket error payload ignored"
        );
        return;
      }

      emitToMatchRoom(message.matchId, "error", message.payload);
      return;

    default:
      assertNever(message.eventName);
  }
}

function parseSocketPublishMessage(rawMessage: string): SocketPublishMessage | null {
  const parsed = JSON.parse(rawMessage) as Partial<SocketPublishMessage>;

  if (typeof parsed.matchId !== "string" || !parsed.matchId.trim()) {
    return null;
  }

  if (!isServerEventName(parsed.eventName)) {
    return null;
  }

  return {
    matchId: parsed.matchId,
    eventName: parsed.eventName,
    payload: parsed.payload
  } as SocketPublishMessage;
}

function isServerEventName(value: unknown): value is ServerEventName {
  return (
    typeof value === "string" &&
    SERVER_EVENT_NAMES.includes(value as ServerEventName)
  );
}

function isErrorPayload(value: unknown): value is { message: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof (value as { message?: unknown }).message === "string"
  );
}

function assertNever(value: never): never {
  throw new Error(`Unhandled socket event: ${String(value)}`);
}