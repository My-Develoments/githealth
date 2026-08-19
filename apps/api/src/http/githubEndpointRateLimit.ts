import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { getApiProtectionConfig } from "../infrastructure/security/apiProtectionConfig.js";
import { sendApiError } from "./errorEnvelope.js";

type RateLimitWindowState = {
  windowStartMs: number;
  count: number;
};

type RateLimitDependencies = {
  now: () => number;
};

const MAX_TRACKED_CLIENTS = 5000;

function extractBearerToken(header: string | undefined): string | undefined {
  if (typeof header !== "string" || header.trim().length === 0) {
    return undefined;
  }

  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return undefined;
  }

  const token = match[1]?.trim();
  return token && token.length > 0 ? token : undefined;
}

function hashToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function deriveClientIdentity(req: Request): string {
  const token = extractBearerToken(req.header("authorization"));
  if (token) {
    return `token:${hashToken(token)}`;
  }

  const ip = req.ip || req.socket.remoteAddress || "unknown";
  return `ip:${ip}`;
}

function pruneExpiredEntries(entries: Map<string, RateLimitWindowState>, now: number, windowMs: number): void {
  if (entries.size <= MAX_TRACKED_CLIENTS) {
    return;
  }

  for (const [key, entry] of entries.entries()) {
    if (now - entry.windowStartMs >= windowMs) {
      entries.delete(key);
    }

    if (entries.size <= MAX_TRACKED_CLIENTS) {
      return;
    }
  }
}

function toEpochSeconds(timestampMs: number): number {
  return Math.floor(timestampMs / 1000);
}

function computeRetryAfterSeconds(resetAtMs: number, nowMs: number): number {
  const remainingMs = Math.max(0, resetAtMs - nowMs);
  return Math.max(1, Math.ceil(remainingMs / 1000));
}

function applyRateLimitHeaders(
  res: Response,
  limit: number,
  remaining: number,
  resetAtMs: number,
  retryAfterSeconds?: number
): void {
  res.setHeader("X-RateLimit-Limit", String(limit));
  res.setHeader("X-RateLimit-Remaining", String(Math.max(0, remaining)));
  res.setHeader("X-RateLimit-Reset", String(toEpochSeconds(resetAtMs)));

  if (typeof retryAfterSeconds === "number") {
    res.setHeader("Retry-After", String(retryAfterSeconds));
  }
}

export function createGitHubEndpointRateLimitMiddleware(
  dependencies: Partial<RateLimitDependencies> = {}
) {
  const now = dependencies.now ?? (() => Date.now());
  // In-memory map is intentionally process-local. Limits are enforced per Node process instance.
  const windows = new Map<string, RateLimitWindowState>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const config = getApiProtectionConfig();
    const timestamp = now();
    const identity = deriveClientIdentity(req);
    const windowMs = config.githubEndpointRateLimitWindowMs;
    const maxRequests = config.githubEndpointRateLimitMaxRequests;

    pruneExpiredEntries(windows, timestamp, windowMs);

    const existing = windows.get(identity);
    if (!existing || timestamp - existing.windowStartMs >= windowMs) {
      const resetAtMs = timestamp + windowMs;
      windows.set(identity, {
        windowStartMs: timestamp,
        count: 1
      });
      applyRateLimitHeaders(res, maxRequests, maxRequests - 1, resetAtMs);
      next();
      return;
    }

    if (existing.count >= maxRequests) {
      const resetAtMs = existing.windowStartMs + windowMs;
      const retryAfterSeconds = computeRetryAfterSeconds(resetAtMs, timestamp);
      applyRateLimitHeaders(res, maxRequests, 0, resetAtMs, retryAfterSeconds);
      sendApiError(res, {
        status: 429,
        code: "RATE_LIMITED",
        message: "Request rate limit exceeded for GitHub health endpoints."
      });
      return;
    }

    existing.count += 1;
    windows.set(identity, existing);
    const resetAtMs = existing.windowStartMs + windowMs;
    applyRateLimitHeaders(res, maxRequests, maxRequests - existing.count, resetAtMs);
    next();
  };
}

export const githubEndpointRateLimit = createGitHubEndpointRateLimitMiddleware();
