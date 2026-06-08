import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../../config/env";
import { HttpError } from "../../utils/httpError";
import { createUser, findUserByEmail } from "./auth.repository";
import type { LoginInput, RegisterInput } from "./auth.schemas";

function signAccessToken(user: { id: string; email: string }): string {
  const options: SignOptions = {
    subject: user.id,
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"]
  };

  return jwt.sign({ email: user.email }, env.JWT_SECRET, options);
}

export async function registerUser(input: RegisterInput) {
  const existingUser = await findUserByEmail(input.email);
  if (existingUser) {
    throw new HttpError(409, "Email is already registered");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await createUser(input.email, passwordHash);
  const accessToken = signAccessToken({ id: user.id, email: user.email });

  return { user: { id: user.id, email: user.email }, accessToken };
}

export async function loginUser(input: LoginInput) {
  const user = await findUserByEmail(input.email);
  if (!user) throw new HttpError(401, "Invalid email or password");

  const isPasswordValid = await bcrypt.compare(input.password, user.password_hash);
  if (!isPasswordValid) throw new HttpError(401, "Invalid email or password");

  const accessToken = signAccessToken({ id: user.id, email: user.email });
  return { user: { id: user.id, email: user.email }, accessToken };
}
