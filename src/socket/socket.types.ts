export interface ServerToClientEvents {
  "raw-event": (payload: unknown) => void;
  "processed-event": (payload: unknown) => void;
  "video-status": (payload: unknown) => void;
  error: (payload: { message: string }) => void;
}

export interface ClientToServerEvents {
  "join-match": (
    payload: { matchId: string },
    ack?: (response: { success: boolean; message?: string }) => void
  ) => void;

  "leave-match": (payload: { matchId: string }) => void;
}

export interface SocketData {
  user?: {
    id: string;
    email: string;
  };
}

export type ServerEventName = keyof ServerToClientEvents;

export type ServerEventPayload<TEventName extends ServerEventName> =
  Parameters<ServerToClientEvents[TEventName]>[0];

export type SocketPublishMessage<TEventName extends ServerEventName = ServerEventName> = {
  matchId: string;
  eventName: TEventName;
  payload: ServerEventPayload<TEventName>;
};