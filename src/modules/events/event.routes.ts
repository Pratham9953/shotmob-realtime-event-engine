import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { createMatchEvent, getMatchEvents } from "./event.service";
import { createEventSchema } from "./event.schemas";

export const eventRouter = Router();

eventRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = createEventSchema.parse(req.body);
    const event = await createMatchEvent(input, req.user?.id ?? null);
    res.status(202).json({ success: true, data: event });
  })
);

eventRouter.get(
  "/:matchId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await getMatchEvents(req.params.matchId as any);
    res.json({ success: true, data: result });
  })
);
