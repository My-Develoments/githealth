import express from "express";
import { afterEach, describe, expect, it } from "vitest";
import { createGitHubEndpointRateLimitMiddleware } from "./githubEndpointRateLimit.js";
import { attachRequestContext } from "./requestContext.js";

function restoreEnv(name: string, previous: string | undefined): void {
  if (typeof previous === "undefined") {
    delete process.env[name];
    return;
  }

  process.env[name] = previous;
}

async function withServer<T>(
  middleware: ReturnType<typeof createGitHubEndpointRateLimitMiddleware>,
  run: (baseUrl: string) => Promise<T>
): Promise<T> {
  const app = express();
  app.use(attachRequestContext);
  app.use(middleware);
  app.get("/health-score/github/organization", (_req, res) => {
    res.json({ ok: true });
  });

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

describe("createGitHubEndpointRateLimitMiddleware", () => {
  const previousApiAuthToken = process.env.API_AUTH_TOKEN;
  const previousWindowMs = process.env.GITHUB_ENDPOINT_RATE_LIMIT_WINDOW_MS;
  const previousMaxRequests = process.env.GITHUB_ENDPOINT_RATE_LIMIT_MAX_REQUESTS;

  afterEach(() => {
    restoreEnv("API_AUTH_TOKEN", previousApiAuthToken);
    restoreEnv("GITHUB_ENDPOINT_RATE_LIMIT_WINDOW_MS", previousWindowMs);
    restoreEnv("GITHUB_ENDPOINT_RATE_LIMIT_MAX_REQUESTS", previousMaxRequests);
  });

  it("resets request counters after window expiry without real-time waiting", async () => {
    process.env.API_AUTH_TOKEN = "issue23-token";
    process.env.GITHUB_ENDPOINT_RATE_LIMIT_WINDOW_MS = "1000";
    process.env.GITHUB_ENDPOINT_RATE_LIMIT_MAX_REQUESTS = "2";

    let now = 1000;
    const middleware = createGitHubEndpointRateLimitMiddleware({
      now: () => now
    });

    await withServer(middleware, async (baseUrl) => {
      const headers = {
        Authorization: "Bearer issue23-token"
      };

      const first = await fetch(`${baseUrl}/health-score/github/organization`, { headers });
      const second = await fetch(`${baseUrl}/health-score/github/organization`, { headers });
      const third = await fetch(`${baseUrl}/health-score/github/organization`, { headers });

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(third.status).toBe(429);

      expect(first.headers.get("x-ratelimit-limit")).toBe("2");
      expect(first.headers.get("x-ratelimit-remaining")).toBe("1");
      expect(first.headers.get("x-ratelimit-reset")).toBe("2");

      expect(second.headers.get("x-ratelimit-limit")).toBe("2");
      expect(second.headers.get("x-ratelimit-remaining")).toBe("0");
      expect(second.headers.get("x-ratelimit-reset")).toBe("2");

      expect(third.headers.get("x-ratelimit-limit")).toBe("2");
      expect(third.headers.get("x-ratelimit-remaining")).toBe("0");
      expect(third.headers.get("x-ratelimit-reset")).toBe("2");
      expect(third.headers.get("retry-after")).toBe("1");

      now += 1001;

      const afterReset = await fetch(`${baseUrl}/health-score/github/organization`, { headers });
      expect(afterReset.status).toBe(200);
      expect(afterReset.headers.get("x-ratelimit-limit")).toBe("2");
      expect(afterReset.headers.get("x-ratelimit-remaining")).toBe("1");
      expect(afterReset.headers.get("x-ratelimit-reset")).toBe("3");
    });
  });

  it("keeps counters isolated per middleware instance (process-local memory)", async () => {
    process.env.API_AUTH_TOKEN = "issue23-token";
    process.env.GITHUB_ENDPOINT_RATE_LIMIT_WINDOW_MS = "60000";
    process.env.GITHUB_ENDPOINT_RATE_LIMIT_MAX_REQUESTS = "1";

    const middlewareA = createGitHubEndpointRateLimitMiddleware({ now: () => 1000 });
    const middlewareB = createGitHubEndpointRateLimitMiddleware({ now: () => 1000 });

    await withServer(middlewareA, async (baseUrl) => {
      const headers = {
        Authorization: "Bearer issue23-token"
      };

      const first = await fetch(`${baseUrl}/health-score/github/organization`, { headers });
      const second = await fetch(`${baseUrl}/health-score/github/organization`, { headers });
      expect(first.status).toBe(200);
      expect(second.status).toBe(429);
    });

    await withServer(middlewareB, async (baseUrl) => {
      const headers = {
        Authorization: "Bearer issue23-token"
      };

      const first = await fetch(`${baseUrl}/health-score/github/organization`, { headers });
      expect(first.status).toBe(200);
    });
  });
});
