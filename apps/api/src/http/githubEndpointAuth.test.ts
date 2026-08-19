import express from "express";
import { afterEach, describe, expect, it } from "vitest";
import { githubEndpointAuth } from "./githubEndpointAuth.js";
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
  app.use(githubEndpointAuth);
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

describe("githubEndpointAuth", () => {
  const previousApiAuthToken = process.env.API_AUTH_TOKEN;

  afterEach(() => {
    restoreEnv("API_AUTH_TOKEN", previousApiAuthToken);
  });

  it("returns AUTH_MISSING when authorization header is absent", async () => {
    process.env.API_AUTH_TOKEN = "issue23-token";

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health-score/github/organization`);
      const body = await response.json() as { code: string; requestId: string };

      expect(response.status).toBe(401);
      expect(body.code).toBe("AUTH_MISSING");
      expect(typeof body.requestId).toBe("string");
      expect(body.requestId.length).toBeGreaterThan(0);
    });
  });

  it("returns AUTH_INVALID when token is invalid", async () => {
    process.env.API_AUTH_TOKEN = "issue23-token";

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health-score/github/organization`, {
        headers: {
          Authorization: "Bearer wrong-token"
        }
      });
      const body = await response.json() as { code: string };

      expect(response.status).toBe(401);
      expect(body.code).toBe("AUTH_INVALID");
    });
  });

  it("allows request when token is valid", async () => {
    process.env.API_AUTH_TOKEN = "issue23-token";

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health-score/github/organization`, {
        headers: {
          Authorization: "Bearer issue23-token"
        }
      });

      expect(response.status).toBe(200);
    });
  });
});
