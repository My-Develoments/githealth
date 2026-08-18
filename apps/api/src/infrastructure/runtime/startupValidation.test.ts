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

  afterEach(() => {
    restoreEnv("PORT", previousPort);
    restoreEnv("GITHUB_API_BASE_URL", previousApiBase);
  });

  it("throws for invalid port", () => {
    process.env.PORT = "-1";
    expect(() => validateStartupConfiguration()).toThrow("Invalid PORT value");
  });

  it("throws for invalid GitHub API base URL", () => {
    process.env.PORT = "4000";
    process.env.GITHUB_API_BASE_URL = "not-a-url";

    expect(() => validateStartupConfiguration()).toThrow("Invalid GITHUB_API_BASE_URL value.");
  });
});
