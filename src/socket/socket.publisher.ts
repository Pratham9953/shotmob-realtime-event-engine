import { redisPublisher } from "../redis/redis";
import { SOCKET_EVENTS_CHANNEL } from "../queues/queueNames";
import type { ServerEventName, SocketPublishMessage } from "./socket.types";

export async function publishSocketEvent<TEventName extends ServerEventName>(
  params: SocketPublishMessage<TEventName>
): Promise<void> {
  await redisPublisher.publish(SOCKET_EVENTS_CHANNEL, JSON.stringify(params));
}