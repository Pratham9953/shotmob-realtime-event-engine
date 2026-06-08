import { dbPool } from "../../db/pool";

export interface UserRecord {
  id: string;
  email: string;
  password_hash: string;
  created_at: Date;
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const result = await dbPool.query<UserRecord>("SELECT * FROM users WHERE email = $1", [email]);
  return result.rows[0] ?? null;
}

export async function createUser(email: string, passwordHash: string): Promise<UserRecord> {
  const result = await dbPool.query<UserRecord>(
    `INSERT INTO users (email, password_hash)
     VALUES ($1, $2)
     RETURNING *`,
    [email, passwordHash]
  );
  return result.rows[0];
}
