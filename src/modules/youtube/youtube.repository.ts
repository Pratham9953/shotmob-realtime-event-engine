import { dbPool } from "../../db/pool";

export interface VideoIngestionRecord {
  id: string;
  match_id: string;
  youtube_url: string;
  status: string;
  transcript: string | null;
  highlights: unknown;
  error: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export async function createVideoIngestion(params: {
  matchId: string;
  youtubeUrl: string;
  userId: string | null;
}): Promise<VideoIngestionRecord> {
  await dbPool.query(
    `INSERT INTO matches (id)
     VALUES ($1)
     ON CONFLICT (id) DO UPDATE SET updated_at = now()`,
    [params.matchId]
  );

  const result = await dbPool.query<VideoIngestionRecord>(
    `INSERT INTO video_ingestions (match_id, youtube_url, created_by)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [params.matchId, params.youtubeUrl, params.userId]
  );

  return result.rows[0];
}

export async function updateVideoIngestion(params: {
  ingestionId: string;
  status: string;
  transcript?: string | null;
  highlights?: unknown;
  error?: string | null;
}): Promise<VideoIngestionRecord> {
  const result = await dbPool.query<VideoIngestionRecord>(
    `UPDATE video_ingestions
     SET status = $2,
         transcript = COALESCE($3, transcript),
         highlights = COALESCE($4::jsonb, highlights),
         error = $5,
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [
      params.ingestionId,
      params.status,
      params.transcript ?? null,
      params.highlights === undefined ? null : JSON.stringify(params.highlights),
      params.error ?? null
    ]
  );

  return result.rows[0];
}
