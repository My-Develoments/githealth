import express from "express";
import { afterEach, describe, expect, it } from "vitest";
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

  afterEach(() => {
    restoreEnv("API_AUTH_TOKEN", previousApiAuthToken);
    restoreEnv("GITHUB_AUTH_PROVIDER", previousProvider);
    restoreEnv("GITHUB_APP_ID", previousAppId);
    restoreEnv("GITHUB_APP_PRIVATE_KEY", previousAppPrivateKey);
    restoreEnv("GITHUB_APP_INSTALL_URL", previousAppInstallUrl);
    restoreEnv("GITHUB_APP_INSTALLATION_ID", previousAppInstallationId);
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
