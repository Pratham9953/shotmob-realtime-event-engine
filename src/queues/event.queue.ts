import { Queue } from "bullmq";
import { createBullMQConnection } from "../redis/redis";
import { EVENT_QUEUE_NAME } from "./queueNames";

export interface EventProcessingJobData {
  eventId: string;
  matchId: string;
}

export const PROCESS_EVENT_JOB_NAME = "process-event" as const;

type EventProcessingJobName = typeof PROCESS_EVENT_JOB_NAME;

export const eventQueue = new Queue<
  EventProcessingJobData,
  unknown,
  EventProcessingJobName
>(EVENT_QUEUE_NAME, {
  connection: createBullMQConnection("event-queue"),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2_000 },
    removeOnComplete: { count: 1_000 },
    removeOnFail: { count: 5_000 }
  }
});

export async function enqueueEventProcessingJob(
  data: EventProcessingJobData
): Promise<void> {
  await eventQueue.add(PROCESS_EVENT_JOB_NAME, data, {
    jobId: `event-${data.eventId}`
  });
}