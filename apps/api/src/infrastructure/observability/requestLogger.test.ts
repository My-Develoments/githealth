import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { requestLogger } from "./requestLogger.js";
import { attachRequestContext } from "../../http/requestContext.js";
import { sendApiError } from "../../http/errorEnvelope.js";

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
  app.use(requestLogger);

  app.get("/ok", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/fail/:secret", (req, res) => {
    sendApiError(res, {
      status: 500,
      code: "UPSTREAM_UNAVAILABLE",
      message: `Authorization: Bearer ${req.params.secret}`
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

describe("requestLogger", () => {
  const previousToken = process.env.GITHUB_TOKEN;
  const previousApiAuthToken = process.env.API_AUTH_TOKEN;

  afterEach(() => {
    vi.restoreAllMocks();
    restoreEnv("GITHUB_TOKEN", previousToken);
    restoreEnv("API_AUTH_TOKEN", previousApiAuthToken);
  });

  it("logs method, path, status, durationMs, and requestId for successful requests", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/ok`);
      expect(response.status).toBe(200);
    });

    expect(logSpy).toHaveBeenCalled();
    const payload = JSON.parse(logSpy.mock.calls[0]?.[0] as string) as {
      method: string;
      path: string;
      status: number;
      durationMs: number;
      requestId: string;
    };

    expect(payload.method).toBe("GET");
    expect(payload.path).toBe("/ok");
    expect(payload.status).toBe(200);
    expect(typeof payload.durationMs).toBe("number");
    expect(payload.durationMs).toBeGreaterThanOrEqual(0);
    expect(typeof payload.requestId).toBe("string");
    expect(payload.requestId.length).toBeGreaterThan(0);
  });

  it("logs failure requests and redacts sensitive values through logger path", async () => {
    process.env.GITHUB_TOKEN = "secret-token";
    process.env.API_AUTH_TOKEN = "secure-api-token";
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/fail/secret-token`);
      expect(response.status).toBe(500);
    });

    expect(logSpy).toHaveBeenCalled();
    const rawLog = logSpy.mock.calls[0]?.[0] as string;
    const payload = JSON.parse(rawLog) as {
      method: string;
      path: string;
      status: number;
      durationMs: number;
      requestId: string;
    };

    expect(payload.method).toBe("GET");
    expect(payload.status).toBe(500);
    expect(typeof payload.durationMs).toBe("number");
    expect(typeof payload.requestId).toBe("string");
    expect(payload.path).toContain("[REDACTED]");
    expect(rawLog).not.toContain("secret-token");
    expect(rawLog).not.toContain("secure-api-token");
  });
});
