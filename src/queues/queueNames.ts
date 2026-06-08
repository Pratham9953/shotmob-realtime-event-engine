export const EVENT_QUEUE_NAME = "event-processing";
export const EVENT_DLQ_NAME = "event-processing-dlq";
export const VIDEO_QUEUE_NAME = "youtube-video-ingestion";
export const SOCKET_EVENTS_CHANNEL = "socket-events";

export const PROCESS_EVENT_JOB_NAME = "process-event" as const;
export const INGEST_YOUTUBE_VIDEO_JOB_NAME = "ingest-youtube-video" as const;
export const FAILED_EVENT_JOB_NAME = "failed-event" as const;