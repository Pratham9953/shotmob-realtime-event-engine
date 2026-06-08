import { dbPool } from "../../db/pool";
import { toVectorLiteral } from "../../utils/vector";
import type { CreateEventInput } from "./event.schemas";

export interface EventRecord {
  id: string;
  match_id: string;
  type: string;
  team: string | null;
  player: string | null;
  minute: number;
  source: string;
  payload: Record<string, unknown>;
  created_by: string | null;
  created_at: Date;
}

export interface ProcessedEventRecord {
  id: string;
  event_id: string;
  match_id: string;
  type: string;
  team: string | null;
  player: string | null;
  minute: number | null;
  message: string;
  payload: Record<string, unknown>;
  processed_at: Date;
}

export async function upsertMatch(matchId: string): Promise<void> {
  await dbPool.query(
    `INSERT INTO matches (id)
     VALUES ($1)
     ON CONFLICT (id) DO UPDATE SET updated_at = now()`,
    [matchId]
  );
}

export async function insertEvent(params: {
  input: CreateEventInput;
  userId: string | null;
  source: "manual" | "youtube";
  embedding: number[] | null;
}): Promise<EventRecord> {
  await upsertMatch(params.input.matchId);

  const result = await dbPool.query<EventRecord>(
    `INSERT INTO events (match_id, type, team, player, minute, source, payload, created_by, embedding)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9::vector)
     RETURNING id, match_id, type, team, player, minute, source, payload, created_by, created_at`,
    [
      params.input.matchId,
      params.input.type,
      params.input.team ?? null,
      params.input.player ?? null,
      params.input.minute,
      params.source,
      JSON.stringify(params.input.payload ?? {}),
      params.userId,
      toVectorLiteral(params.embedding)
    ]
  );

  return result.rows[0];
}

export async function findEventById(eventId: string): Promise<EventRecord | null> {
  const result = await dbPool.query<EventRecord>(
    `SELECT id, match_id, type, team, player, minute, source, payload, created_by, created_at
     FROM events WHERE id = $1`,
    [eventId]
  );
  return result.rows[0] ?? null;
}

export async function listEventsByMatch(matchId: string): Promise<EventRecord[]> {
  const result = await dbPool.query<EventRecord>(
    `SELECT id, match_id, type, team, player, minute, source, payload, created_by, created_at
     FROM events
     WHERE match_id = $1
     ORDER BY minute ASC, created_at ASC`,
    [matchId]
  );
  return result.rows;
}

export async function listProcessedEventsByMatch(matchId: string): Promise<ProcessedEventRecord[]> {
  const result = await dbPool.query<ProcessedEventRecord>(
    `SELECT id, event_id, match_id, type, team, player, minute, message, payload, processed_at
     FROM processed_events
     WHERE match_id = $1
     ORDER BY COALESCE(minute, 9999) ASC, processed_at ASC`,
    [matchId]
  );
  return result.rows;
}

export async function insertProcessedEvent(params: {
  event: EventRecord;
  message: string;
  embedding: number[] | null;
}): Promise<ProcessedEventRecord> {
  const result = await dbPool.query<ProcessedEventRecord>(
    `INSERT INTO processed_events (event_id, match_id, type, team, player, minute, message, payload, embedding)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::vector)
     ON CONFLICT (event_id) DO UPDATE SET
       message = EXCLUDED.message,
       payload = EXCLUDED.payload,
       embedding = EXCLUDED.embedding,
       processed_at = now()
     RETURNING id, event_id, match_id, type, team, player, minute, message, payload, processed_at`,
    [
      params.event.id,
      params.event.match_id,
      params.event.type,
      params.event.team,
      params.event.player,
      params.event.minute,
      params.message,
      JSON.stringify(params.event.payload ?? {}),
      toVectorLiteral(params.embedding)
    ]
  );

  return result.rows[0];
}

export async function insertAiSummary(params: {
  matchId: string;
  summary: string;
  sourceEventCount: number;
}): Promise<void> {
  await dbPool.query(
    `INSERT INTO ai_summaries (match_id, summary, source_event_count)
     VALUES ($1, $2, $3)`,
    [params.matchId, params.summary, params.sourceEventCount]
  );
}
