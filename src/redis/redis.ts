import IORedis from "ioredis";
import type { ConnectionOptions } from "bullmq";
import { env } from "../config/env";

export function createRedisConnection(connectionName: string): IORedis {
  return new IORedis(env.REDIS_URL, {
    connectionName,
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  });
}

export function createBullMQConnection(
  connectionName: string,
  mode: "producer" | "consumer" = "consumer"
): ConnectionOptions {
  const redisUrl = new URL(env.REDIS_URL);

  const dbPath = redisUrl.pathname.replace("/", "");
  const db = dbPath ? Number(dbPath) : 0;

  const connection: ConnectionOptions = {
    host: redisUrl.hostname,
    port: redisUrl.port ? Number(redisUrl.port) : 6379,
    db,
    connectionName,
    enableReadyCheck: false,

    // API queues should fail fast.
    // Workers can keep retrying.
    maxRetriesPerRequest: mode === "producer" ? 1 : null
  };

  if (redisUrl.username) {
    connection.username = decodeURIComponent(redisUrl.username);
  }

  if (redisUrl.password) {
    connection.password = decodeURIComponent(redisUrl.password);
  }

  if (redisUrl.protocol === "rediss:") {
    connection.tls = {};
  }

  return connection;
}

export const redisPublisher = createRedisConnection("socket-publisher");
export const redisSubscriber = createRedisConnection("socket-subscriber");