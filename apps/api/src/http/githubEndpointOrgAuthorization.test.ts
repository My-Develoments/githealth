import express from "express";
import { afterEach, describe, expect, it } from "vitest";
import { authorizeGitHubOrganizationForSource } from "./githubEndpointOrgAuthorization.js";
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

  app.get("/guard", (req, res) => {
    const sourceQuery = typeof req.query.source === "string" ? req.query.source : undefined;
    const source = sourceQuery === "mock" || sourceQuery === "live" ? sourceQuery : undefined;
    const org = typeof req.query.org === "string" ? req.query.org : "";

    if (!authorizeGitHubOrganizationForSource(org, source, res)) {
      return;
    }

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

describe("authorizeGitHubOrganizationForSource", () => {
  const previousApiAuthToken = process.env.API_AUTH_TOKEN;
  const previousAllowedGitHubOrgs = process.env.ALLOWED_GITHUB_ORGS;

  afterEach(() => {
    restoreEnv("API_AUTH_TOKEN", previousApiAuthToken);
    restoreEnv("ALLOWED_GITHUB_ORGS", previousAllowedGitHubOrgs);
  });

  it("returns PERMISSION_DENIED for live source outside allowlist", async () => {
    process.env.API_AUTH_TOKEN = "issue23-token";
    process.env.ALLOWED_GITHUB_ORGS = "another-org";

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/guard?org=githealth-labs&source=live`);
      const body = await response.json() as { code: string };

      expect(response.status).toBe(403);
      expect(body.code).toBe("PERMISSION_DENIED");
    });
  });

  it("matches allowlist case-insensitively for live source", async () => {
    process.env.API_AUTH_TOKEN = "issue23-token";
    process.env.ALLOWED_GITHUB_ORGS = "  GITHEALTH-LABS  ";

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/guard?org=GitHealth-Labs&source=live`);
      expect(response.status).toBe(200);
    });
  });

  it("bypasses allowlist for explicit mock source", async () => {
    process.env.API_AUTH_TOKEN = "issue23-token";
    process.env.ALLOWED_GITHUB_ORGS = "another-org";

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/guard?org=githealth-labs&source=mock`);
      expect(response.status).toBe(200);
    });
  });
});
