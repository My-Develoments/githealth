import type { Response } from "express";
import { redactString } from "../infrastructure/observability/redaction.js";
import { getRequestId } from "./requestContext.js";

export type ApiErrorPayload = {
  status: number;
  code: string;
  message: string;
  upstreamStatus?: number;
  organization?: string;
  requestedOrganization?: string;
  selectedOrganization?: string;
  allowedOrganizations?: string[];
  accessibleOrganizations?: string[];
};

export function sendApiError(res: Response, payload: ApiErrorPayload): void {
  res.status(payload.status).json({
    code: payload.code,
    message: redactString(payload.message),
    ...(typeof payload.upstreamStatus === "number" ? { upstreamStatus: payload.upstreamStatus } : {}),
    ...(typeof payload.organization === "string" ? { organization: payload.organization } : {}),
    ...(typeof payload.requestedOrganization === "string"
      ? { requestedOrganization: payload.requestedOrganization }
      : {}),
    ...(typeof payload.selectedOrganization === "string" ? { selectedOrganization: payload.selectedOrganization } : {}),
    ...(Array.isArray(payload.allowedOrganizations) ? { allowedOrganizations: payload.allowedOrganizations } : {}),
    ...(Array.isArray(payload.accessibleOrganizations)
      ? { accessibleOrganizations: payload.accessibleOrganizations }
      : {}),
    requestId: getRequestId(res)
  });
}
