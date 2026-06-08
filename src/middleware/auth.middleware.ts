import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { HttpError } from "../utils/httpError";

interface JwtPayload {
  sub: string;
  email: string;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const authorizationHeader = req.headers.authorization;

  if (!authorizationHeader?.startsWith("Bearer ")) {
    next(new HttpError(401, "Missing bearer token"));
    return;
  }

  const token = authorizationHeader.replace("Bearer ", "").trim();

  try {
    const decodedToken = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = { id: decodedToken.sub, email: decodedToken.email };
    next();
  } catch {
    next(new HttpError(401, "Invalid or expired token"));
  }
}
