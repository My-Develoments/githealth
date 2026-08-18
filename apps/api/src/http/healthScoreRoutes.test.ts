import express from "express";
import { describe, expect, it } from "vitest";
import { healthScoreRoutes } from "./healthScoreRoutes.js";
import { attachRequestContext } from "./requestContext.js";

async function withServer<T>(run: (baseUrl: string) => Promise<T>): Promise<T> {
  const app = express();
  app.use(attachRequestContext);
  app.use("/health-score", healthScoreRoutes);

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

describe("healthScoreRoutes", () => {
  it("returns consistent safe error shape for unknown repository", async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health-score/repositories/unknown`);
      const body = await response.json() as { code: string; message: string; requestId: string };

      expect(response.status).toBe(404);
      expect(body.code).toBe("NOT_FOUND");
      expect(body.message).toBe("Repository not found for scenario.");
      expect(typeof body.requestId).toBe("string");
      expect(body.requestId.length).toBeGreaterThan(0);
    });
  });
});
