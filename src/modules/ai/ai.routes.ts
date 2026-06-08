import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { generateMatchSummary } from "./ai.service";

export const aiRouter = Router();

const summaryRequestSchema = z.object({
  matchId: z.string().min(1).max(100)
});

aiRouter.post(
  "/summary",
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = summaryRequestSchema.parse(req.body);
    const result = await generateMatchSummary(input.matchId);
    res.json({ success: true, data: result });
  })
);
