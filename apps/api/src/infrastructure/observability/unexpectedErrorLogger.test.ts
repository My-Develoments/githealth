import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { attachRequestContext } from "../../http/requestContext.js";
import { logUnexpectedError } from "./unexpectedErrorLogger.js";

async function withServer<T>(run: (baseUrl: string) => Promise<T>): Promise<T> {
  const app = express();
  app.use(attachRequestContext);
  app.get("/boom/:secret", (req, res) => {
    logUnexpectedError(new Error(`Authorization: Bearer ${req.params.secret}`), req, res);
    res.status(500).end();
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
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }
        resolve();
      });
    });
  }
}

describe("logUnexpectedError", () => {
  const previousApiAuthToken = process.env.API_AUTH_TOKEN;

  afterEach(() => {
    vi.restoreAllMocks();
    if (typeof previousApiAuthToken === "undefined") {
      delete process.env.API_AUTH_TOKEN;
      return;
    }
    process.env.API_AUTH_TOKEN = previousApiAuthToken;
  });

  it("logs sanitized request context and error details for unexpected failures", async () => {
    process.env.API_AUTH_TOKEN = "secure-api-token";
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/boom/secure-api-token`);
      expect(response.status).toBe(500);
    });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const rawLog = errorSpy.mock.calls[0]?.[0] as string;
    const payload = JSON.parse(rawLog) as {
      event: string;
      method: string;
      path: string;
      requestId: string;
      errorName: string;
      errorMessage: string;
      errorStack?: string;
    };

    expect(payload.event).toBe("http_unexpected_error");
    expect(payload.method).toBe("GET");
    expect(payload.path).toBe("/boom/:secret");
    expect(payload.requestId).toBeTruthy();
    expect(payload.errorName).toBe("Error");
    expect(payload.errorMessage).toContain("Bearer [REDACTED]");
    expect(rawLog).not.toContain("secure-api-token");
  });
});