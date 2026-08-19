import express from "express";
import { afterEach, describe, expect, it } from "vitest";
import { isLocalDevelopmentCorsEnabled, localDevelopmentCors } from "./localDevelopmentCors.js";

function restoreEnv(name: string, previous: string | undefined): void {
  if (typeof previous === "undefined") {
    delete process.env[name];
    return;
  }

  process.env[name] = previous;
}

async function withServer<T>(run: (baseUrl: string) => Promise<T>): Promise<T> {
  const app = express();
  app.use(localDevelopmentCors);
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
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

describe("localDevelopmentCors", () => {
  const previousNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    restoreEnv("NODE_ENV", previousNodeEnv);
  });

  it("allows local development origins to read GET responses", async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health`, {
        headers: {
          Origin: "http://localhost:5174"
        }
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:5174");
      expect(response.headers.get("access-control-allow-methods")).toBe("GET, OPTIONS");
      expect(response.headers.get("access-control-allow-headers")).toBe("Accept, Authorization, x-github-app-session");
      expect(response.headers.get("access-control-allow-credentials")).toBe("true");
      expect(response.headers.get("vary")).toContain("Origin");
    });
  });

  it("responds to allowed preflight requests with the expected headers", async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health`, {
        method: "OPTIONS",
        headers: {
          Origin: "http://localhost:5173",
          "Access-Control-Request-Method": "GET",
          "Access-Control-Request-Headers": "Authorization, Accept, x-github-app-session"
        }
      });

      expect(response.status).toBe(204);
      expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
      expect(response.headers.get("access-control-allow-methods")).toBe("GET, OPTIONS");
      expect(response.headers.get("access-control-allow-headers")).toBe("Accept, Authorization, x-github-app-session");
      expect(response.headers.get("access-control-allow-credentials")).toBe("true");
    });
  });

  it("does not add cors headers for disallowed origins", async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health`, {
        headers: {
          Origin: "http://evil.example.com"
        }
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("access-control-allow-origin")).toBeNull();
      expect(response.headers.get("access-control-allow-methods")).toBeNull();
      expect(response.headers.get("access-control-allow-headers")).toBeNull();
    });
  });

  it("disables local development cors behavior in production mode", async () => {
    process.env.NODE_ENV = "production";

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health`, {
        headers: {
          Origin: "http://localhost:5174"
        }
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("access-control-allow-origin")).toBeNull();
      expect(response.headers.get("access-control-allow-methods")).toBeNull();
      expect(response.headers.get("access-control-allow-headers")).toBeNull();
    });
  });

  it("reports whether dev cors should be enabled", () => {
    process.env.NODE_ENV = "production";
    expect(isLocalDevelopmentCorsEnabled()).toBe(false);

    process.env.NODE_ENV = "development";
    expect(isLocalDevelopmentCorsEnabled()).toBe(true);
  });
});
