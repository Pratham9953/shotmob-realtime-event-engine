import fs from "node:fs/promises";
import path from "node:path";
import { dbPool } from "./pool";
import { logger } from "../config/logger";

async function runMigrations(): Promise<void> {
  const migrationsDir = path.join(process.cwd(), "migrations");
  const files = (await fs.readdir(migrationsDir))
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort();

  for (const fileName of files) {
    const sql = await fs.readFile(path.join(migrationsDir, fileName), "utf8");
    logger.info({ fileName }, "Running migration");
    await dbPool.query(sql);
  }

  logger.info("Migrations completed");
  await dbPool.end();
}

runMigrations().catch(async (error) => {
  logger.error({ error }, "Migration failed");
  await dbPool.end();
  process.exit(1);
});
