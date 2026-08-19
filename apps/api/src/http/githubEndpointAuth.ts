import { createHash, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { getApiProtectionConfig } from "../infrastructure/security/apiProtectionConfig.js";
import { sendApiError } from "./errorEnvelope.js";

function extractBearerToken(header: string | undefined): { token?: string; missing: boolean } {
  if (typeof header !== "string" || header.trim().length === 0) {
    return { missing: true };
  }

  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return { missing: false };
  }

  const token = match[1]?.trim();
  if (!token) {
    return { missing: false };
  }

  return {
    token,
    missing: false
  };
}

function digestToken(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function tokenMatches(expected: string, actual: string): boolean {
  const expectedDigest = digestToken(expected);
  const actualDigest = digestToken(actual);
  return timingSafeEqual(expectedDigest, actualDigest);
}

export function githubEndpointAuth(req: Request, res: Response, next: NextFunction): void {
  const { apiAuthToken } = getApiProtectionConfig();
  const authHeader = req.header("authorization");
  const parsed = extractBearerToken(authHeader);

  if (parsed.missing) {
    sendApiError(res, {
      status: 401,
      code: "AUTH_MISSING",
      message: "Missing Authorization bearer token."
    });
    return;
  }

  if (!parsed.token || !tokenMatches(apiAuthToken, parsed.token)) {
    sendApiError(res, {
      status: 401,
      code: "AUTH_INVALID",
      message: "Invalid Authorization bearer token."
    });
    return;
  }

  next();
}
