import express from "express";
import { afterEach, describe, expect, it } from "vitest";
import { signUpUser } from "../application/authService.js";
import { resetAuthStoreForTests } from "../infrastructure/auth/testAuthStore.js";
import { createGitHubAppInstallationSession } from "../infrastructure/github/appAuth.js";
import { getGitHubConfig } from "../infrastructure/github/config.js";
import { githubEndpointAuth } from "./githubEndpointAuth.js";
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
  app.use(githubEndpointAuth);
  app.get("/health-score/github/organization", (_req, res) => {
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

describe("githubEndpointAuth", () => {
  const previousApiAuthToken = process.env.API_AUTH_TOKEN;
  const previousProvider = process.env.GITHUB_AUTH_PROVIDER;
  const previousAppId = process.env.GITHUB_APP_ID;
  const previousAppPrivateKey = process.env.GITHUB_APP_PRIVATE_KEY;
  const previousAppInstallUrl = process.env.GITHUB_APP_INSTALL_URL;
  const previousAppInstallationId = process.env.GITHUB_APP_INSTALLATION_ID;
  const previousToken = process.env.GITHUB_TOKEN;
  const previousOAuthClientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  const previousOAuthClientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;
  const previousOAuthRedirectUri = process.env.GITHUB_OAUTH_REDIRECT_URI;
  const previousOAuthFrontendRedirectUrl = process.env.GITHUB_OAUTH_FRONTEND_REDIRECT_URL;
  const previousOAuthTokenEncryptionKey = process.env.GITHUB_OAUTH_TOKEN_ENCRYPTION_KEY;

  afterEach(async () => {
    await resetAuthStoreForTests();
    restoreEnv("API_AUTH_TOKEN", previousApiAuthToken);
    restoreEnv("GITHUB_AUTH_PROVIDER", previousProvider);
    restoreEnv("GITHUB_APP_ID", previousAppId);
    restoreEnv("GITHUB_APP_PRIVATE_KEY", previousAppPrivateKey);
    restoreEnv("GITHUB_APP_INSTALL_URL", previousAppInstallUrl);
    restoreEnv("GITHUB_APP_INSTALLATION_ID", previousAppInstallationId);
    restoreEnv("GITHUB_TOKEN", previousToken);
    restoreEnv("GITHUB_OAUTH_CLIENT_ID", previousOAuthClientId);
    restoreEnv("GITHUB_OAUTH_CLIENT_SECRET", previousOAuthClientSecret);
    restoreEnv("GITHUB_OAUTH_REDIRECT_URI", previousOAuthRedirectUri);
    restoreEnv("GITHUB_OAUTH_FRONTEND_REDIRECT_URL", previousOAuthFrontendRedirectUrl);
    restoreEnv("GITHUB_OAUTH_TOKEN_ENCRYPTION_KEY", previousOAuthTokenEncryptionKey);
  });

  it("returns AUTH_MISSING when authorization header is absent", async () => {
    process.env.API_AUTH_TOKEN = "issue23-token";

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health-score/github/organization`);
      const body = await response.json() as { code: string; requestId: string };

      expect(response.status).toBe(401);
      expect(body.code).toBe("AUTH_MISSING");
      expect(typeof body.requestId).toBe("string");
      expect(body.requestId.length).toBeGreaterThan(0);
    });
  });

  it("returns AUTH_INVALID when token is invalid", async () => {
    process.env.API_AUTH_TOKEN = "issue23-token";

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health-score/github/organization`, {
        headers: {
          Authorization: "Bearer wrong-token"
        }
      });
      const body = await response.json() as { code: string };

      expect(response.status).toBe(401);
      expect(body.code).toBe("AUTH_INVALID");
    });
  });

  it("allows request when token is valid", async () => {
    process.env.API_AUTH_TOKEN = "issue23-token";

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health-score/github/organization`, {
        headers: {
          Authorization: "Bearer issue23-token"
        }
      });

      expect(response.status).toBe(200);
    });
  });

  it("allows request when GitHub App installation session cookie is valid", async () => {
    process.env.API_AUTH_TOKEN = "issue23-token";
    process.env.GITHUB_AUTH_PROVIDER = "app";
    process.env.GITHUB_APP_ID = "12345";
    process.env.GITHUB_APP_PRIVATE_KEY = TEST_PRIVATE_KEY;
    process.env.GITHUB_APP_INSTALL_URL = "https://github.com/apps/githealth/installations/new";

    const sessionToken = createGitHubAppInstallationSession(getGitHubConfig(), {
      installationId: 77,
      organization: "githealth-labs",
      targetType: "Organization"
    });

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health-score/github/organization`, {
        headers: {
          Cookie: `githealth_github_app_session=${encodeURIComponent(sessionToken)}`
        }
      });

      expect(response.status).toBe(200);
    });
  });

  it("allows request when app mode uses a configured installation id", async () => {
    process.env.API_AUTH_TOKEN = "issue23-token";
    process.env.GITHUB_AUTH_PROVIDER = "app";
    process.env.GITHUB_APP_ID = "12345";
    process.env.GITHUB_APP_PRIVATE_KEY = TEST_PRIVATE_KEY;
    process.env.GITHUB_APP_INSTALL_URL = "https://github.com/apps/githealth/installations/new";
    process.env.GITHUB_APP_INSTALLATION_ID = "77";

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health-score/github/organization`);

      expect(response.status).toBe(200);
    });
  });

  it("returns workspace connection guidance for cookie-authenticated users without a connected app installation", async () => {
    process.env.API_AUTH_TOKEN = "issue23-token";
    process.env.GITHUB_AUTH_PROVIDER = "app";
    process.env.GITHUB_APP_ID = "12345";
    process.env.GITHUB_APP_PRIVATE_KEY = TEST_PRIVATE_KEY;
    process.env.GITHUB_APP_INSTALL_URL = "https://github.com/apps/githealth/installations/new";

    const signUpResult = await signUpUser({
      displayName: "Kuldeep",
      email: "endpoint-auth-cookie@example.com",
      password: "secure-pass-123"
    });

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health-score/github/organization`, {
        headers: {
          Cookie: `githealth_auth_session=${encodeURIComponent(signUpResult.sessionToken)}`
        }
      });
      const body = await response.json() as { code: string; message: string };

      expect(response.status).toBe(401);
      expect(body.code).toBe("AUTH_MISSING");
      expect(body.message).toBe("GitHub App installation is not connected for this workspace.");
    });
  });

  it("allows cookie-authenticated users in PAT mode when GITHUB_TOKEN is configured", async () => {
    process.env.API_AUTH_TOKEN = "issue23-token";
    process.env.GITHUB_AUTH_PROVIDER = "pat";
    process.env.GITHUB_TOKEN = "pat-token";

    const signUpResult = await signUpUser({
      displayName: "Kuldeep",
      email: "endpoint-auth-cookie-pat@example.com",
      password: "secure-pass-123"
    });

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health-score/github/organization`, {
        headers: {
          Cookie: `githealth_auth_session=${encodeURIComponent(signUpResult.sessionToken)}`
        }
      });

      expect(response.status).toBe(200);
    });
  });

  it("does not fall back to GITHUB_TOKEN in oauth mode when workspace OAuth connection is missing", async () => {
    process.env.API_AUTH_TOKEN = "issue23-token";
    process.env.GITHUB_AUTH_PROVIDER = "oauth";
    process.env.GITHUB_OAUTH_CLIENT_ID = "oauth-client-id";
    process.env.GITHUB_OAUTH_CLIENT_SECRET = "oauth-client-secret";
    process.env.GITHUB_OAUTH_REDIRECT_URI = "http://localhost:4000/github/connection/callback";
    process.env.GITHUB_OAUTH_FRONTEND_REDIRECT_URL = "http://localhost:5173/command-center";
    process.env.GITHUB_OAUTH_TOKEN_ENCRYPTION_KEY = "oauth-encryption-key";
    process.env.GITHUB_TOKEN = "pat-token-should-not-be-used";

    const signUpResult = await signUpUser({
      displayName: "Kuldeep",
      email: "endpoint-auth-cookie-oauth@example.com",
      password: "secure-pass-123"
    });

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health-score/github/organization`, {
        headers: {
          Cookie: `githealth_auth_session=${encodeURIComponent(signUpResult.sessionToken)}`
        }
      });
      const body = await response.json() as { code: string; message: string };

      expect(response.status).toBe(401);
      expect(body.code).toBe("AUTH_MISSING");
      expect(body.message).toBe("GitHub OAuth connection is not configured for this workspace user.");
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
