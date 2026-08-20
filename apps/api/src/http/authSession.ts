import { createHash, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { AuthenticatedAppContext } from "../domain/auth/types.js";
import { resolveAuthenticatedSession } from "../application/authService.js";
import { getApiProtectionConfig } from "../infrastructure/security/apiProtectionConfig.js";
import { sendApiError } from "./errorEnvelope.js";
import { readCookieValue, setAuthenticatedAppContext } from "./requestContext.js";

export const AUTH_SESSION_COOKIE = "githealth_auth_session";

type AuthenticatedResponseLocals = {
  authenticatedApp?: AuthenticatedAppContext | null;
};

function digestToken(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function tokenMatches(expected: string, actual: string): boolean {
  const expectedDigest = digestToken(expected);
  const actualDigest = digestToken(actual);
  return timingSafeEqual(expectedDigest, actualDigest);
}

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

function shouldUseSecureCookie(): boolean {
  return process.env.NODE_ENV === "production";
}

export function buildAuthSessionCookieValue(sessionToken: string, maxAgeSeconds = 7 * 24 * 60 * 60): string {
  const attributes = [
    `${AUTH_SESSION_COOKIE}=${encodeURIComponent(sessionToken)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`
  ];

  if (shouldUseSecureCookie()) {
    attributes.push("Secure");
  }

  return attributes.join("; ");
}

export function setAuthSessionCookie(res: Response, sessionToken: string): void {
  res.append("Set-Cookie", buildAuthSessionCookieValue(sessionToken));
}

export function clearAuthSessionCookie(res: Response): void {
  const attributes = [
    `${AUTH_SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0"
  ];

  if (shouldUseSecureCookie()) {
    attributes.push("Secure");
  }

  res.append("Set-Cookie", attributes.join("; "));
}

export function resolveAuthSessionToken(req: Request): string | undefined {
  return readCookieValue(req.header("cookie"), AUTH_SESSION_COOKIE);
}

export async function resolveAuthenticatedAppFromRequest(req: Request) {
  return resolveAuthenticatedSession(resolveAuthSessionToken(req));
}

export function getAuthenticatedAppContext(res: Response) {
  return (res.locals as AuthenticatedResponseLocals).authenticatedApp ?? null;
}

export function requireAuthenticatedAppAccess(req: Request, res: Response, next: NextFunction): void {
  if (req.path === "/callback" || req.path === "/start" || req.path.startsWith("/callback/") || req.path.startsWith("/start/")) {
    next();
    return;
  }

  void (async () => {
    const authenticatedApp = await resolveAuthenticatedAppFromRequest(req);
    if (authenticatedApp) {
      (res.locals as AuthenticatedResponseLocals).authenticatedApp = authenticatedApp;
      setAuthenticatedAppContext(authenticatedApp);
      next();
      return;
    }

    const { apiAuthToken, internalServiceTokenBypassEnabled } = getApiProtectionConfig();
    const parsedBearer = extractBearerToken(req.header("authorization"));

    if (
      internalServiceTokenBypassEnabled &&
      !parsedBearer.missing &&
      parsedBearer.token &&
      tokenMatches(apiAuthToken, parsedBearer.token)
    ) {
      next();
      return;
    }

    clearAuthSessionCookie(res);
    sendApiError(res, {
      status: 401,
      code: parsedBearer.missing ? "AUTH_MISSING" : "AUTH_INVALID",
      message: parsedBearer.missing
        ? "Authentication is required to access GitHealth."
        : "Authentication is invalid or expired."
    });
  })().catch(next);
}