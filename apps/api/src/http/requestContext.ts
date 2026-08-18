import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const REQUEST_ID_HEADER = "x-request-id";

export function attachRequestContext(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(REQUEST_ID_HEADER);
  const requestId = incoming && incoming.trim().length > 0 ? incoming.trim() : randomUUID();

  res.setHeader(REQUEST_ID_HEADER, requestId);
  (res.locals as { requestId?: string }).requestId = requestId;
  next();
}

export function getRequestId(res: Response): string {
  return (res.locals as { requestId?: string }).requestId ?? "unknown";
}
