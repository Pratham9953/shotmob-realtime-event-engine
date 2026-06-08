import { createTextEmbedding } from "../ai/embedding.service";
import { enqueueEventProcessingJob } from "../../queues/event.queue";
import { emitToMatchRoom } from "../../socket/socket.service";
import { logger } from "../../config/logger";
import {
  insertEvent,
  listEventsByMatch,
  listProcessedEventsByMatch
} from "./event.repository";
import type { CreateEventInput } from "./event.schemas";

export async function createMatchEvent(
  input: CreateEventInput,
  userId: string | null
) {
  logger.info({ input, userId }, "Creating match event started");

  const eventText =
    `${input.minute}' ${input.team ?? "neutral"} ${input.type} ${input.player ?? ""}`.trim();

  logger.info({ eventText }, "Creating event embedding");

  const embedding = await createTextEmbedding(eventText);

  logger.info(
    {
      hasEmbedding: Boolean(embedding),
      embeddingLength: embedding?.length ?? 0
    },
    "Event embedding created"
  );

  logger.info("Inserting raw event into database");

  const event = await insertEvent({
    input,
    userId,
    source: "manual",
    embedding
  });

  logger.info({ eventId: event.id, matchId: event.match_id }, "Raw event inserted");

  logger.info({ eventId: event.id }, "Adding event processing job");

  await enqueueEventProcessingJob({
    eventId: event.id,
    matchId: event.match_id
  });

  logger.info({ eventId: event.id }, "Event processing job queued");

  try {
    emitToMatchRoom(event.match_id, "raw-event", {
      status: "accepted",
      event
    });

    logger.info({ eventId: event.id }, "Raw event socket emitted");
  } catch (error) {
    logger.warn(
      {
        err: error,
        eventId: event.id,
        matchId: event.match_id
      },
      "Raw event socket emit failed"
    );
  }

  return event;
}

export async function getMatchEvents(matchId: string) {
  const [rawEvents, processedEvents] = await Promise.all([
    listEventsByMatch(matchId),
    listProcessedEventsByMatch(matchId)
  ]);

  return {
    rawEvents,
    processedEvents
  };
}