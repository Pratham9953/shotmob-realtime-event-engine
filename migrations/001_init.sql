CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  home_team TEXT,
  away_team TEXT,
  status TEXT NOT NULL DEFAULT 'live',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  team TEXT,
  player TEXT,
  minute INT CHECK (minute >= 0 AND minute <= 200),
  source TEXT NOT NULL DEFAULT 'manual',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  embedding vector(1536),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS processed_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  team TEXT,
  player TEXT,
  minute INT,
  message TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  embedding vector(1536),
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  source_event_count INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS video_ingestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  youtube_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  transcript TEXT,
  highlights JSONB,
  error TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_match_created ON events(match_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_processed_events_match_processed ON processed_events(match_id, processed_at ASC);
CREATE INDEX IF NOT EXISTS idx_processed_events_match_minute ON processed_events(match_id, minute ASC);
CREATE INDEX IF NOT EXISTS idx_ai_summaries_match_created ON ai_summaries(match_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_ingestions_match_created ON video_ingestions(match_id, created_at DESC);

-- Vector indexes are useful after data grows. Keep them partial so null vectors are ignored.
CREATE INDEX IF NOT EXISTS idx_events_embedding_hnsw
  ON events USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_processed_events_embedding_hnsw
  ON processed_events USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;
