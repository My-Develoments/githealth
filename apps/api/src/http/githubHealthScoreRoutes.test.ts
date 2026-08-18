import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { githubHealthScoreRoutes } from "./githubHealthScoreRoutes.js";

function restoreEnv(name: string, previous: string | undefined): void {
  if (typeof previous === "undefined") {
    delete process.env[name];
    return;
  }

  process.env[name] = previous;
}

async function withServer<T>(run: (baseUrl: string) => Promise<T>): Promise<T> {
  const app = express();
  app.use("/health-score/github", githubHealthScoreRoutes);

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

describe("githubHealthScoreRoutes", () => {
  const previousToken = process.env.GITHUB_TOKEN;
  const previousRetries = process.env.GITHUB_MAX_RETRIES;
  const previousRetryDelay = process.env.GITHUB_RETRY_BASE_DELAY_MS;

  afterEach(() => {
    vi.restoreAllMocks();
    restoreEnv("GITHUB_TOKEN", previousToken);
    restoreEnv("GITHUB_MAX_RETRIES", previousRetries);
    restoreEnv("GITHUB_RETRY_BASE_DELAY_MS", previousRetryDelay);
  });

  it("returns 400 when org query is missing", async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health-score/github/organization`);
      const body = await response.json() as { code: string };

      expect(response.status).toBe(400);
      expect(body.code).toBe("INVALID_REQUEST");
    });
  });

  it("returns DTO-only organization payload for mock source", async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health-score/github/organization?org=githealth-labs&source=mock`);
      const body = await response.json() as {
        organization: {
          categories: Array<Record<string, unknown>>;
        };
      };

      expect(response.status).toBe(200);
      expect(body.organization.categories[0]).not.toHaveProperty("contributions");
    });
  });

  it("returns 404 when repository id does not exist", async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health-score/github/repositories/does-not-exist?org=githealth-labs&source=mock`);
      const body = await response.json() as { code: string };

      expect(response.status).toBe(404);
      expect(body.code).toBe("NOT_FOUND");
    });
  });

  it("returns RATE_LIMITED for secondary throttling in live source", async () => {
    process.env.GITHUB_TOKEN = "test-token";
    process.env.GITHUB_MAX_RETRIES = "0";

    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url.startsWith("http://127.0.0.1")) {
        return originalFetch(input, init);
      }

      return new Response(
        JSON.stringify({
          message: "You have exceeded a secondary rate limit."
        }),
        {
          status: 403,
          headers: {
            "content-type": "application/json",
            "x-ratelimit-remaining": "0"
          }
        }
      );
    });

    vi.stubGlobal("fetch", fetchMock);

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health-score/github/organization?org=githealth-labs&source=live`);
      const body = await response.json() as { code: string };

      expect(response.status).toBe(429);
      expect(body.code).toBe("RATE_LIMITED");
    });
  });

  it("returns a stable failed score response for required live collection failures", async () => {
    process.env.GITHUB_TOKEN = "test-token";
    process.env.GITHUB_MAX_RETRIES = "0";

    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url.startsWith("http://127.0.0.1")) {
        return originalFetch(input, init);
      }

      return new Response(
        JSON.stringify({
          message: "Server error"
        }),
        {
          status: 500,
          headers: {
            "content-type": "application/json"
          }
        }
      );
    });

    vi.stubGlobal("fetch", fetchMock);

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health-score/github/organization?org=githealth-labs&source=live`);
      const body = await response.json() as {
        fetchStatus: string;
        adapterIssues: Array<{ code: string; message: string }>;
      };

      expect(response.status).toBe(200);
      expect(body.fetchStatus).toBe("failed");
      expect(body.adapterIssues).toEqual([
        {
          code: "UPSTREAM_UNAVAILABLE",
          message: "Required organization collection failed: GitHub upstream is unavailable."
        }
      ]);
    });
  });
});
