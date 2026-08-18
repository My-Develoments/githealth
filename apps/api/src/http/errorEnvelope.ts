import type { Response } from "express";
import { redactString } from "../infrastructure/observability/redaction.js";
import { getRequestId } from "./requestContext.js";

export type ApiErrorPayload = {
  status: number;
  code: string;
  message: string;
};

export function sendApiError(res: Response, payload: ApiErrorPayload): void {
  res.status(payload.status).json({
    code: payload.code,
    message: redactString(payload.message),
    requestId: getRequestId(res)
  });
}
