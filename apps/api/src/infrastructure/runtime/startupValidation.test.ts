import { afterEach, describe, expect, it } from "vitest";
import { getStartupValidationStatus, resetStartupValidationStatusForTests, validateStartupConfiguration } from "./startupValidation.js";

function restoreEnv(name: string, previous: string | undefined): void {
  if (typeof previous === "undefined") {
    delete process.env[name];
    return;
  }

  process.env[name] = previous;
}

describe("validateStartupConfiguration", () => {
  const previousPort = process.env.PORT;
  const previousProvider = process.env.GITHUB_AUTH_PROVIDER;
  const previousApiBase = process.env.GITHUB_API_BASE_URL;
  const previousApiAuthToken = process.env.API_AUTH_TOKEN;
  const previousAllowedGitHubOrgs = process.env.ALLOWED_GITHUB_ORGS;
  const previousWindowMs = process.env.GITHUB_ENDPOINT_RATE_LIMIT_WINDOW_MS;
  const previousMaxRequests = process.env.GITHUB_ENDPOINT_RATE_LIMIT_MAX_REQUESTS;
  const previousCacheTtlMs = process.env.GITHUB_SCORE_CACHE_TTL_MS;
  const previousAppId = process.env.GITHUB_APP_ID;
  const previousAppPrivateKey = process.env.GITHUB_APP_PRIVATE_KEY;
  const previousAppInstallUrl = process.env.GITHUB_APP_INSTALL_URL;
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousDatabaseSslMode = process.env.DATABASE_SSL_MODE;
  const previousNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    resetStartupValidationStatusForTests();
    restoreEnv("PORT", previousPort);
    restoreEnv("GITHUB_AUTH_PROVIDER", previousProvider);
    restoreEnv("GITHUB_API_BASE_URL", previousApiBase);
    restoreEnv("API_AUTH_TOKEN", previousApiAuthToken);
    restoreEnv("ALLOWED_GITHUB_ORGS", previousAllowedGitHubOrgs);
    restoreEnv("GITHUB_ENDPOINT_RATE_LIMIT_WINDOW_MS", previousWindowMs);
    restoreEnv("GITHUB_ENDPOINT_RATE_LIMIT_MAX_REQUESTS", previousMaxRequests);
    restoreEnv("GITHUB_SCORE_CACHE_TTL_MS", previousCacheTtlMs);
    restoreEnv("GITHUB_APP_ID", previousAppId);
    restoreEnv("GITHUB_APP_PRIVATE_KEY", previousAppPrivateKey);
    restoreEnv("GITHUB_APP_INSTALL_URL", previousAppInstallUrl);
    restoreEnv("DATABASE_URL", previousDatabaseUrl);
    restoreEnv("DATABASE_SSL_MODE", previousDatabaseSslMode);
    restoreEnv("NODE_ENV", previousNodeEnv);
  });

  it("throws for invalid port", () => {
    process.env.PORT = "-1";
    expect(() => validateStartupConfiguration()).toThrow("Invalid PORT value");
    expect(getStartupValidationStatus()).toBe("error");
  });

  it("throws for invalid GitHub API base URL", () => {
    process.env.PORT = "4000";
    process.env.API_AUTH_TOKEN = "issue23-token";
    process.env.GITHUB_API_BASE_URL = "not-a-url";

    expect(() => validateStartupConfiguration()).toThrow("Invalid GITHUB_API_BASE_URL value.");
  });

  it("throws for missing API protection token", () => {
    process.env.PORT = "4000";
    delete process.env.API_AUTH_TOKEN;

    expect(() => validateStartupConfiguration()).toThrow("Invalid API_AUTH_TOKEN value");
  });

  it("passes for valid startup configuration", () => {
    process.env.PORT = "4000";
    process.env.API_AUTH_TOKEN = "issue23-token";
    process.env.ALLOWED_GITHUB_ORGS = "githealth-labs";
    process.env.GITHUB_ENDPOINT_RATE_LIMIT_WINDOW_MS = "60000";
    process.env.GITHUB_ENDPOINT_RATE_LIMIT_MAX_REQUESTS = "60";
    process.env.GITHUB_SCORE_CACHE_TTL_MS = "30000";
    process.env.GITHUB_API_BASE_URL = "https://api.github.com";
    process.env.NODE_ENV = "test";

    expect(() => validateStartupConfiguration()).not.toThrow();
    expect(getStartupValidationStatus()).toBe("ok");
  });

  it("throws for missing database configuration outside test mode", () => {
    process.env.PORT = "4000";
    process.env.API_AUTH_TOKEN = "issue23-token";
    process.env.GITHUB_API_BASE_URL = "https://api.github.com";
    process.env.NODE_ENV = "production";
    delete process.env.DATABASE_URL;

    expect(() => validateStartupConfiguration()).toThrow("Invalid DATABASE_URL value");
  });

  it("throws for invalid cache TTL", () => {
    process.env.PORT = "4000";
    process.env.API_AUTH_TOKEN = "issue23-token";
    process.env.GITHUB_API_BASE_URL = "https://api.github.com";
    process.env.GITHUB_SCORE_CACHE_TTL_MS = "0";

    expect(() => validateStartupConfiguration()).toThrow("Invalid GITHUB_SCORE_CACHE_TTL_MS value.");
  });

  it("throws for invalid database ssl mode outside test mode", () => {
    process.env.PORT = "4000";
    process.env.API_AUTH_TOKEN = "issue23-token";
    process.env.GITHUB_API_BASE_URL = "https://api.github.com";
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = "postgres://user:password@localhost:5432/githealth";
    process.env.DATABASE_SSL_MODE = "invalid";

    expect(() => validateStartupConfiguration()).toThrow("Invalid DATABASE_SSL_MODE value");
  });

  it("throws when app mode is enabled without onboarding or installation configuration", () => {
    process.env.PORT = "4000";
    process.env.API_AUTH_TOKEN = "issue23-token";
    process.env.GITHUB_API_BASE_URL = "https://api.github.com";
    process.env.GITHUB_AUTH_PROVIDER = "app";
    process.env.GITHUB_APP_ID = "12345";
    process.env.GITHUB_APP_PRIVATE_KEY = TEST_PRIVATE_KEY;
    delete process.env.GITHUB_APP_INSTALL_URL;

    expect(() => validateStartupConfiguration()).toThrow(
      "GitHub App mode requires GITHUB_APP_INSTALLATION_ID or GITHUB_APP_INSTALL_URL."
    );
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
