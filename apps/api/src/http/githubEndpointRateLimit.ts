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
      windows.set(identity, {
        windowStartMs: timestamp,
        count: 1
      });
      next();
      return;
    }

    if (existing.count >= maxRequests) {
      sendApiError(res, {
        status: 429,
        code: "RATE_LIMITED",
        message: "Request rate limit exceeded for GitHub health endpoints."
      });
      return;
    }

    existing.count += 1;
    windows.set(identity, existing);
    next();
  };
}

export const githubEndpointRateLimit = createGitHubEndpointRateLimitMiddleware();
