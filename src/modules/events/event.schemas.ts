import { z } from "zod";

export const eventTypeSchema = z.enum([
  "goal",
  "yellow_card",
  "red_card",
  "substitution",
  "kickoff",
  "half_time",
  "full_time",
  "penalty",
  "save",
  "injury",
  "highlight",
  "custom"
]);

export const createEventSchema = z.object({
  matchId: z.string().min(1).max(100),
  type: eventTypeSchema,
  team: z.enum(["home", "away", "neutral"]).optional(),
  player: z.string().min(1).max(120).optional(),
  minute: z.number().int().min(0).max(200),

  payload: z.object({}).catchall(z.unknown()).default({})
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
