import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { githubHealthScoreRoutes } from "./githubHealthScoreRoutes.js";
import { healthScoreRoutes } from "./healthScoreRoutes.js";
import { attachRequestContext } from "./requestContext.js";
import { resetGitHubScoreCache } from "../application/githubScoringService.js";

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
  app.use("/health-score", healthScoreRoutes);
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
  const previousApiAuthToken = process.env.API_AUTH_TOKEN;
  const previousAllowedGitHubOrgs = process.env.ALLOWED_GITHUB_ORGS;
  const previousInboundWindow = process.env.GITHUB_ENDPOINT_RATE_LIMIT_WINDOW_MS;
  const previousInboundMax = process.env.GITHUB_ENDPOINT_RATE_LIMIT_MAX_REQUESTS;
  const previousRetries = process.env.GITHUB_MAX_RETRIES;
  const previousRetryDelay = process.env.GITHUB_RETRY_BASE_DELAY_MS;

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    resetGitHubScoreCache();
    restoreEnv("GITHUB_TOKEN", previousToken);
    restoreEnv("API_AUTH_TOKEN", previousApiAuthToken);
    restoreEnv("ALLOWED_GITHUB_ORGS", previousAllowedGitHubOrgs);
    restoreEnv("GITHUB_ENDPOINT_RATE_LIMIT_WINDOW_MS", previousInboundWindow);
    restoreEnv("GITHUB_ENDPOINT_RATE_LIMIT_MAX_REQUESTS", previousInboundMax);
    restoreEnv("GITHUB_MAX_RETRIES", previousRetries);
    restoreEnv("GITHUB_RETRY_BASE_DELAY_MS", previousRetryDelay);
  });

  function configureSecurity(overrides?: {
    apiAuthToken?: string;
    allowedGitHubOrgs?: string;
    windowMs?: string;
    maxRequests?: string;
  }) {
    process.env.API_AUTH_TOKEN = overrides?.apiAuthToken ?? "issue23-token";
    process.env.ALLOWED_GITHUB_ORGS = overrides?.allowedGitHubOrgs ?? "githealth-labs";
    process.env.GITHUB_ENDPOINT_RATE_LIMIT_WINDOW_MS = overrides?.windowMs ?? "60000";
    process.env.GITHUB_ENDPOINT_RATE_LIMIT_MAX_REQUESTS = overrides?.maxRequests ?? "60";
  }

  function authHeaders(token = "issue23-token") {
    return {
      Authorization: `Bearer ${token}`
    };
  }

  it("returns 401 AUTH_MISSING when live request Authorization header is absent", async () => {
    configureSecurity();

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health-score/github/organization?org=githealth-labs&source=live`);
      const body = await response.json() as { code: string; requestId: string };

      expect(response.status).toBe(401);
      expect(body.code).toBe("AUTH_MISSING");
      expect(typeof body.requestId).toBe("string");
      expect(body.requestId.length).toBeGreaterThan(0);
    });
  });

  it("returns 401 AUTH_INVALID for live request with invalid auth scheme", async () => {
    configureSecurity();

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health-score/github/organization?org=githealth-labs&source=live`, {
        headers: {
          Authorization: "Basic abc123"
        }
      });
      const body = await response.json() as { code: string };

      expect(response.status).toBe(401);
      expect(body.code).toBe("AUTH_INVALID");
    });
  });

  it("preserves explicit mock source behavior without auth requirement", async () => {
    configureSecurity();

    await withServer(async (baseUrl) => {
      const mockResponse = await fetch(`${baseUrl}/health-score/github/organization?org=githealth-labs&source=mock`);

      expect(mockResponse.status).toBe(200);
    });
  });

  it("returns 400 when org query is missing", async () => {
    configureSecurity();

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health-score/github/organization`);
      const body = await response.json() as { code: string };

      expect(response.status).toBe(400);
      expect(body.code).toBe("INVALID_REQUEST");
    });
  });

  it("returns 400 when org query is invalid", async () => {
    configureSecurity();

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health-score/github/organization?org=bad_org_slug`);
      const body = await response.json() as { code: string };

      expect(response.status).toBe(400);
      expect(body.code).toBe("INVALID_REQUEST");
    });
  });

  it("returns 400 when source query is invalid", async () => {
    configureSecurity();

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health-score/github/organization?org=githealth-labs&source=staging`);
      const body = await response.json() as { code: string; message: string; requestId: string };

      expect(response.status).toBe(400);
      expect(body.code).toBe("INVALID_REQUEST");
      expect(body.message).toBe("Invalid source query parameter.");
      expect(typeof body.requestId).toBe("string");
      expect(body.requestId.length).toBeGreaterThan(0);
    });
  });

  it("returns 403 when live source org is outside allowlist", async () => {
    configureSecurity({ allowedGitHubOrgs: "another-org" });

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health-score/github/organization?org=githealth-labs&source=live`, {
        headers: authHeaders()
      });
      const body = await response.json() as { code: string };

      expect(response.status).toBe(403);
      expect(body.code).toBe("PERMISSION_DENIED");
    });
  });

  it("matches allowlisted live organizations case-insensitively", async () => {
    configureSecurity({ allowedGitHubOrgs: "GITHEALTH-LABS" });
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
      const response = await fetch(`${baseUrl}/health-score/github/organization?org=GitHealth-Labs&source=live`, {
        headers: authHeaders()
      });

      expect(response.status).toBe(200);
    });
  });

  it("does not apply live org allowlist to mock source", async () => {
    configureSecurity({ allowedGitHubOrgs: "another-org" });

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health-score/github/organization?org=githealth-labs&source=mock`);

      expect(response.status).toBe(200);
    });
  });

  it("allows live request with valid auth token to proceed", async () => {
    configureSecurity({ allowedGitHubOrgs: "githealth-labs" });
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
      const response = await fetch(`${baseUrl}/health-score/github/organization?org=githealth-labs&source=live`, {
        headers: authHeaders()
      });

      expect(response.status).toBe(200);
    });
  });

  it("returns DTO-only organization payload for mock source", async () => {
    configureSecurity();
    process.env.GITHUB_TOKEN = "test-token";
    process.env.API_AUTH_TOKEN = "test-api-auth-token";

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health-score/github/organization?org=githealth-labs&source=mock`);
      const body = await response.json() as {
        organization: {
          categories: Array<Record<string, unknown>>;
        };
      };

      expect(response.status).toBe(200);
      expect(body.organization.categories[0]).not.toHaveProperty("contributions");
      expect(JSON.stringify(body)).not.toContain("GITHUB_TOKEN");
      expect(JSON.stringify(body)).not.toContain("test-token");
    });
  });

  it("returns 404 when repository id does not exist", async () => {
    configureSecurity();

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health-score/github/repositories/does-not-exist?org=githealth-labs&source=mock`);
      const body = await response.json() as { code: string };

      expect(response.status).toBe(404);
      expect(body.code).toBe("NOT_FOUND");
    });
  });

  it("returns RATE_LIMITED for secondary throttling in live source", async () => {
    configureSecurity();
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
      const response = await fetch(`${baseUrl}/health-score/github/organization?org=githealth-labs&source=live`, {
        headers: authHeaders()
      });
      const body = await response.json() as { code: string };

      expect(response.status).toBe(429);
      expect(body.code).toBe("RATE_LIMITED");
    });
  });

  it("returns a stable failed score response for required live collection failures", async () => {
    configureSecurity();
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
      const response = await fetch(`${baseUrl}/health-score/github/organization?org=githealth-labs&source=live`, {
        headers: authHeaders()
      });
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

  it("applies inbound rate limiting to GitHub routes", async () => {
    configureSecurity({
      apiAuthToken: "issue23-throttle-token",
      maxRequests: "2",
      windowMs: "60000"
    });
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
      const first = await fetch(`${baseUrl}/health-score/github/organization?org=githealth-labs&source=live`, {
        headers: authHeaders("issue23-throttle-token")
      });
      const second = await fetch(`${baseUrl}/health-score/github/organization?org=githealth-labs&source=live`, {
        headers: authHeaders("issue23-throttle-token")
      });
      const third = await fetch(`${baseUrl}/health-score/github/organization?org=githealth-labs&source=live`, {
        headers: authHeaders("issue23-throttle-token")
      });
      const body = await third.json() as { code: string };

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(third.status).toBe(429);
      expect(body.code).toBe("RATE_LIMITED");
    });
  });

  it("does not apply GitHub inbound rate limiting to explicit mock source", async () => {
    configureSecurity({ maxRequests: "1", windowMs: "60000" });

    await withServer(async (baseUrl) => {
      const first = await fetch(`${baseUrl}/health-score/github/organization?org=githealth-labs&source=mock`);
      const second = await fetch(`${baseUrl}/health-score/github/organization?org=githealth-labs&source=mock`);

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
    });
  });

  it("does not apply GitHub rate limiting to non-GitHub health-score routes", async () => {
    configureSecurity({ maxRequests: "1", windowMs: "60000" });

    await withServer(async (baseUrl) => {
      const first = await fetch(`${baseUrl}/health-score/organization`);
      const second = await fetch(`${baseUrl}/health-score/organization`);

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
    });
  });
});
