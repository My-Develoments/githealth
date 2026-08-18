import express from "express";
import { afterEach, describe, expect, it } from "vitest";
import { sendApiError } from "./errorEnvelope.js";
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
  app.get("/test-error", (_req, res) => {
    sendApiError(res, {
      status: 500,
      code: "UPSTREAM_UNAVAILABLE",
      message: "Authorization: Bearer abc123"
    });
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

describe("sendApiError", () => {
  const previousToken = process.env.GITHUB_TOKEN;

  afterEach(() => {
    restoreEnv("GITHUB_TOKEN", previousToken);
  });

  it("redacts token-like values and includes request id", async () => {
    process.env.GITHUB_TOKEN = "abc123";

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/test-error`);
      const body = await response.json() as { code: string; message: string; requestId: string };

      expect(response.status).toBe(500);
      expect(body.code).toBe("UPSTREAM_UNAVAILABLE");
      expect(body.message).not.toContain("abc123");
      expect(body.message).toContain("Bearer [REDACTED]");
      expect(typeof body.requestId).toBe("string");
      expect(body.requestId.length).toBeGreaterThan(0);
    });
  });
});
