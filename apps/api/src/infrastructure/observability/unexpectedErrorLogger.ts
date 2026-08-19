import type { Request, Response } from "express";
import { getRequestId } from "../../http/requestContext.js";
import { redactUnknown } from "./redaction.js";

function toErrorDetails(error: unknown): { name: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return {
    name: "UnknownError",
    message: typeof error === "string" ? error : "Unknown server error"
  };
}

export function logUnexpectedError(error: unknown, req: Request, res: Response): void {
  const details = toErrorDetails(error);
  const routePath = typeof req.route?.path === "string" ? req.route.path : req.path;

  const payload = redactUnknown({
    event: "http_unexpected_error",
    method: req.method,
    path: routePath,
    requestId: getRequestId(res),
    errorName: details.name,
    errorMessage: details.message,
    errorStack: details.stack
  });

  console.error(JSON.stringify(payload));
}