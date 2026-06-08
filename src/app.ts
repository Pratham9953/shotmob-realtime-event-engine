import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "node:path";
import { allowedClientOrigins } from "./config/env";
import { apiRateLimiter } from "./middleware/rateLimit.middleware";
import { errorMiddleware, notFoundMiddleware } from "./middleware/error.middleware";
import { authRouter } from "./modules/auth/auth.routes";
import { eventRouter } from "./modules/events/event.routes";
import { aiRouter } from "./modules/ai/ai.routes";
import { youtubeRouter } from "./modules/youtube/youtube.routes";

export function createExpressApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: allowedClientOrigins,
      credentials: true
    })
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(apiRateLimiter);

  app.get("/health", (_req, res) => {
    res.json({ success: true, service: "shotmob-event-engine", status: "ok" });
  });

  // Minimal browser client for interview demo.
  app.use(express.static(path.join(process.cwd(), "public")));

  app.use("/auth", authRouter);
  app.use("/events", eventRouter);
  app.use("/ai", aiRouter);
  app.use("/youtube", youtubeRouter);

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
