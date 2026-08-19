import { afterEach, describe, expect, it } from "vitest";
import { validateStartupConfiguration } from "./startupValidation.js";

function restoreEnv(name: string, previous: string | undefined): void {
  if (typeof previous === "undefined") {
    delete process.env[name];
    return;
  }

  process.env[name] = previous;
}

describe("validateStartupConfiguration", () => {
  const previousPort = process.env.PORT;
  const previousApiBase = process.env.GITHUB_API_BASE_URL;
  const previousApiAuthToken = process.env.API_AUTH_TOKEN;
  const previousAllowedGitHubOrgs = process.env.ALLOWED_GITHUB_ORGS;
  const previousWindowMs = process.env.GITHUB_ENDPOINT_RATE_LIMIT_WINDOW_MS;
  const previousMaxRequests = process.env.GITHUB_ENDPOINT_RATE_LIMIT_MAX_REQUESTS;

  afterEach(() => {
    restoreEnv("PORT", previousPort);
    restoreEnv("GITHUB_API_BASE_URL", previousApiBase);
    restoreEnv("API_AUTH_TOKEN", previousApiAuthToken);
    restoreEnv("ALLOWED_GITHUB_ORGS", previousAllowedGitHubOrgs);
    restoreEnv("GITHUB_ENDPOINT_RATE_LIMIT_WINDOW_MS", previousWindowMs);
    restoreEnv("GITHUB_ENDPOINT_RATE_LIMIT_MAX_REQUESTS", previousMaxRequests);
  });

  it("throws for invalid port", () => {
    process.env.PORT = "-1";
    expect(() => validateStartupConfiguration()).toThrow("Invalid PORT value");
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
    process.env.GITHUB_API_BASE_URL = "https://api.github.com";

    expect(() => validateStartupConfiguration()).not.toThrow();
  });
});
