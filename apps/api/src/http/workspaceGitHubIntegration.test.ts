import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authRoutes } from "./authRoutes.js";
import { requireAuthenticatedAppAccess } from "./authSession.js";
import { githubConnectionRoutes } from "./githubConnectionRoutes.js";
import { githubHealthScoreRoutes } from "./githubHealthScoreRoutes.js";
import { attachRequestContext } from "./requestContext.js";
import { localDevelopmentCors } from "./localDevelopmentCors.js";
import { requestLogger } from "../infrastructure/observability/requestLogger.js";
import { resetGitHubScoreCache } from "../application/githubScoringService.js";
import { resetGitHubAppInstallationTokenCache } from "../infrastructure/github/appAuth.js";
import { resetAuthStoreForTests } from "../infrastructure/auth/testAuthStore.js";

function restoreEnv(name: string, previous: string | undefined): void {
  if (typeof previous === "undefined") {
    delete process.env[name];
    return;
  }

  process.env[name] = previous;
}

async function withServer<T>(run: (baseUrl: string) => Promise<T>): Promise<T> {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }));
  app.use(localDevelopmentCors);
  app.use(attachRequestContext);
  app.use(requestLogger);
  app.use("/auth", authRoutes);
  app.use("/github/connection", requireAuthenticatedAppAccess, githubConnectionRoutes);
  app.use("/health-score/github", requireAuthenticatedAppAccess, githubHealthScoreRoutes);

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

async function signUpAndGetCookie(baseUrl: string, email: string): Promise<string> {
  const response = await fetch(`${baseUrl}/auth/sign-up`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      displayName: email.split("@")[0],
      email,
      password: "secure-pass-123"
    })
  });

  if (response.status !== 201) {
    throw new Error(`Unexpected signup status ${response.status}`);
  }

  return response.headers.get("set-cookie") ?? "";
}

describe("workspace GitHub integration", () => {
  const previousApiAuthToken = process.env.API_AUTH_TOKEN;
  const previousAllowedGitHubOrgs = process.env.ALLOWED_GITHUB_ORGS;
  const previousProvider = process.env.GITHUB_AUTH_PROVIDER;
  const previousAppId = process.env.GITHUB_APP_ID;
  const previousAppPrivateKey = process.env.GITHUB_APP_PRIVATE_KEY;
  const previousAppInstallUrl = process.env.GITHUB_APP_INSTALL_URL;
  const previousAppRedirectUrl = process.env.GITHUB_APP_ONBOARDING_REDIRECT_URL;
  const previousAppInstallationId = process.env.GITHUB_APP_INSTALLATION_ID;
  const previousRetries = process.env.GITHUB_MAX_RETRIES;

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    resetGitHubScoreCache();
    resetGitHubAppInstallationTokenCache();
    await resetAuthStoreForTests();
    restoreEnv("API_AUTH_TOKEN", previousApiAuthToken);
    restoreEnv("ALLOWED_GITHUB_ORGS", previousAllowedGitHubOrgs);
    restoreEnv("GITHUB_AUTH_PROVIDER", previousProvider);
    restoreEnv("GITHUB_APP_ID", previousAppId);
    restoreEnv("GITHUB_APP_PRIVATE_KEY", previousAppPrivateKey);
    restoreEnv("GITHUB_APP_INSTALL_URL", previousAppInstallUrl);
    restoreEnv("GITHUB_APP_ONBOARDING_REDIRECT_URL", previousAppRedirectUrl);
    restoreEnv("GITHUB_APP_INSTALLATION_ID", previousAppInstallationId);
    restoreEnv("GITHUB_MAX_RETRIES", previousRetries);
  });

  it("uses the authenticated workspace connection for dashboard health data and enforces workspace isolation", async () => {
    process.env.API_AUTH_TOKEN = "issue67-token";
    process.env.ALLOWED_GITHUB_ORGS = "workspace-a-org,workspace-b-org";
    process.env.GITHUB_AUTH_PROVIDER = "pat";
    process.env.GITHUB_APP_ID = "12345";
    process.env.GITHUB_APP_PRIVATE_KEY = TEST_PRIVATE_KEY;
    process.env.GITHUB_APP_INSTALL_URL = "https://github.com/apps/githealth/installations/new";
    process.env.GITHUB_APP_ONBOARDING_REDIRECT_URL = "http://localhost:5173";
    delete process.env.GITHUB_APP_INSTALLATION_ID;
    process.env.GITHUB_MAX_RETRIES = "0";

    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.startsWith("http://127.0.0.1")) {
        return originalFetch(input, init);
      }

      if (url.endsWith("/app/installations/77")) {
        return new Response(
          JSON.stringify({
            id: 77,
            target_type: "Organization",
            account: {
              login: "workspace-a-org"
            }
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        );
      }

      if (url.endsWith("/app/installations/88")) {
        return new Response(
          JSON.stringify({
            id: 88,
            target_type: "Organization",
            account: {
              login: "workspace-b-org"
            }
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        );
      }

      if (url.endsWith("/app/installations/77/access_tokens")) {
        return new Response(
          JSON.stringify({ token: "installation-token-a", expires_at: "2026-01-01T01:00:00.000Z" }),
          {
            status: 201,
            headers: {
              "content-type": "application/json"
            }
          }
        );
      }

      if (url.endsWith("/app/installations/88/access_tokens")) {
        return new Response(
          JSON.stringify({ token: "installation-token-b", expires_at: "2026-01-01T01:00:00.000Z" }),
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
      const userACookie = await signUpAndGetCookie(baseUrl, "workspace-a@example.com");
      const userBCookie = await signUpAndGetCookie(baseUrl, "workspace-b@example.com");

      const callbackA = await fetch(`${baseUrl}/github/connection/callback?installation_id=77&setup_action=install`, {
        redirect: "manual",
        headers: {
          Cookie: userACookie
        }
      });
      expect(callbackA.status).toBe(302);

      const callbackB = await fetch(`${baseUrl}/github/connection/callback?installation_id=88&setup_action=install`, {
        redirect: "manual",
        headers: {
          Cookie: userBCookie
        }
      });
      expect(callbackB.status).toBe(302);

      const orgResponseA = await fetch(`${baseUrl}/health-score/github/organization?org=workspace-a-org&source=live`, {
        headers: {
          Cookie: userACookie
        }
      });
      const orgBodyA = await orgResponseA.json() as { source: string; fetchStatus: string };

      expect(orgResponseA.status).toBe(200);
      expect(orgBodyA.source).toBe("live");

      const orgResponseB = await fetch(`${baseUrl}/health-score/github/organization?org=workspace-a-org&source=live`, {
        headers: {
          Cookie: userBCookie
        }
      });
      const orgBodyB = await orgResponseB.json() as { code: string; message: string };

      expect(orgResponseB.status).toBe(403);
      expect(orgBodyB.code).toBe("PERMISSION_DENIED");
      expect(orgBodyB.message).toBe("Workspace GitHub connection is not authorized for the requested organization.");
    });
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
