import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getGitHubOrganizationScore, resetGitHubScoreCache } from "../application/githubScoringService.js";
import { LiveGitHubOrganizationAdapter } from "../infrastructure/github/live/liveGitHubOrganizationAdapter.js";
import { opsRoutes } from "./opsRoutes.js";
import { attachRequestContext } from "./requestContext.js";

function restoreEnv(name: string, previous: string | undefined): void {
  if (typeof previous === "undefined") {
    delete process.env[name];
    return;
  }

  process.env[name] = previous;
}

async function withServer<T>(run: (baseUrl: string) => Promise<T>): Promise<T> {
  const app = express();
  app.use(attachRequestContext);
  app.use(opsRoutes);

  const server = await new Promise<import("node:http").Server>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Unable to resolve server address");
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    return await run(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}

describe("opsRoutes", () => {
  const previousToken = process.env.GITHUB_TOKEN;
  const previousMaxRetries = process.env.GITHUB_MAX_RETRIES;
  const previousCacheTtlMs = process.env.GITHUB_SCORE_CACHE_TTL_MS;

  afterEach(() => {
    vi.restoreAllMocks();
    resetGitHubScoreCache();
    restoreEnv("GITHUB_TOKEN", previousToken);
    restoreEnv("GITHUB_MAX_RETRIES", previousMaxRetries);
    restoreEnv("GITHUB_SCORE_CACHE_TTL_MS", previousCacheTtlMs);
  });

  it("returns deterministic liveness payload", async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health`);
      const body = await response.json() as { status: string };

      expect(response.status).toBe(200);
      expect(body).toEqual({ status: "ok" });
      expect(response.headers.get("x-request-id")).toBeTruthy();
    });
  });

  it("returns readiness payload with service metadata", async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/ready`);
      const body = await response.json() as {
        status: string;
        service: string;
        version: string;
        environment: string;
        checks: { configuration: string };
      };

      expect(response.status).toBe(200);
      expect(body.status).toBe("ready");
      expect(typeof body.service).toBe("string");
      expect(typeof body.version).toBe("string");
      expect(typeof body.environment).toBe("string");
      expect(body.checks.configuration).toBe("ok");
      expect(response.headers.get("x-request-id")).toBeTruthy();
    });
  });

  it("returns safe cache statistics in readiness payload", async () => {
    process.env.GITHUB_TOKEN = "test-token";
    process.env.GITHUB_MAX_RETRIES = "0";
    process.env.GITHUB_SCORE_CACHE_TTL_MS = "15000";

    const fetchOrganizationData = vi.spyOn(LiveGitHubOrganizationAdapter.prototype, "fetchOrganizationData");
    fetchOrganizationData.mockResolvedValue({
      organizationId: "cache-org",
      organizationName: "Cache Org",
      repositories: [],
      issues: [],
      fetchStatus: "complete",
      calculatedAt: "2026-01-01T00:00:00.000Z"
    });

    await getGitHubOrganizationScore("cache-org", "live");
    await getGitHubOrganizationScore("cache-org", "live");

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/ready`);
      const body = await response.json() as {
        checks: {
          githubScoreCache: {
            strategy: string;
            ttlMs: number;
            hits: number;
            misses: number;
            size: number;
          };
        };
      };

      expect(response.status).toBe(200);
      expect(body.checks.githubScoreCache).toEqual({
        strategy: "in-memory",
        ttlMs: 15000,
        hits: 1,
        misses: 1,
        size: 1
      });
      expect(JSON.stringify(body)).not.toContain("test-token");
      expect(JSON.stringify(body)).not.toContain("Cache Org");
    });
  });
});
