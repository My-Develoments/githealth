import type { NextFunction, Request, Response } from "express";
import { GitHubAdapterError } from "../infrastructure/github/errors.js";
import { logUnexpectedError } from "../infrastructure/observability/unexpectedErrorLogger.js";
import { sendApiError } from "./errorEnvelope.js";

export function unexpectedErrorHandler(error: unknown, req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof GitHubAdapterError) {
    sendApiError(res, {
      status: error.status,
      code: error.code,
      message: error.message
    });
    return;
  }

  logUnexpectedError(error, req, res);
  sendApiError(res, {
    status: 500,
    code: "UPSTREAM_UNAVAILABLE",
    message: "Internal server error."
  });
}