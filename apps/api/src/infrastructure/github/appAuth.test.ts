import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createGitHubAppInstallationSession,
  createInstallationTokenProvider,
  parseGitHubAppInstallationSession,
  resetGitHubAppInstallationTokenCache,
  resolveGitHubAccessToken
} from "./appAuth.js";
import type { GitHubConfig } from "./config.js";

afterEach(() => {
  resetGitHubAppInstallationTokenCache();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("createInstallationTokenProvider", () => {
  it("caches installation tokens until the refresh window", async () => {
    let nowMs = Date.parse("2026-01-01T00:00:00.000Z");
    const provider = createInstallationTokenProvider({ now: () => nowMs });
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ token: "install-token-1", expires_at: "2026-01-01T00:10:00.000Z" }), {
        status: 201,
        headers: {
          "content-type": "application/json"
        }
      })
    );

    vi.stubGlobal("fetch", fetchMock);

    const input = {
      apiBaseUrl: "https://api.github.com",
      appId: "12345",
      privateKey: TEST_PRIVATE_KEY,
      installationId: 99,
      timeoutMs: 5000
    };

    await expect(provider.getToken(input)).resolves.toBe("install-token-1");
    nowMs += 30_000;
    await expect(provider.getToken(input)).resolves.toBe("install-token-1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refreshes installation tokens close to expiry", async () => {
    let nowMs = Date.parse("2026-01-01T00:00:00.000Z");
    const provider = createInstallationTokenProvider({ now: () => nowMs });
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: "install-token-1", expires_at: "2026-01-01T00:02:00.000Z" }), {
          status: 201,
          headers: {
            "content-type": "application/json"
          }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: "install-token-2", expires_at: "2026-01-01T00:12:00.000Z" }), {
          status: 201,
          headers: {
            "content-type": "application/json"
          }
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    const input = {
      apiBaseUrl: "https://api.github.com",
      appId: "12345",
      privateKey: TEST_PRIVATE_KEY,
      installationId: 99,
      timeoutMs: 5000
    };

    await expect(provider.getToken(input)).resolves.toBe("install-token-1");
    nowMs = Date.parse("2026-01-01T00:01:10.000Z");
    await expect(provider.getToken(input)).resolves.toBe("install-token-2");

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("resolveGitHubAccessToken", () => {
  it("preserves PAT mode behavior", async () => {
    const config: GitHubConfig = {
      authProvider: "pat",
      token: "test-token",
      apiBaseUrl: "https://api.github.com",
      timeoutMs: 5000,
      maxRetries: 0,
      retryBaseDelayMs: 100,
      maxPaginationPages: 3,
      repositoryConcurrency: 4,
      signalConcurrency: 2
    };

    await expect(resolveGitHubAccessToken(config)).resolves.toBe("test-token");
  });
});

describe("GitHub App installation session", () => {
  it("creates and parses an opaque installation session token", () => {
    const config: GitHubConfig = {
      authProvider: "app",
      app: {
        appId: "12345",
        privateKey: TEST_PRIVATE_KEY,
        installUrl: "https://github.com/apps/githealth/installations/new"
      },
      apiBaseUrl: "https://api.github.com",
      timeoutMs: 5000,
      maxRetries: 0,
      retryBaseDelayMs: 100,
      maxPaginationPages: 3,
      repositoryConcurrency: 4,
      signalConcurrency: 2
    };

    const token = createGitHubAppInstallationSession(
      config,
      {
        installationId: 77,
        organization: "githealth-labs",
        targetType: "Organization"
      },
      { now: () => Date.parse("2026-01-01T00:00:00.000Z") }
    );

    expect(token).not.toContain("77");
    expect(token).not.toContain("githealth-labs");
    expect(
      parseGitHubAppInstallationSession(config, token, { now: () => Date.parse("2026-01-01T00:10:00.000Z") })
    ).toMatchObject({
      installationId: 77,
      organization: "githealth-labs",
      targetType: "Organization"
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