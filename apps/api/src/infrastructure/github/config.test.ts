import { afterEach, describe, expect, it } from "vitest";
import { getGitHubConfig } from "./config.js";

function restoreEnv(name: string, previous: string | undefined): void {
  if (typeof previous === "undefined") {
    delete process.env[name];
    return;
  }

  process.env[name] = previous;
}

describe("getGitHubConfig", () => {
  const previousProvider = process.env.GITHUB_AUTH_PROVIDER;
  const previousToken = process.env.GITHUB_TOKEN;
  const previousApiBaseUrl = process.env.GITHUB_API_BASE_URL;
  const previousAppId = process.env.GITHUB_APP_ID;
  const previousAppPrivateKey = process.env.GITHUB_APP_PRIVATE_KEY;
  const previousAppInstallationId = process.env.GITHUB_APP_INSTALLATION_ID;
  const previousAppInstallUrl = process.env.GITHUB_APP_INSTALL_URL;
  const previousAppRedirectUrl = process.env.GITHUB_APP_ONBOARDING_REDIRECT_URL;

  afterEach(() => {
    restoreEnv("GITHUB_AUTH_PROVIDER", previousProvider);
    restoreEnv("GITHUB_TOKEN", previousToken);
    restoreEnv("GITHUB_API_BASE_URL", previousApiBaseUrl);
    restoreEnv("GITHUB_APP_ID", previousAppId);
    restoreEnv("GITHUB_APP_PRIVATE_KEY", previousAppPrivateKey);
    restoreEnv("GITHUB_APP_INSTALLATION_ID", previousAppInstallationId);
    restoreEnv("GITHUB_APP_INSTALL_URL", previousAppInstallUrl);
    restoreEnv("GITHUB_APP_ONBOARDING_REDIRECT_URL", previousAppRedirectUrl);
  });

  it("trims token and keeps it undefined when blank", () => {
    process.env.GITHUB_TOKEN = "   ";
    expect(getGitHubConfig().token).toBeUndefined();

    process.env.GITHUB_TOKEN = "  abc123  ";
    expect(getGitHubConfig().token).toBe("abc123");
  });

  it("validates GITHUB_API_BASE_URL", () => {
    process.env.GITHUB_API_BASE_URL = "not-a-url";
    expect(() => getGitHubConfig()).toThrow("Invalid GITHUB_API_BASE_URL value.");

    process.env.GITHUB_API_BASE_URL = "https://api.github.com/";
    expect(getGitHubConfig().apiBaseUrl).toBe("https://api.github.com");
  });

  it("defaults to pat provider when provider is unset", () => {
    delete process.env.GITHUB_AUTH_PROVIDER;

    expect(getGitHubConfig().authProvider).toBe("pat");
  });

  it("validates GitHub App mode only when explicitly enabled", () => {
    process.env.GITHUB_AUTH_PROVIDER = "app";
    delete process.env.GITHUB_APP_ID;

    expect(() => getGitHubConfig()).toThrow("Invalid GITHUB_APP_ID value.");
  });

  it("requires app installation connectivity or onboarding in app mode", () => {
    process.env.GITHUB_AUTH_PROVIDER = "app";
    process.env.GITHUB_APP_ID = "12345";
    process.env.GITHUB_APP_PRIVATE_KEY = TEST_PRIVATE_KEY;
    delete process.env.GITHUB_APP_INSTALLATION_ID;
    delete process.env.GITHUB_APP_INSTALL_URL;

    expect(() => getGitHubConfig()).toThrow(
      "GitHub App mode requires GITHUB_APP_INSTALLATION_ID or GITHUB_APP_INSTALL_URL."
    );
  });

  it("normalizes GitHub App private key newlines and onboarding URLs", () => {
    process.env.GITHUB_AUTH_PROVIDER = "app";
    process.env.GITHUB_APP_ID = "12345";
    process.env.GITHUB_APP_PRIVATE_KEY = TEST_PRIVATE_KEY.replace(/\n/g, "\\n");
    process.env.GITHUB_APP_INSTALL_URL = "https://github.com/apps/githealth/installations/new";
    process.env.GITHUB_APP_ONBOARDING_REDIRECT_URL = "http://localhost:5173/";

    const config = getGitHubConfig();

    expect(config.authProvider).toBe("app");
    expect(config.app?.privateKey).toContain("\n");
    expect(config.app?.installUrl).toBe("https://github.com/apps/githealth/installations/new");
    expect(config.app?.onboardingRedirectUrl).toBe("http://localhost:5173/");
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
