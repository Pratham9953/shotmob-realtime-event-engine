import OpenAI from "openai";
import { env } from "../../config/env";
import { HttpError } from "../../utils/httpError";

let openaiClient: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!env.OPENAI_API_KEY) {
    throw new HttpError(500, "OPENAI_API_KEY is not configured");
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }

  return openaiClient;
}
