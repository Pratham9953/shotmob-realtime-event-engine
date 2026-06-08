import { env } from "../../config/env";
import { HttpError } from "../../utils/httpError";
import { insertAiSummary, listProcessedEventsByMatch } from "../events/event.repository";
import { getOpenAIClient } from "./openai.client";

export async function generateMatchSummary(matchId: string): Promise<{ summary: string; eventCount: number }> {
  const events = await listProcessedEventsByMatch(matchId);

  if (events.length === 0) {
    throw new HttpError(404, "No processed events found for this match yet");
  }

  const timeline = events
    .map((event) => `${event.minute ?? "?"}' ${event.team ?? "neutral"} ${event.type}: ${event.message}`)
    .join("\n");

  const openai = getOpenAIClient();
  const response = await openai.responses.create({
    model: env.OPENAI_SUMMARY_MODEL,
    input: [
      {
        role: "system",
        content:
          "You are a sports editor. Create a short, factual match summary from the event timeline. Avoid inventing scores or facts not in the events."
      },
      {
        role: "user",
        content: `Match ID: ${matchId}\nTimeline:\n${timeline}\n\nReturn 2-4 clear sentences.`
      }
    ]
  });

  const summary = response.output_text?.trim();
  if (!summary) throw new HttpError(502, "OpenAI returned an empty summary");

  await insertAiSummary({ matchId, summary, sourceEventCount: events.length });

  return { summary, eventCount: events.length };
}
