import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveAuthenticatedSession, signUpUser } from "../application/authService.js";
import { getAuthStore } from "../infrastructure/auth/authStore.js";
import { resetGitHubAppInstallationTokenCache } from "../infrastructure/github/appAuth.js";
import { resetAuthStoreForTests } from "../infrastructure/auth/testAuthStore.js";
import { attachRequestContext } from "./requestContext.js";
import { requireAuthenticatedAppAccess } from "./authSession.js";
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
  app.use(express.json({ limit: "32kb" }));
  app.use(attachRequestContext);
  app.use("/github/connection", requireAuthenticatedAppAccess, githubConnectionRoutes);

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

async function createAuthCookie(): Promise<string> {
  const result = await signUpUser({
    displayName: "Kuldeep",
    email: `kuldeep-${Math.random().toString(16).slice(2)}@example.com`,
    password: "secure-pass-123"
  });

  return `githealth_auth_session=${encodeURIComponent(result.sessionToken)}`;
}

function extractSessionTokenFromCookie(cookie: string): string | undefined {
  const match = cookie.match(/githealth_auth_session=([^;]+)/);
  if (!match?.[1]) {
    return undefined;
  }

  return decodeURIComponent(match[1]);
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
  const previousOAuthClientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  const previousOAuthClientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;
  const previousOAuthRedirectUri = process.env.GITHUB_OAUTH_REDIRECT_URI;
  const previousOAuthFrontendRedirectUrl = process.env.GITHUB_OAUTH_FRONTEND_REDIRECT_URL;
  const previousOAuthTokenEncryptionKey = process.env.GITHUB_OAUTH_TOKEN_ENCRYPTION_KEY;

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    resetGitHubAppInstallationTokenCache();
    await resetAuthStoreForTests();
    restoreEnv("API_AUTH_TOKEN", previousApiAuthToken);
    restoreEnv("GITHUB_AUTH_PROVIDER", previousProvider);
    restoreEnv("GITHUB_APP_ID", previousAppId);
    restoreEnv("GITHUB_APP_PRIVATE_KEY", previousAppPrivateKey);
    restoreEnv("GITHUB_APP_INSTALL_URL", previousAppInstallUrl);
    restoreEnv("GITHUB_APP_INSTALLATION_ID", previousAppInstallationId);
    restoreEnv("GITHUB_APP_ONBOARDING_REDIRECT_URL", previousAppRedirectUrl);
    restoreEnv("ALLOWED_GITHUB_ORGS", previousAllowedGitHubOrgs);
    restoreEnv("GITHUB_OAUTH_CLIENT_ID", previousOAuthClientId);
    restoreEnv("GITHUB_OAUTH_CLIENT_SECRET", previousOAuthClientSecret);
    restoreEnv("GITHUB_OAUTH_REDIRECT_URI", previousOAuthRedirectUri);
    restoreEnv("GITHUB_OAUTH_FRONTEND_REDIRECT_URL", previousOAuthFrontendRedirectUrl);
    restoreEnv("GITHUB_OAUTH_TOKEN_ENCRYPTION_KEY", previousOAuthTokenEncryptionKey);
  });

  function configureAppMode() {
    process.env.API_AUTH_TOKEN = "issue36-token";
    process.env.GITHUB_AUTH_PROVIDER = "app";
    process.env.GITHUB_APP_ID = "12345";
    process.env.GITHUB_APP_PRIVATE_KEY = TEST_PRIVATE_KEY;
    process.env.GITHUB_APP_INSTALL_URL = "https://github.com/apps/githealth/installations/new";
    process.env.GITHUB_APP_ONBOARDING_REDIRECT_URL = "http://localhost:5173";
    process.env.ALLOWED_GITHUB_ORGS = "githealth-labs";
  }

  function configureOAuthMode() {
    process.env.API_AUTH_TOKEN = "issue36-token";
    process.env.ALLOWED_GITHUB_ORGS = "githealth-labs";
    process.env.GITHUB_AUTH_PROVIDER = "oauth";
    process.env.GITHUB_OAUTH_CLIENT_ID = "oauth-client-id";
    process.env.GITHUB_OAUTH_CLIENT_SECRET = "oauth-client-secret";
    process.env.GITHUB_OAUTH_REDIRECT_URI = "http://localhost:4000/github/connection/callback";
    process.env.GITHUB_OAUTH_FRONTEND_REDIRECT_URL = "http://localhost:5173/settings";
    process.env.GITHUB_OAUTH_TOKEN_ENCRYPTION_KEY = "oauth-encryption-key";
  }

  it("returns ready_to_connect when app mode is configured without installation id", async () => {
    configureAppMode();
    const authCookie = await createAuthCookie();

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/github/connection/status`, {
        headers: {
          Cookie: authCookie
        }
      });
      const body = await response.json() as { provider: string; status: string; canConnect: boolean };

      expect(response.status).toBe(200);
      expect(body.provider).toBe("app");
      expect(body.status).toBe("ready_to_connect");
      expect(body.canConnect).toBe(true);
    });
  });

  it("rejects unauthenticated start, callback, and disconnect requests", async () => {
    configureAppMode();

    await withServer(async (baseUrl) => {
      const startResponse = await fetch(`${baseUrl}/github/connection/start`);
      const startBody = await startResponse.json() as { code: string };

      expect(startResponse.status).toBe(401);
      expect(startBody.code).toBe("AUTH_MISSING");

      const callbackResponse = await fetch(`${baseUrl}/github/connection/callback?installation_id=77&setup_action=install`, {
        redirect: "manual"
      });
      expect(callbackResponse.status).toBe(302);
      expect(callbackResponse.headers.get("location")).toContain("github_app_error_code=AUTH_MISSING");

      const disconnectResponse = await fetch(`${baseUrl}/github/connection/disconnect`, {
        method: "DELETE"
      });
      const disconnectBody = await disconnectResponse.json() as { code: string };

      expect(disconnectResponse.status).toBe(401);
      expect(disconnectBody.code).toBe("AUTH_MISSING");
    });
  });

  it("returns the install URL through the onboarding start endpoint", async () => {
    configureAppMode();
    const authCookie = await createAuthCookie();

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/github/connection/start`, {
        headers: {
          Cookie: authCookie
        }
      });
      const body = await response.json() as { connectUrl: string };

      expect(response.status).toBe(200);
      expect(body.connectUrl).toBe("https://github.com/apps/githealth/installations/new");
    });
  });

  it("returns not_configured when onboarding redirect url is missing", async () => {
    configureAppMode();
    delete process.env.GITHUB_APP_ONBOARDING_REDIRECT_URL;
    const authCookie = await createAuthCookie();

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/github/connection/status`, {
        headers: {
          Cookie: authCookie
        }
      });
      const body = await response.json() as { status: string; canConnect: boolean; message: string };

      expect(response.status).toBe(200);
      expect(body.status).toBe("not_configured");
      expect(body.canConnect).toBe(false);
      expect(body.message).toContain("return URL");
    });
  });

  it("redirects callback requests to the configured onboarding redirect URL", async () => {
    configureAppMode();
    process.env.GITHUB_APP_ONBOARDING_REDIRECT_URL = "http://localhost:5173";
    const authCookie = await createAuthCookie();

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
        redirect: "manual",
        headers: {
          Cookie: authCookie
        }
      });
      const location = response.headers.get("location");
      const redirectUrl = new URL(location ?? "http://localhost:5173");

      expect(response.status).toBe(302);
      expect(redirectUrl.origin).toBe("http://localhost:5173");
      expect(redirectUrl.searchParams.get("github_app_status")).toBe("installation_completed");
      expect(redirectUrl.searchParams.get("github_app_callback")).toBe("received");
      expect(redirectUrl.searchParams.get("github_app_setup_action")).toBe("install");
      expect(redirectUrl.searchParams.get("github_app_session")).toBeNull();
    });
  });

  it("completes callback and allows status to use the persisted workspace connection", async () => {
    configureAppMode();
    delete process.env.GITHUB_APP_ONBOARDING_REDIRECT_URL;
    const authCookie = await createAuthCookie();

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
      const callbackResponse = await fetch(`${baseUrl}/github/connection/callback?installation_id=77&setup_action=install`, {
        headers: {
          Cookie: authCookie
        }
      });
      const callbackBody = await callbackResponse.json() as { status: string; organization: string };

      expect(callbackResponse.status).toBe(200);
      expect(callbackBody.status).toBe("installation_completed");
      expect(callbackBody.organization).toBe("githealth-labs");

      const statusResponse = await fetch(`${baseUrl}/github/connection/status`, {
        headers: {
          Cookie: authCookie
        }
      });
      const statusBody = await statusResponse.json() as { status: string; isConnected: boolean; organization?: string };

      expect(statusResponse.status).toBe(200);
      expect(statusBody.status).toBe("connected");
      expect(statusBody.isConnected).toBe(true);
      expect(statusBody.organization).toBe("githealth-labs");
    });
  });

  it("disconnects a persisted workspace github connection", async () => {
    configureAppMode();
    delete process.env.GITHUB_APP_ONBOARDING_REDIRECT_URL;
    const authCookie = await createAuthCookie();

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
      const callbackResponse = await fetch(`${baseUrl}/github/connection/callback?installation_id=77&setup_action=install`, {
        headers: {
          Cookie: authCookie
        }
      });

      expect(callbackResponse.status).toBe(200);

      const disconnectResponse = await fetch(`${baseUrl}/github/connection/disconnect`, {
        method: "DELETE",
        headers: {
          Cookie: authCookie
        }
      });
      const disconnectBody = await disconnectResponse.json() as { ok: boolean };

      expect(disconnectResponse.status).toBe(200);
      expect(disconnectBody.ok).toBe(true);

      const statusResponse = await fetch(`${baseUrl}/github/connection/status`, {
        headers: {
          Cookie: authCookie
        }
      });
      const statusBody = await statusResponse.json() as { status: string; isConnected: boolean; canConnect: boolean };

      expect(statusResponse.status).toBe(200);
      expect(statusBody.status).toBe("not_configured");
      expect(statusBody.isConnected).toBe(false);
      expect(statusBody.canConnect).toBe(false);
    });
  });

  it("isolates persisted GitHub App connections across workspaces", async () => {
    configureAppMode();
    process.env.ALLOWED_GITHUB_ORGS = "workspace-a-org,workspace-b-org";
    delete process.env.GITHUB_APP_ONBOARDING_REDIRECT_URL;
    const userACookie = await createAuthCookie();
    const userBCookie = await createAuthCookie();

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

      throw new Error(`Unexpected URL ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await withServer(async (baseUrl) => {
      const callbackA = await fetch(`${baseUrl}/github/connection/callback?installation_id=77&setup_action=install`, {
        headers: {
          Cookie: userACookie
        }
      });
      expect(callbackA.status).toBe(200);

      const callbackB = await fetch(`${baseUrl}/github/connection/callback?installation_id=88&setup_action=install`, {
        headers: {
          Cookie: userBCookie
        }
      });
      expect(callbackB.status).toBe(200);

      const statusA = await fetch(`${baseUrl}/github/connection/status`, {
        headers: {
          Cookie: userACookie
        }
      });
      const statusABody = await statusA.json() as { status: string; organization?: string };

      const statusB = await fetch(`${baseUrl}/github/connection/status`, {
        headers: {
          Cookie: userBCookie
        }
      });
      const statusBBody = await statusB.json() as { status: string; organization?: string };

      expect(statusA.status).toBe(200);
      expect(statusABody.status).toBe("connected");
      expect(statusABody.organization).toBe("workspace-a-org");

      expect(statusB.status).toBe(200);
      expect(statusBBody.status).toBe("connected");
      expect(statusBBody.organization).toBe("workspace-b-org");
      expect(statusABody.organization).not.toBe(statusBBody.organization);
    });
  });

  it("clears invalid callback/session state through sanitized status response", async () => {
    configureAppMode();
    const authCookie = await createAuthCookie();

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/github/connection/status`, {
        headers: {
          Cookie: `${authCookie}; githealth_github_app_session=invalid`
        }
      });
      const body = await response.json() as { status: string; message: string };

      expect(response.status).toBe(200);
      expect(body.status).toBe("unauthorized_installation");
      expect(body.message).toContain("invalid or expired");
    });
  });

  it("returns a callback error when installation_id is missing", async () => {
    configureAppMode();
    delete process.env.GITHUB_APP_ONBOARDING_REDIRECT_URL;

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
    delete process.env.GITHUB_APP_ONBOARDING_REDIRECT_URL;

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
    delete process.env.GITHUB_APP_ONBOARDING_REDIRECT_URL;

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
    delete process.env.GITHUB_APP_ONBOARDING_REDIRECT_URL;

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
    delete process.env.GITHUB_APP_ONBOARDING_REDIRECT_URL;
    const authCookie = await createAuthCookie();

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
      const response = await fetch(`${baseUrl}/github/connection/callback?installation_id=77&setup_action=install`, {
        headers: {
          Cookie: authCookie
        }
      });
      const body = await response.json() as { code: string; message: string };

      expect(response.status).toBe(404);
      expect(body.code).toBe("NOT_FOUND");
      expect(body.message).toBe("GitHub organization or repository not found.");
    });
  });

  it("rejects installations for unauthorized organizations", async () => {
    configureAppMode();
    delete process.env.GITHUB_APP_ONBOARDING_REDIRECT_URL;
    const authCookie = await createAuthCookie();

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
      const response = await fetch(`${baseUrl}/github/connection/callback?installation_id=88&setup_action=install`, {
        headers: {
          Cookie: authCookie
        }
      });
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
    process.env.ALLOWED_GITHUB_ORGS = "my-develoments";
    const authCookie = await createAuthCookie();

    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.startsWith("http://127.0.0.1")) {
        return originalFetch(input, init);
      }

      if (url.endsWith("/user")) {
        return new Response(JSON.stringify({ login: "githealth-user" }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        });
      }

      if (url.includes("/orgs/my-develoments/repos")) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        });
      }

      if (url.includes("/orgs/my-develoments")) {
        return new Response(JSON.stringify({ login: "my-develoments" }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        });
      }

      return new Response(JSON.stringify({ message: "Unhandled endpoint" }), {
        status: 404,
        headers: {
          "content-type": "application/json"
        }
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/github/connection/status`, {
        headers: {
          Cookie: authCookie
        }
      });
      const body = await response.json() as { provider: string; status: string; isConnected: boolean; organization?: string };

      expect(response.status).toBe(200);
      expect(body.provider).toBe("pat");
      expect(body.status).toBe("connected");
      expect(body.isConnected).toBe(true);
      expect(body.organization).toBe("my-develoments");
    });
  });

  it("starts GitHub OAuth and returns an authorize URL with state", async () => {
    configureOAuthMode();

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/github/connection/start`);
      const body = await response.json() as { provider: string; status: string; connectUrl: string };

      expect(response.status).toBe(200);
      expect(body.provider).toBe("oauth");
      expect(body.status).toBe("ready_to_connect");

      const authorizeUrl = new URL(body.connectUrl);
      expect(authorizeUrl.origin).toBe("https://github.com");
      expect(authorizeUrl.pathname).toBe("/login/oauth/authorize");
      expect(authorizeUrl.searchParams.get("client_id")).toBe("oauth-client-id");
      expect(authorizeUrl.searchParams.get("state")?.length).toBeGreaterThan(10);
    });
  });

  it("starts GitHub OAuth for unauthenticated users without issuing an app session cookie yet", async () => {
    configureOAuthMode();

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/github/connection/start`);
      const body = await response.json() as { provider: string; status: string; connectUrl: string };
      const setCookie = response.headers.get("set-cookie") ?? "";

      expect(response.status).toBe(200);
      expect(body.provider).toBe("oauth");
      expect(body.status).toBe("ready_to_connect");
      expect(body.connectUrl).toContain("https://github.com/login/oauth/authorize");
      expect(setCookie).toBe("");
    });
  });

  it("starts GitHub OAuth on trailing-slash route without requiring an app session", async () => {
    configureOAuthMode();

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/github/connection/start/`);
      const body = await response.json() as { provider: string; status: string; connectUrl: string };

      expect(response.status).toBe(200);
      expect(body.provider).toBe("oauth");
      expect(body.status).toBe("ready_to_connect");
      expect(body.connectUrl).toContain("https://github.com/login/oauth/authorize");
    });
  });

  it("completes OAuth callback, creates the app session, and redirects without exposing token", async () => {
    configureOAuthMode();

    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.startsWith("http://127.0.0.1")) {
        return originalFetch(input, init);
      }

      if (url === "https://github.com/login/oauth/access_token") {
        return new Response(
          JSON.stringify({
            access_token: "gho_super_secret_token",
            scope: "read:org,repo",
            token_type: "bearer"
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        );
      }

      if (url.endsWith("/user")) {
        return new Response(
          JSON.stringify({
            id: 12345,
            login: "octocat"
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        );
      }

      if (url.includes("/user/orgs")) {
        return new Response(
          JSON.stringify([
            { login: "other-org" },
            { login: "githealth-labs" }
          ]),
          {
            status: 200,
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
      const startResponse = await fetch(`${baseUrl}/github/connection/start`);
      const startBody = await startResponse.json() as { connectUrl: string };
      const state = new URL(startBody.connectUrl).searchParams.get("state");

      expect(state).toBeTruthy();

      const callbackResponse = await fetch(
        `${baseUrl}/github/connection/callback?state=${encodeURIComponent(state ?? "")}&code=test-auth-code`,
        {
          redirect: "manual"
        }
      );

      expect(callbackResponse.status).toBe(302);
      const location = callbackResponse.headers.get("location") ?? "";
      const redirectUrl = new URL(location);
  const setCookie = callbackResponse.headers.get("set-cookie") ?? "";
  expect(location).toContain("/command-center");
      expect(location).toContain("github_oauth_status=connected");
      expect(location).toContain("github_oauth_login=octocat");
      expect(location).not.toContain("gho_super_secret_token");
  expect(setCookie).toContain("githealth_auth_session=");
  expect(setCookie).toContain("HttpOnly");
      expect(redirectUrl.origin).toBe("http://localhost:5173");

  const sessionToken = extractSessionTokenFromCookie(setCookie);
      const authenticatedSession = await resolveAuthenticatedSession(sessionToken);
      expect(authenticatedSession).toBeTruthy();

      const authStore = getAuthStore();
      await authStore.initialize();
      const persistedConnection = await authStore.findWorkspaceGitHubOAuthConnection(
        authenticatedSession!.workspace.id,
        authenticatedSession!.user.id
      );

      expect(persistedConnection).toBeTruthy();
      expect(persistedConnection!.githubLogin).toBe("octocat");
      expect(persistedConnection!.accessTokenCiphertext).not.toBe("gho_super_secret_token");
      expect(persistedConnection!.accessTokenIv.length).toBeGreaterThan(0);
      expect(persistedConnection!.accessTokenTag.length).toBeGreaterThan(0);
      expect(persistedConnection!.organizationOptions).toEqual(["githealth-labs"]);

      const statusResponse = await fetch(`${baseUrl}/github/connection/status`, {
        headers: {
          Cookie: setCookie
        }
      });
      const statusBody = await statusResponse.json() as {
        provider: string;
        status: string;
        isConnected: boolean;
        githubLogin?: string;
        organization?: string;
      };

      expect(statusResponse.status).toBe(200);
      expect(statusBody.provider).toBe("oauth");
      expect(statusBody.status).toBe("connected");
      expect(statusBody.isConnected).toBe(true);
      expect(statusBody.githubLogin).toBe("octocat");
      expect(statusBody.organization).toBe("githealth-labs");
      expect(authenticatedSession?.user.email).toBe("github-user-12345@users.githealth.local");
    });
  });

  it("returns and updates OAuth organization selection when multiple allowlisted orgs are available", async () => {
    configureOAuthMode();
    process.env.ALLOWED_GITHUB_ORGS = "xebia-playground,xebia";

    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.startsWith("http://127.0.0.1")) {
        return originalFetch(input, init);
      }

      if (url === "https://github.com/login/oauth/access_token") {
        return new Response(
          JSON.stringify({
            access_token: "gho_multi_org_token",
            scope: "read:org,repo",
            token_type: "bearer"
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        );
      }

      if (url.endsWith("/user")) {
        return new Response(
          JSON.stringify({
            id: 45678,
            login: "octocat"
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        );
      }

      if (url.includes("/user/orgs")) {
        return new Response(
          JSON.stringify([
            { login: "xebia-playground" },
            { login: "xebia" },
            { login: "outside-allowlist" }
          ]),
          {
            status: 200,
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
      const startResponse = await fetch(`${baseUrl}/github/connection/start`);
      const startBody = await startResponse.json() as { connectUrl: string };
      const state = new URL(startBody.connectUrl).searchParams.get("state");

      const callbackResponse = await fetch(
        `${baseUrl}/github/connection/callback?state=${encodeURIComponent(state ?? "")}&code=test-auth-code`,
        {
          redirect: "manual"
        }
      );

      const authCookie = callbackResponse.headers.get("set-cookie") ?? "";
      expect(callbackResponse.status).toBe(302);
      expect(authCookie).toContain("githealth_auth_session=");

      const organizationsResponse = await fetch(`${baseUrl}/github/connection/organizations`, {
        headers: {
          Cookie: authCookie
        }
      });
      const organizationsBody = await organizationsResponse.json() as {
        selectedOrganization?: string;
        organizations: string[];
      };

      expect(organizationsResponse.status).toBe(200);
      expect(organizationsBody.selectedOrganization).toBe("xebia-playground");
      expect(organizationsBody.organizations).toEqual(["xebia-playground", "xebia"]);

      const selectResponse = await fetch(`${baseUrl}/github/connection/organizations/select`, {
        method: "POST",
        headers: {
          Cookie: authCookie,
          "content-type": "application/json"
        },
        body: JSON.stringify({ organization: "xebia" })
      });
      const selectBody = await selectResponse.json() as {
        selectedOrganization: string;
        organizations: string[];
      };

      expect(selectResponse.status).toBe(200);
      expect(selectBody.selectedOrganization).toBe("xebia");
      expect(selectBody.organizations).toEqual(["xebia-playground", "xebia"]);

      const statusResponse = await fetch(`${baseUrl}/github/connection/status`, {
        headers: {
          Cookie: authCookie
        }
      });
      const statusBody = await statusResponse.json() as { organization?: string; organizationOptions?: string[] };

      expect(statusResponse.status).toBe(200);
      expect(statusBody.organization).toBe("xebia");
      expect(statusBody.organizationOptions).toEqual(["xebia-playground", "xebia"]);
    });
  });

  it("requires explicit organization selection when OAuth org membership list is empty", async () => {
    configureOAuthMode();
    process.env.ALLOWED_GITHUB_ORGS = "xebia-playground,githealth-labs";

    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.startsWith("http://127.0.0.1")) {
        return originalFetch(input, init);
      }

      if (url === "https://github.com/login/oauth/access_token") {
        return new Response(
          JSON.stringify({
            access_token: "gho_fallback_org_token",
            scope: "read:org,repo",
            token_type: "bearer"
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        );
      }

      if (url.endsWith("/user")) {
        return new Response(
          JSON.stringify({
            id: 65432,
            login: "octocat"
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        );
      }

      if (url.includes("/user/orgs")) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        });
      }

      throw new Error(`Unexpected URL ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await withServer(async (baseUrl) => {
      const startResponse = await fetch(`${baseUrl}/github/connection/start`);
      const startBody = await startResponse.json() as { connectUrl: string };
      const state = new URL(startBody.connectUrl).searchParams.get("state");

      const callbackResponse = await fetch(
        `${baseUrl}/github/connection/callback?state=${encodeURIComponent(state ?? "")}&code=test-auth-code`,
        {
          redirect: "manual"
        }
      );

      const authCookie = callbackResponse.headers.get("set-cookie") ?? "";
      expect(callbackResponse.status).toBe(302);

      const statusResponse = await fetch(`${baseUrl}/github/connection/status`, {
        headers: {
          Cookie: authCookie
        }
      });
      const statusBody = await statusResponse.json() as {
        organization?: string;
        organizationOptions?: string[];
      };

      expect(statusResponse.status).toBe(200);
      expect(statusBody.organization).toBeUndefined();
      expect(statusBody.organizationOptions).toEqual([]);
    });
  });

  it("rejects OAuth callback when state is invalid", async () => {
    configureOAuthMode();

    await withServer(async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/github/connection/callback?state=invalid-state&code=test-auth-code`
      );
      const body = await response.json() as { code: string; message: string };

      expect(response.status).toBe(401);
      expect(body.code).toBe("AUTH_INVALID");
      expect(body.message).toContain("state");
    });
  });

  it("returns not_configured for PAT mode when allowed organizations are not configured", async () => {
    process.env.API_AUTH_TOKEN = "issue36-token";
    process.env.GITHUB_AUTH_PROVIDER = "pat";
    process.env.GITHUB_TOKEN = "pat-token";
    process.env.ALLOWED_GITHUB_ORGS = "";
    const authCookie = await createAuthCookie();

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/github/connection/status`, {
        headers: {
          Cookie: authCookie
        }
      });
      const body = await response.json() as { provider: string; status: string; isConnected: boolean; message: string };

      expect(response.status).toBe(200);
      expect(body.provider).toBe("pat");
      expect(body.status).toBe("not_configured");
      expect(body.isConnected).toBe(false);
      expect(body.message).toContain("ALLOWED_GITHUB_ORGS is empty");
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