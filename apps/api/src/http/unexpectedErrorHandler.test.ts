import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GitHubAdapterError } from "../infrastructure/github/errors.js";
import { attachRequestContext } from "./requestContext.js";
import { unexpectedErrorHandler } from "./unexpectedErrorHandler.js";

async function withServer<T>(run: (baseUrl: string) => Promise<T>, route: (app: express.Express) => void): Promise<T> {
  const app = express();
  app.use(attachRequestContext);
  route(app);
  app.use(unexpectedErrorHandler);

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

describe("unexpectedErrorHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs unexpected errors and preserves the sanitized API error contract", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await withServer(
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/boom/secret-token`);
        const body = await response.json() as { code: string; message: string; requestId: string };

        expect(response.status).toBe(500);
        expect(body.code).toBe("UPSTREAM_UNAVAILABLE");
        expect(body.message).toBe("Internal server error.");
        expect(body.requestId).toBeTruthy();
      },
      (app) => {
        app.get("/boom/:secret", (req, _res, next) => {
          next(new Error(`Authorization: Bearer ${req.params.secret}`));
        });
      }
    );

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0]?.[0]).toContain("http_unexpected_error");
    expect(errorSpy.mock.calls[0]?.[0]).not.toContain("secret-token");
  });

  it("does not log expected adapter errors", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await withServer(
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/adapter-error`);
        const body = await response.json() as { code: string; message: string };

        expect(response.status).toBe(503);
        expect(body.code).toBe("UPSTREAM_UNAVAILABLE");
        expect(body.message).toBe("Adapter unavailable.");
      },
      (app) => {
        app.get("/adapter-error", (_req, _res, next) => {
          next(new GitHubAdapterError("UPSTREAM_UNAVAILABLE", "Adapter unavailable.", 503));
        });
      }
    );

    expect(errorSpy).not.toHaveBeenCalled();
  });
});