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
  const previousToken = process.env.GITHUB_TOKEN;
  const previousApiBaseUrl = process.env.GITHUB_API_BASE_URL;

  afterEach(() => {
    restoreEnv("GITHUB_TOKEN", previousToken);
    restoreEnv("GITHUB_API_BASE_URL", previousApiBaseUrl);
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
});
