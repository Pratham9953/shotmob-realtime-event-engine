import { QueueEvents, Worker } from "bullmq";
import { logger } from "../config/logger";
import { createBullMQConnection } from "../redis/redis";
import { VIDEO_QUEUE_NAME } from "../queues/queueNames";
import type { VideoIngestionJobData } from "../queues/video.queue";
import { processYoutubeIngestionJob } from "../modules/youtube/youtube.service";
import { updateVideoIngestion } from "../modules/youtube/youtube.repository";
import { publishSocketEvent } from "../socket/socket.publisher";

const worker = new Worker<VideoIngestionJobData>(
  VIDEO_QUEUE_NAME,
  async (job) => {
    await processYoutubeIngestionJob(job.data);
  },
  {
    connection: createBullMQConnection("video-worker", "consumer"),
    concurrency: 2
  }
);

const queueEvents = new QueueEvents(VIDEO_QUEUE_NAME, {
  connection: createBullMQConnection("video-queue-events", "consumer")
});

queueEvents.on("failed", async ({ jobId, failedReason }) => {
  logger.error({ jobId, failedReason }, "Video ingestion job failed");
});

worker.on("failed", async (job, error) => {
  logger.error({ jobId: job?.id, error }, "Video worker failed job");

  if (job?.data) {
    await updateVideoIngestion({
      ingestionId: job.data.ingestionId,
      status: "failed",
      error: error.message
    });

    await publishSocketEvent({
      matchId: job.data.matchId,
      eventName: "video-status",
      payload: { ingestionId: job.data.ingestionId, status: "failed", error: error.message }
    });
  }
});

logger.info("Video worker started");
