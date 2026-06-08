import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { requestYoutubeIngestion } from "./youtube.service";

export const youtubeRouter = Router();

const youtubeIngestionSchema = z.object({
  matchId: z.string().min(1).max(100),
  youtubeUrl: z.string().url().refine((url) => url.includes("youtube.com") || url.includes("youtu.be"), {
    message: "Only YouTube URLs are supported"
  })
});

youtubeRouter.post(
  "/ingest",
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = youtubeIngestionSchema.parse(req.body);
    const ingestion = await requestYoutubeIngestion({
      matchId: input.matchId,
      youtubeUrl: input.youtubeUrl,
      userId: req.user?.id ?? null
    });

    res.status(202).json({ success: true, data: ingestion });
  })
);
