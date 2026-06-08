import pg from "pg";
import { env } from "../config/env";

export const dbPool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: env.NODE_ENV === "production" ? 20 : 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000
});

export async function closeDatabasePool(): Promise<void> {
  await dbPool.end();
}
