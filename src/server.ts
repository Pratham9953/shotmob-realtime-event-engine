import http from "node:http";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { createExpressApp } from "./app";
import { initializeSocketServer } from "./socket/socket.service";

async function bootstrap(): Promise<void> {
  const app = createExpressApp();
  const httpServer = http.createServer(app);

  await initializeSocketServer(httpServer);

  httpServer.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, "API + Socket.IO server started");
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "Shutting down server");
    httpServer.close(() => process.exit(0));
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

bootstrap().catch((error) => {
  logger.error({ error }, "Failed to start server");
  process.exit(1);
});
