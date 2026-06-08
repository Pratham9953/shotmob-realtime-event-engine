import { Queue, Worker, QueueEvents } from "bullmq";
import { logger } from "../config/logger";
import { createRedisConnection } from "../redis/redis";
import { createBullMQConnection } from "../redis/redis";
import { EVENT_DLQ_NAME, EVENT_QUEUE_NAME } from "../queues/queueNames";
import type { EventProcessingJobData } from "../queues/event.queue";
import { findEventById, insertProcessedEvent } from "../modules/events/event.repository";
import { createTextEmbedding } from "../modules/ai/embedding.service";
import { publishSocketEvent } from "../socket/socket.publisher";

const deadLetterQueue = new Queue(EVENT_DLQ_NAME, {
  connection: createBullMQConnection("event-dlq", "consumer")
});

const worker = new Worker<EventProcessingJobData>(
  EVENT_QUEUE_NAME,
  async (job) => {
    const { eventId, matchId } = job.data;
    const event = await findEventById(eventId);

    if (!event) {
      throw new Error(`Event ${eventId} not found`);
    }

    if (event.match_id !== matchId) {
      throw new Error(`Event ${eventId} does not belong to match ${matchId}`);
    }

    const message = buildProcessedEventMessage(event);
    const embedding = await createTextEmbedding(message);
    const processedEvent = await insertProcessedEvent({ event, message, embedding });

    await publishSocketEvent({
      matchId: event.match_id,
      eventName: "processed-event",
      payload: { status: "processed", event: processedEvent }
    });

    return processedEvent;
  },
  {
    connection: createBullMQConnection("event-worker", "consumer"),
    concurrency: 10,
    limiter: { max: 100, duration: 1_000 }
  }
);

const queueEvents = new QueueEvents(EVENT_QUEUE_NAME, {
  connection: createBullMQConnection("event-queue-events", "consumer")
});

queueEvents.on("failed", async ({ jobId, failedReason }) => {
  logger.error({ jobId, failedReason }, "Event job failed");

  // BullMQ already retains failed jobs. This explicit DLQ makes failure review clear in an interview.
  await deadLetterQueue.add("failed-event", { jobId, failedReason, failedAt: new Date().toISOString() });
});

worker.on("completed", (job) => {
  logger.info({ jobId: job.id }, "Event job completed");
});

worker.on("failed", (job, error) => {
  logger.error({ jobId: job?.id, error }, "Event worker failed job");
});

function buildProcessedEventMessage(event: {
  type: string;
  team: string | null;
  player: string | null;
  minute: number | null;
  payload: Record<string, unknown>;
}): string {
  const minuteLabel = event.minute === null ? "Unknown minute" : `${event.minute}'`;
  const teamLabel = event.team ? `${event.team} team` : "Match";
  const playerLabel = event.player ? ` by ${event.player}` : "";
  const description = typeof event.payload.description === "string" ? ` - ${event.payload.description}` : "";

  return `${minuteLabel}: ${teamLabel} ${event.type}${playerLabel}${description}`;
}

logger.info("Event worker started");
