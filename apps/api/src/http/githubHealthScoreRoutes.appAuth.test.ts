import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createGitHubAppInstallationSession } from "../infrastructure/github/appAuth.js";
import { getGitHubConfig } from "../infrastructure/github/config.js";
import { resetGitHubScoreCache } from "../application/githubScoringService.js";
import { githubHealthScoreRoutes } from "./githubHealthScoreRoutes.js";
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

describe("githubHealthScoreRoutes app auth integration", () => {
  const previousApiAuthToken = process.env.API_AUTH_TOKEN;
  const previousAllowedGitHubOrgs = process.env.ALLOWED_GITHUB_ORGS;
  const previousProvider = process.env.GITHUB_AUTH_PROVIDER;
  const previousAppId = process.env.GITHUB_APP_ID;
  const previousAppPrivateKey = process.env.GITHUB_APP_PRIVATE_KEY;
  const previousAppInstallUrl = process.env.GITHUB_APP_INSTALL_URL;
  const previousAppInstallationId = process.env.GITHUB_APP_INSTALLATION_ID;
  const previousRetries = process.env.GITHUB_MAX_RETRIES;

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    resetGitHubScoreCache();
    restoreEnv("API_AUTH_TOKEN", previousApiAuthToken);
    restoreEnv("ALLOWED_GITHUB_ORGS", previousAllowedGitHubOrgs);
    restoreEnv("GITHUB_AUTH_PROVIDER", previousProvider);
    restoreEnv("GITHUB_APP_ID", previousAppId);
    restoreEnv("GITHUB_APP_PRIVATE_KEY", previousAppPrivateKey);
    restoreEnv("GITHUB_APP_INSTALL_URL", previousAppInstallUrl);
    restoreEnv("GITHUB_APP_INSTALLATION_ID", previousAppInstallationId);
    restoreEnv("GITHUB_MAX_RETRIES", previousRetries);
  });

  function configureAppMode(allowedOrgs = "githealth-labs"): void {
    process.env.API_AUTH_TOKEN = "issue47-token";
    process.env.ALLOWED_GITHUB_ORGS = allowedOrgs;
    process.env.GITHUB_AUTH_PROVIDER = "app";
    process.env.GITHUB_APP_ID = "12345";
    process.env.GITHUB_APP_PRIVATE_KEY = TEST_PRIVATE_KEY;
    process.env.GITHUB_APP_INSTALL_URL = "https://github.com/apps/githealth/installations/new";
    delete process.env.GITHUB_APP_INSTALLATION_ID;
    process.env.GITHUB_MAX_RETRIES = "0";
  }

  function authHeaders(sessionToken: string): Record<string, string> {
    return {
      Authorization: "Bearer issue47-token",
      "x-github-app-session": sessionToken
    };
  }

  it("uses session-backed app auth for live health requests after onboarding", async () => {
    configureAppMode();

    const sessionToken = createGitHubAppInstallationSession(
      getGitHubConfig(),
      {
        installationId: 77,
        organization: "githealth-labs",
        targetType: "Organization"
      }
    );

    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.startsWith("http://127.0.0.1")) {
        return originalFetch(input, init);
      }

      if (url.endsWith("/app/installations/77/access_tokens")) {
        return new Response(
          JSON.stringify({ token: "installation-access-token", expires_at: "2026-01-01T01:00:00.000Z" }),
          {
            status: 201,
            headers: {
              "content-type": "application/json"
            }
          }
        );
      }

      return new Response(
        JSON.stringify({ message: "Server error" }),
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
        headers: authHeaders(sessionToken)
      });
      const body = await response.json() as { fetchStatus: string; adapterIssues: Array<{ code: string }> };

      expect(response.status).toBe(200);
      expect(body.fetchStatus).toBe("failed");
      expect(body.adapterIssues[0]?.code).toBe("UPSTREAM_UNAVAILABLE");
      expect(
        fetchMock.mock.calls.some(([request]) => {
          const requestUrl =
            typeof request === "string" ? request : request instanceof URL ? request.toString() : request.url;
          return requestUrl.endsWith("/app/installations/77/access_tokens");
        })
      ).toBe(true);
    });
  });

  it("rejects live requests when session organization does not match requested org", async () => {
    configureAppMode("githealth-labs,other-org");

    const sessionToken = createGitHubAppInstallationSession(getGitHubConfig(), {
      installationId: 77,
      organization: "githealth-labs",
      targetType: "Organization"
    });

    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.startsWith("http://127.0.0.1")) {
        return originalFetch(input, init);
      }

      throw new Error(`Unexpected upstream fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health-score/github/organization?org=other-org&source=live`, {
        headers: authHeaders(sessionToken)
      });
      const body = await response.json() as { code: string; message: string };

      expect(response.status).toBe(403);
      expect(body.code).toBe("PERMISSION_DENIED");
      expect(body.message).toBe("GitHub App installation is not authorized for the requested organization.");
    });

    const hasInstallationTokenCall = fetchMock.mock.calls.some(([request]) => {
      const requestUrl = typeof request === "string" ? request : request instanceof URL ? request.toString() : request.url;
      return requestUrl.includes("/access_tokens");
    });
    expect(hasInstallationTokenCall).toBe(false);
  });
});

const TEST_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIICdgIBADANBgkqhkiG9w0BAQEFAASCAmAwggJcAgEAAoGBAMl6EkLxmU02q+bs
HcATXLdWMqzv5Ll2Zk4FdNw+mYodbJQE7oAMLCd8MZVgB00RAzGJzjO/042tY83D
gg0yvvSnPkN5HDNkiqURCC8QrXdZ5S0xztcTIBqbEytIul99KnEJc3SGALTiir/Z
iXJ4WoC/tYQE26kUaF1/Kxe073ZXAgMBAAECgYAtNCZEvtAWct2+wdsq7S0wNTbJ
dklrExWBC9hcUe9A/bkOvMyGDjUZ5tN5IEKDF/4Pb0vEcJWWhACQef0D2Q7ejxjX
qFt7eGKMIXPd9W4ec6JNOfTfmQUitrDo3Cs3jsWmRMfs/H0mNG7TRNdpNu985dDH
58+7MXjmR8COky/LgQJBAPgN5yMyyAF0RJq8sRrvIwOU2rY91oe4/2Po7dLkaYCI
z4bG6FLN75sqnbwrFHMC8EyLursL2BDtwQmE2ubnRvsCQQDP7jk3NxJ1OoLvMQnq
ZAHaD64x/TJxsUdNG8M4wmWEVyqpJbEsDsn8ogTNPCNF0TrWpp9aq9RV3M8llSKN
/Z9VAkAzUPz+RSUnV9xRfrPM9Kfzt7m/de+JyHXdP3Tj6ikBVExKf5/UcZIeMaTM
JsVmPbdkvot04rBiYC1NQNTga/w9AkEAyCq65c6cdEH5ni4FL6FKrxN9TB5FG3Hg
A/j//HoXpEkNhnwEjTdHd265VKHaCvIaxFzu9yiHZokE2VcyRqKraQJAZ36GD/6S
2YBtM4YVRtUCQLmQaqiIBMdkLckOxKuBmTjGttBdF+vSjc/IcB47p1AYJnxberNU
osVjUH3WZfN4eA==
-----END PRIVATE KEY-----`;
