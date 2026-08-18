import express from "express";
import { describe, expect, it } from "vitest";
import { opsRoutes } from "./opsRoutes.js";
import { attachRequestContext } from "./requestContext.js";

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
});
