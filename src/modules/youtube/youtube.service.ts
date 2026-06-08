import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { createTextEmbedding } from "../ai/embedding.service";
import { getOpenAIClient } from "../ai/openai.client";
import { insertEvent } from "../events/event.repository";
import { createEventSchema, type CreateEventInput } from "../events/event.schemas";
import { enqueueEventProcessingJob } from "../../queues/event.queue";
import { publishSocketEvent } from "../../socket/socket.publisher";
import { createVideoIngestion, updateVideoIngestion } from "./youtube.repository";
import { enqueueVideoIngestionJob } from "../../queues/video.queue";

interface ExtractedHighlight {
  type: CreateEventInput["type"];
  team?: "home" | "away" | "neutral";
  player?: string;
  minute: number;
  description: string;
}

export async function requestYoutubeIngestion(params: {
  matchId: string;
  youtubeUrl: string;
  userId: string | null;
}) {
  const ingestion = await createVideoIngestion(params);

  await enqueueVideoIngestionJob({
    ingestionId: ingestion.id,
    matchId: params.matchId,
    youtubeUrl: params.youtubeUrl,
    userId: params.userId
  });

  await publishSocketEvent({
    matchId: params.matchId,
    eventName: "video-status",
    payload: { ingestionId: ingestion.id, status: "queued" }
  });

  return ingestion;
}

export async function processYoutubeIngestionJob(params: {
  ingestionId: string;
  matchId: string;
  youtubeUrl: string;
  userId: string | null;
}): Promise<void> {
  await updateVideoStatus(params.ingestionId, params.matchId, "downloading");

  const audioFilePath = await downloadYoutubeAudio(params.youtubeUrl, params.ingestionId);

  try {
    await updateVideoStatus(params.ingestionId, params.matchId, "transcribing");
    const transcript = await transcribeAudio(audioFilePath);

    await updateVideoStatus(params.ingestionId, params.matchId, "extracting_highlights");
    const highlights = await extractHighlightsFromTranscript(transcript);

    await updateVideoIngestion({
      ingestionId: params.ingestionId,
      status: "events_queued",
      transcript,
      highlights,
      error: null
    });

    for (const highlight of highlights) {
      const eventInput = createEventSchema.parse({
        matchId: params.matchId,
        type: highlight.type,
        team: highlight.team ?? "neutral",
        player: highlight.player,
        minute: highlight.minute,
        payload: { description: highlight.description, source: "youtube_transcript" }
      });

      const embedding = await createTextEmbedding(highlight.description);
      const event = await insertEvent({ input: eventInput, userId: params.userId, source: "youtube", embedding });
      await enqueueEventProcessingJob({ eventId: event.id, matchId: event.match_id });
    }

    await updateVideoStatus(params.ingestionId, params.matchId, "completed");
  } finally {
    await fs.rm(audioFilePath, { force: true }).catch((error) => {
      logger.warn({ error, audioFilePath }, "Failed to remove temporary audio file");
    });
  }
}

async function updateVideoStatus(ingestionId: string, matchId: string, status: string, error?: string): Promise<void> {
  await updateVideoIngestion({ ingestionId, status, error: error ?? null });
  await publishSocketEvent({ matchId, eventName: "video-status", payload: { ingestionId, status, error } });
}

async function downloadYoutubeAudio(youtubeUrl: string, ingestionId: string): Promise<string> {
  await fs.mkdir(env.TMP_DIR, { recursive: true });
  const outputTemplate = path.join(env.TMP_DIR, `${ingestionId}.%(ext)s`);
  const expectedPath = path.join(env.TMP_DIR, `${ingestionId}.mp3`);

  await runCommand(env.YTDLP_BINARY, [
    "-x",
    "--audio-format",
    "mp3",
    "--audio-quality",
    "5",
    "-o",
    outputTemplate,
    youtubeUrl
  ]);

  return expectedPath;
}

async function runCommand(command: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const childProcess = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";

    childProcess.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    childProcess.on("error", reject);
    childProcess.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}. ${stderr}`));
    });
  });
}

async function transcribeAudio(audioFilePath: string): Promise<string> {
  const openai = getOpenAIClient();
  const fsSync = await import("node:fs");

  const transcription = await openai.audio.transcriptions.create({
    file: fsSync.createReadStream(audioFilePath),
    model: env.OPENAI_TRANSCRIBE_MODEL,
    response_format: "text"
  });

  return String(transcription).trim();
}

async function extractHighlightsFromTranscript(transcript: string): Promise<ExtractedHighlight[]> {
  const openai = getOpenAIClient();
  const response = await openai.responses.create({
    model: env.OPENAI_SUMMARY_MODEL,
    input: [
      {
        role: "system",
        content:
          "Extract sports match highlights from a transcript. Return only valid JSON array. Do not include markdown. Allowed event types: goal, yellow_card, red_card, substitution, kickoff, half_time, full_time, penalty, save, injury, highlight, custom."
      },
      {
        role: "user",
        content:
          `Transcript:\n${transcript.slice(0, 40_000)}\n\n` +
          `Return JSON like [{"type":"goal","team":"home","player":"Name","minute":42,"description":"Home team scored from close range"}]. If exact minute is unknown, estimate the nearest minute from context.`
      }
    ]
  });

  const rawText = response.output_text?.trim() ?? "[]";
  const jsonText = rawText.replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
  const parsed = JSON.parse(jsonText) as ExtractedHighlight[];

  return parsed.slice(0, 25).map((highlight) => ({
    ...highlight,
    type: highlight.type ?? "highlight",
    minute: Math.max(0, Math.min(200, Number(highlight.minute) || 0))
  }));
}
