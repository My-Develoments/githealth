import type { NextFunction, Request, Response } from "express";
import { redactUnknown } from "./redaction.js";
import { getRequestId } from "../../http/requestContext.js";

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;

    const logEvent = redactUnknown({
      event: "http_request",
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(3)),
      requestId: getRequestId(res)
    });

    console.log(JSON.stringify(logEvent));
  });

  next();
}
