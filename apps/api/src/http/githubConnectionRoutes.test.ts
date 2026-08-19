import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetGitHubAppInstallationTokenCache } from "../infrastructure/github/appAuth.js";
import { attachRequestContext } from "./requestContext.js";
import { githubConnectionRoutes } from "./githubConnectionRoutes.js";

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
  app.use("/github/connection", githubConnectionRoutes);

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

describe("githubConnectionRoutes", () => {
  const previousApiAuthToken = process.env.API_AUTH_TOKEN;
  const previousProvider = process.env.GITHUB_AUTH_PROVIDER;
  const previousAppId = process.env.GITHUB_APP_ID;
  const previousAppPrivateKey = process.env.GITHUB_APP_PRIVATE_KEY;
  const previousAppInstallUrl = process.env.GITHUB_APP_INSTALL_URL;
  const previousAppInstallationId = process.env.GITHUB_APP_INSTALLATION_ID;
  const previousAppRedirectUrl = process.env.GITHUB_APP_ONBOARDING_REDIRECT_URL;
  const previousAllowedGitHubOrgs = process.env.ALLOWED_GITHUB_ORGS;

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    resetGitHubAppInstallationTokenCache();
    restoreEnv("API_AUTH_TOKEN", previousApiAuthToken);
    restoreEnv("GITHUB_AUTH_PROVIDER", previousProvider);
    restoreEnv("GITHUB_APP_ID", previousAppId);
    restoreEnv("GITHUB_APP_PRIVATE_KEY", previousAppPrivateKey);
    restoreEnv("GITHUB_APP_INSTALL_URL", previousAppInstallUrl);
    restoreEnv("GITHUB_APP_INSTALLATION_ID", previousAppInstallationId);
    restoreEnv("GITHUB_APP_ONBOARDING_REDIRECT_URL", previousAppRedirectUrl);
    restoreEnv("ALLOWED_GITHUB_ORGS", previousAllowedGitHubOrgs);
  });

  function authHeaders(token = "issue36-token") {
    return {
      Authorization: `Bearer ${token}`
    };
  }

  function configureAppMode() {
    process.env.API_AUTH_TOKEN = "issue36-token";
    process.env.GITHUB_AUTH_PROVIDER = "app";
    process.env.GITHUB_APP_ID = "12345";
    process.env.GITHUB_APP_PRIVATE_KEY = TEST_PRIVATE_KEY;
    process.env.GITHUB_APP_INSTALL_URL = "https://github.com/apps/githealth/installations/new";
    process.env.ALLOWED_GITHUB_ORGS = "githealth-labs";
  }

  function installSessionHeaders(token: string) {
    return {
      ...authHeaders(),
      "x-github-app-session": token
    };
  }

  it("returns ready_to_connect when app mode is configured without installation id", async () => {
    configureAppMode();

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/github/connection/status`, {
        headers: authHeaders()
      });
      const body = await response.json() as { provider: string; status: string; canConnect: boolean };

      expect(response.status).toBe(200);
      expect(body.provider).toBe("app");
      expect(body.status).toBe("ready_to_connect");
      expect(body.canConnect).toBe(true);
    });
  });

  it("returns the install URL through the protected start endpoint", async () => {
    configureAppMode();

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/github/connection/start`, {
        headers: authHeaders()
      });
      const body = await response.json() as { connectUrl: string };

      expect(response.status).toBe(200);
      expect(body.connectUrl).toBe("https://github.com/apps/githealth/installations/new");
    });
  });

  it("redirects callback requests to the configured onboarding redirect URL", async () => {
    configureAppMode();
    process.env.GITHUB_APP_ONBOARDING_REDIRECT_URL = "http://localhost:5173";

    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.startsWith("http://127.0.0.1")) {
        return originalFetch(input, init);
      }

      return new Response(
        JSON.stringify({
          id: 77,
          target_type: "Organization",
          account: {
            login: "githealth-labs"
          }
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/github/connection/callback?installation_id=77&setup_action=install`, {
        redirect: "manual"
      });
      const location = response.headers.get("location");
      const redirectUrl = new URL(location ?? "http://localhost:5173");

      expect(response.status).toBe(302);
      expect(redirectUrl.origin).toBe("http://localhost:5173");
      expect(redirectUrl.searchParams.get("github_app_status")).toBe("installation_completed");
      expect(redirectUrl.searchParams.get("github_app_callback")).toBe("received");
      expect(redirectUrl.searchParams.get("github_app_setup_action")).toBe("install");
      expect(redirectUrl.searchParams.get("github_app_session")).toBeTruthy();
    });
  });

  it("completes callback and allows protected status to use the returned session token", async () => {
    configureAppMode();

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
              login: "githealth-labs"
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
          JSON.stringify({ token: "installation-access-token", expires_at: "2026-01-01T01:00:00.000Z" }),
          {
            status: 201,
            headers: {
              "content-type": "application/json"
            }
          }
        );
      }

      throw new Error(`Unexpected URL ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await withServer(async (baseUrl) => {
      const callbackResponse = await fetch(`${baseUrl}/github/connection/callback?installation_id=77&setup_action=install`);
      const callbackBody = await callbackResponse.json() as { status: string; sessionToken: string };

      expect(callbackResponse.status).toBe(200);
      expect(callbackBody.status).toBe("installation_completed");
      expect(callbackBody.sessionToken).toBeTruthy();

      const statusResponse = await fetch(`${baseUrl}/github/connection/status`, {
        headers: installSessionHeaders(callbackBody.sessionToken)
      });
      const statusBody = await statusResponse.json() as { status: string; isConnected: boolean };

      expect(statusResponse.status).toBe(200);
      expect(statusBody.status).toBe("connected");
      expect(statusBody.isConnected).toBe(true);
    });
  });

  it("returns a callback error when installation_id is missing", async () => {
    configureAppMode();

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/github/connection/callback?setup_action=install`);
      const body = await response.json() as { code: string; message: string };

      expect(response.status).toBe(400);
      expect(body.code).toBe("INVALID_REQUEST");
      expect(body.message).toBe("Missing or invalid installation_id query parameter.");
    });
  });

  it("returns a callback error when installation_id is invalid", async () => {
    configureAppMode();

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/github/connection/callback?installation_id=abc&setup_action=install`);
      const body = await response.json() as { code: string; message: string };

      expect(response.status).toBe(400);
      expect(body.code).toBe("INVALID_REQUEST");
      expect(body.message).toBe("Missing or invalid installation_id query parameter.");
    });
  });

  it("returns a callback error when setup_action is missing", async () => {
    configureAppMode();

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/github/connection/callback?installation_id=77`);
      const body = await response.json() as { code: string; message: string };

      expect(response.status).toBe(400);
      expect(body.code).toBe("INVALID_REQUEST");
      expect(body.message).toBe("Missing or invalid setup_action query parameter.");
    });
  });

  it("returns a callback error when setup_action is invalid", async () => {
    configureAppMode();

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/github/connection/callback?installation_id=77&setup_action=approve`);
      const body = await response.json() as { code: string; message: string };

      expect(response.status).toBe(400);
      expect(body.code).toBe("INVALID_REQUEST");
      expect(body.message).toBe("Missing or invalid setup_action query parameter.");
    });
  });

  it("returns NOT_FOUND when GitHub installation is unavailable", async () => {
    configureAppMode();

    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.startsWith("http://127.0.0.1")) {
        return originalFetch(input, init);
      }

      if (url.endsWith("/app/installations/77")) {
        return new Response(
          JSON.stringify({ message: "Not Found" }),
          {
            status: 404,
            headers: {
              "content-type": "application/json"
            }
          }
        );
      }

      throw new Error(`Unexpected URL ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/github/connection/callback?installation_id=77&setup_action=install`);
      const body = await response.json() as { code: string; message: string };

      expect(response.status).toBe(404);
      expect(body.code).toBe("NOT_FOUND");
      expect(body.message).toBe("GitHub organization or repository not found.");
    });
  });

  it("rejects installations for unauthorized organizations", async () => {
    configureAppMode();

    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.startsWith("http://127.0.0.1")) {
        return originalFetch(input, init);
      }

      return new Response(
        JSON.stringify({
          id: 88,
          target_type: "Organization",
          account: {
            login: "other-org"
          }
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/github/connection/callback?installation_id=88&setup_action=install`);
      const body = await response.json() as { code: string; message: string };

      expect(response.status).toBe(403);
      expect(body.code).toBe("PERMISSION_DENIED");
      expect(body.message).toBe("GitHub App installation organization is not authorized for GitHealth.");
    });
  });

  it("preserves PAT mode status behavior", async () => {
    process.env.API_AUTH_TOKEN = "issue36-token";
    process.env.GITHUB_AUTH_PROVIDER = "pat";
    process.env.GITHUB_TOKEN = "pat-token";

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/github/connection/status`, {
        headers: authHeaders()
      });
      const body = await response.json() as { provider: string; status: string; isConnected: boolean };

      expect(response.status).toBe(200);
      expect(body.provider).toBe("pat");
      expect(body.status).toBe("connected");
      expect(body.isConnected).toBe(true);
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