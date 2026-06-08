import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { getOpenAIClient } from "./openai.client";

export async function createTextEmbedding(text: string): Promise<number[] | null> {
  if (!env.ENABLE_EVENT_EMBEDDINGS) return null;

  try {
    const openai = getOpenAIClient();
    const response = await openai.embeddings.create({
      model: env.OPENAI_EMBEDDING_MODEL,
      input: text,
      encoding_format: "float"
    });

    return response.data[0]?.embedding ?? null;
  } catch (error) {
    // Embeddings are useful, but event ingestion should not fail because of a vector error.
    logger.warn({ error }, "Embedding generation failed; continuing without embedding");
    return null;
  }
}
