import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetAuthStoreForTests } from "../infrastructure/auth/testAuthStore.js";
import { authRoutes } from "./authRoutes.js";
import { githubConnectionRoutes } from "./githubConnectionRoutes.js";
import { attachRequestContext } from "./requestContext.js";
import { localDevelopmentCors } from "./localDevelopmentCors.js";
import { requestLogger } from "../infrastructure/observability/requestLogger.js";
import { opsRoutes } from "./opsRoutes.js";
import { requireAuthenticatedAppAccess } from "./authSession.js";
import { githubHealthScoreRoutes } from "./githubHealthScoreRoutes.js";
import { healthScoreRoutes } from "./healthScoreRoutes.js";
import { sendApiError } from "./errorEnvelope.js";
import { unexpectedErrorHandler } from "./unexpectedErrorHandler.js";

async function withServer<T>(run: (baseUrl: string) => Promise<T>): Promise<T> {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }));
  app.use(localDevelopmentCors);
  app.use(attachRequestContext);
  app.use(requestLogger);
  app.use(opsRoutes);
  app.use("/auth", authRoutes);
  app.use("/github/connection", requireAuthenticatedAppAccess, githubConnectionRoutes);
  app.use("/health-score", healthScoreRoutes);
  app.use("/health-score/github", requireAuthenticatedAppAccess, githubHealthScoreRoutes);
  app.use((_req, res) => {
    sendApiError(res, {
      status: 404,
      code: "NOT_FOUND",
      message: "Resource not found."
    });
  });
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

function restoreEnv(name: string, previous: string | undefined): void {
  if (typeof previous === "undefined") {
    delete process.env[name];
    return;
  }

  process.env[name] = previous;
}

describe("authRoutes", () => {
  const previousApiAuthToken = process.env.API_AUTH_TOKEN;
  const previousAllowedGitHubOrgs = process.env.ALLOWED_GITHUB_ORGS;
  const previousAuthProvider = process.env.GITHUB_AUTH_PROVIDER;
  const previousOAuthClientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  const previousOAuthClientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;
  const previousOAuthRedirectUri = process.env.GITHUB_OAUTH_REDIRECT_URI;
  const previousOAuthFrontendRedirectUrl = process.env.GITHUB_OAUTH_FRONTEND_REDIRECT_URL;
  const previousOAuthTokenEncryptionKey = process.env.GITHUB_OAUTH_TOKEN_ENCRYPTION_KEY;

  process.env.API_AUTH_TOKEN = "issue67-token";
  process.env.ALLOWED_GITHUB_ORGS = "githealth-labs";

  afterEach(async () => {
    await resetAuthStoreForTests();
    vi.restoreAllMocks();
    restoreEnv("API_AUTH_TOKEN", previousApiAuthToken);
    restoreEnv("ALLOWED_GITHUB_ORGS", previousAllowedGitHubOrgs);
    restoreEnv("GITHUB_AUTH_PROVIDER", previousAuthProvider);
    restoreEnv("GITHUB_OAUTH_CLIENT_ID", previousOAuthClientId);
    restoreEnv("GITHUB_OAUTH_CLIENT_SECRET", previousOAuthClientSecret);
    restoreEnv("GITHUB_OAUTH_REDIRECT_URI", previousOAuthRedirectUri);
    restoreEnv("GITHUB_OAUTH_FRONTEND_REDIRECT_URL", previousOAuthFrontendRedirectUrl);
    restoreEnv("GITHUB_OAUTH_TOKEN_ENCRYPTION_KEY", previousOAuthTokenEncryptionKey);
    process.env.API_AUTH_TOKEN = "issue67-token";
    process.env.ALLOWED_GITHUB_ORGS = "githealth-labs";
  });

  it("signs up a user, creates a workspace, and never returns password data", async () => {
    process.env.API_AUTH_TOKEN = "issue67-token";
    process.env.ALLOWED_GITHUB_ORGS = "githealth-labs";

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/auth/sign-up`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          displayName: "Kuldeep",
          email: "kuldeep@example.com",
          password: "secure-pass-123"
        })
      });
      const body = await response.json() as Record<string, unknown>;

      expect(response.status).toBe(201);
      expect(body.user).toMatchObject({
        email: "kuldeep@example.com",
        displayName: "Kuldeep"
      });
      expect(body.workspace).toMatchObject({
        name: "Kuldeep's Workspace"
      });
      expect(JSON.stringify(body)).not.toContain("passwordHash");
      expect(JSON.stringify(body)).not.toContain("secure-pass-123");
      expect(response.headers.get("set-cookie")).toContain("githealth_auth_session=");
    });
  });

  it("rejects duplicate user sign up", async () => {
    process.env.API_AUTH_TOKEN = "issue67-token";
    process.env.ALLOWED_GITHUB_ORGS = "githealth-labs";

    await withServer(async (baseUrl) => {
      const payload = {
        displayName: "Kuldeep",
        email: "kuldeep@example.com",
        password: "secure-pass-123"
      };

      await fetch(`${baseUrl}/auth/sign-up`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });

      const duplicateResponse = await fetch(`${baseUrl}/auth/sign-up`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const duplicateBody = await duplicateResponse.json() as { code: string };

      expect(duplicateResponse.status).toBe(409);
      expect(duplicateBody.code).toBe("CONFLICT");
    });
  });

  it("signs in an existing user and returns the current session", async () => {
    process.env.API_AUTH_TOKEN = "issue67-token";
    process.env.ALLOWED_GITHUB_ORGS = "githealth-labs";

    await withServer(async (baseUrl) => {
      await fetch(`${baseUrl}/auth/sign-up`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: "Kuldeep",
          email: "kuldeep@example.com",
          password: "secure-pass-123"
        })
      });

      const response = await fetch(`${baseUrl}/auth/sign-in`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "kuldeep@example.com",
          password: "secure-pass-123"
        })
      });
      const cookie = response.headers.get("set-cookie") ?? "";
      const body = await response.json() as { user: { email: string }; workspace: { name: string } };

      expect(response.status).toBe(200);
      expect(body.user.email).toBe("kuldeep@example.com");
      expect(body.workspace.name).toBe("Kuldeep's Workspace");

      const sessionResponse = await fetch(`${baseUrl}/auth/session`, {
        headers: {
          Cookie: cookie
        }
      });
      const sessionBody = await sessionResponse.json() as { user: { email: string } };

      expect(sessionResponse.status).toBe(200);
      expect(sessionBody.user.email).toBe("kuldeep@example.com");
    });
  });

  it("rejects invalid credentials", async () => {
    process.env.API_AUTH_TOKEN = "issue67-token";
    process.env.ALLOWED_GITHUB_ORGS = "githealth-labs";

    await withServer(async (baseUrl) => {
      await fetch(`${baseUrl}/auth/sign-up`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: "Kuldeep",
          email: "kuldeep@example.com",
          password: "secure-pass-123"
        })
      });

      const response = await fetch(`${baseUrl}/auth/sign-in`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "kuldeep@example.com",
          password: "wrong-pass-123"
        })
      });
      const body = await response.json() as { code: string };

      expect(response.status).toBe(401);
      expect(body.code).toBe("AUTH_INVALID");
    });
  });

  it("signs out and clears the session cookie", async () => {
    process.env.API_AUTH_TOKEN = "issue67-token";
    process.env.ALLOWED_GITHUB_ORGS = "githealth-labs";

    await withServer(async (baseUrl) => {
      const signUpResponse = await fetch(`${baseUrl}/auth/sign-up`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: "Kuldeep",
          email: "kuldeep@example.com",
          password: "secure-pass-123"
        })
      });
      const cookie = signUpResponse.headers.get("set-cookie") ?? "";

      const signOutResponse = await fetch(`${baseUrl}/auth/sign-out`, {
        method: "POST",
        headers: {
          Cookie: cookie
        }
      });
      const signOutBody = await signOutResponse.json() as { ok: boolean };

      expect(signOutResponse.status).toBe(200);
      expect(signOutBody.ok).toBe(true);
      expect(signOutResponse.headers.get("set-cookie")).toContain("Max-Age=0");

      const sessionResponse = await fetch(`${baseUrl}/auth/session`, {
        headers: {
          Cookie: cookie
        }
      });

      expect(sessionResponse.status).toBe(401);
    });
  });

  it("denies unauthenticated access to protected github routes", async () => {
    process.env.API_AUTH_TOKEN = "issue67-token";
    process.env.ALLOWED_GITHUB_ORGS = "githealth-labs";

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/github/connection/status`);
      const body = await response.json() as { code: string };

      expect(response.status).toBe(401);
      expect(body.code).toBe("AUTH_MISSING");
    });
  });

  it("authenticates /auth/session immediately after OAuth callback redirect", async () => {
    process.env.API_AUTH_TOKEN = "issue67-token";
    process.env.ALLOWED_GITHUB_ORGS = "xebia-playground";
    process.env.GITHUB_AUTH_PROVIDER = "oauth";
    process.env.GITHUB_OAUTH_CLIENT_ID = "oauth-client-id";
    process.env.GITHUB_OAUTH_CLIENT_SECRET = "oauth-client-secret";
    process.env.GITHUB_OAUTH_REDIRECT_URI = "http://localhost:4000/github/connection/callback";
    process.env.GITHUB_OAUTH_FRONTEND_REDIRECT_URL = "http://127.0.0.1:5173/settings";
    process.env.GITHUB_OAUTH_TOKEN_ENCRYPTION_KEY = "oauth-encryption-key";

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
            { login: "xebia-playground" },
            { login: "another-org" }
          ]),
          {
            status: 200,
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
      const startResponse = await fetch(`${baseUrl}/github/connection/start`);
      const startBody = await startResponse.json() as { connectUrl: string };
      const state = new URL(startBody.connectUrl).searchParams.get("state");

      expect(state).toBeTruthy();

      const callbackResponse = await fetch(`${baseUrl}/github/connection/callback?state=${encodeURIComponent(state ?? "")}&code=test-auth-code`, {
        redirect: "manual"
      });
      expect(callbackResponse.status).toBe(302);

      const callbackLocation = callbackResponse.headers.get("location") ?? "";
      const redirectUrl = new URL(callbackLocation);
      const cookie = callbackResponse.headers.get("set-cookie") ?? "";

      expect(redirectUrl.origin).toBe("http://localhost:5173");
      expect(redirectUrl.pathname).toBe("/command-center");
      expect(redirectUrl.searchParams.get("github_oauth_status")).toBe("connected");
      expect(cookie).toContain("githealth_auth_session=");

      const sessionResponse = await fetch(`${baseUrl}/auth/session`, {
        headers: {
          Cookie: cookie,
          Origin: "http://localhost:5173"
        }
      });
      const sessionBody = await sessionResponse.json() as { user: { email: string } };

      expect(sessionResponse.status).toBe(200);
      expect(sessionBody.user.email).toBe("github-user-12345@users.githealth.local");
      expect(sessionResponse.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
      expect(sessionResponse.headers.get("access-control-allow-credentials")).toBe("true");

      const connectionStatusResponse = await fetch(`${baseUrl}/github/connection/status`, {
        headers: {
          Cookie: cookie
        }
      });
      const connectionStatusBody = await connectionStatusResponse.json() as { organization?: string; status: string };
      expect(connectionStatusResponse.status).toBe(200);
      expect(connectionStatusBody.status).toBe("connected");
      expect(connectionStatusBody.organization).toBe("xebia-playground");

      const healthResponse = await fetch(`${baseUrl}/health-score/github/organization?org=xebia-playground&source=live`, {
        headers: {
          Cookie: cookie,
          Origin: "http://localhost:5173"
        }
      });
      expect(healthResponse.status).toBe(200);
    });
  });
});