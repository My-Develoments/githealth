import { afterEach, describe, expect, it } from "vitest";
import {
  getApiProtectionConfig,
  isAllowedGitHubOrganization
} from "./apiProtectionConfig.js";

function restoreEnv(name: string, previous: string | undefined): void {
  if (typeof previous === "undefined") {
    delete process.env[name];
    return;
  }

  process.env[name] = previous;
}

describe("getApiProtectionConfig", () => {
  const previousApiAuthToken = process.env.API_AUTH_TOKEN;
  const previousAllowedGitHubOrgs = process.env.ALLOWED_GITHUB_ORGS;
  const previousWindowMs = process.env.GITHUB_ENDPOINT_RATE_LIMIT_WINDOW_MS;
  const previousMaxRequests = process.env.GITHUB_ENDPOINT_RATE_LIMIT_MAX_REQUESTS;

  afterEach(() => {
    restoreEnv("API_AUTH_TOKEN", previousApiAuthToken);
    restoreEnv("ALLOWED_GITHUB_ORGS", previousAllowedGitHubOrgs);
    restoreEnv("GITHUB_ENDPOINT_RATE_LIMIT_WINDOW_MS", previousWindowMs);
    restoreEnv("GITHUB_ENDPOINT_RATE_LIMIT_MAX_REQUESTS", previousMaxRequests);
  });

  it("throws when API auth token is missing", () => {
    delete process.env.API_AUTH_TOKEN;

    expect(() => getApiProtectionConfig()).toThrow("Invalid API_AUTH_TOKEN value");
  });

  it("normalizes and deduplicates allowed organizations", () => {
    process.env.API_AUTH_TOKEN = "secure-token";
    process.env.ALLOWED_GITHUB_ORGS = " GitHealth-Labs,githealth-labs, Another-Org ";

    const config = getApiProtectionConfig();

    expect(config.allowedGitHubOrgs).toEqual(["githealth-labs", "another-org"]);
    expect(isAllowedGitHubOrganization("GITHEALTH-LABS", config.allowedGitHubOrgSet)).toBe(true);
    expect(isAllowedGitHubOrganization("unknown-org", config.allowedGitHubOrgSet)).toBe(false);
  });

  it("throws for invalid inbound throttle values", () => {
    process.env.API_AUTH_TOKEN = "secure-token";
    process.env.GITHUB_ENDPOINT_RATE_LIMIT_WINDOW_MS = "0";

    expect(() => getApiProtectionConfig()).toThrow("Invalid GITHUB_ENDPOINT_RATE_LIMIT_WINDOW_MS value");

    process.env.GITHUB_ENDPOINT_RATE_LIMIT_WINDOW_MS = "60000";
    process.env.GITHUB_ENDPOINT_RATE_LIMIT_MAX_REQUESTS = "-1";

    expect(() => getApiProtectionConfig()).toThrow("Invalid GITHUB_ENDPOINT_RATE_LIMIT_MAX_REQUESTS value");
  });

  it("returns defaults for inbound throttle when values are omitted", () => {
    process.env.API_AUTH_TOKEN = "secure-token";
    delete process.env.GITHUB_ENDPOINT_RATE_LIMIT_WINDOW_MS;
    delete process.env.GITHUB_ENDPOINT_RATE_LIMIT_MAX_REQUESTS;

    const config = getApiProtectionConfig();

    expect(config.githubEndpointRateLimitWindowMs).toBe(60000);
    expect(config.githubEndpointRateLimitMaxRequests).toBe(60);
  });
});
