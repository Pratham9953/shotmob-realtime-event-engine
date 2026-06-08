import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { logger } from "../config/logger";
import { env } from "../config/env";
import { HttpError } from "../utils/httpError";

export function notFoundMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

export function errorMiddleware(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: error.flatten().fieldErrors
    });
    return;
  }

  if (error instanceof HttpError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
      details: error.details
    });
    return;
  }

  const err =
    error instanceof Error
      ? error
      : new Error(typeof error === "string" ? error : JSON.stringify(error));

  logger.error(
    {
      err,
      method: req.method,
      url: req.originalUrl,
      body: req.body
    },
    "Unhandled application error"
  );

  res.status(500).json({
    success: false,
    message: "Internal server error",
    ...(env.NODE_ENV === "development"
      ? {
          debug: err.message,
          stack: err.stack
        }
      : {})
  });
}