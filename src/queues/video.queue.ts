import { Queue } from "bullmq";
import { createBullMQConnection } from "../redis/redis";
import { VIDEO_QUEUE_NAME, INGEST_YOUTUBE_VIDEO_JOB_NAME } from "./queueNames";

export interface VideoIngestionJobData {
  ingestionId: string;
  matchId: string;
  youtubeUrl: string;
  userId: string | null;
}

export type VideoIngestionJobName = typeof INGEST_YOUTUBE_VIDEO_JOB_NAME;
export type VideoIngestionJobResult = unknown;

export const videoQueue = new Queue<
  VideoIngestionJobData,
  VideoIngestionJobResult,
  VideoIngestionJobName
>(VIDEO_QUEUE_NAME, {
  connection: createBullMQConnection("video-queue", "producer"),
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 10_000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 2_000 }
  }
});

export async function enqueueVideoIngestionJob(
  data: VideoIngestionJobData
): Promise<void> {
  await videoQueue.add(INGEST_YOUTUBE_VIDEO_JOB_NAME, data, {
    jobId: `youtube-${data.ingestionId}`
  });
}