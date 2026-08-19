import { afterEach, describe, expect, it, vi } from "vitest";

function restoreEnv(name: string, previous: string | undefined): void {
  if (typeof previous === "undefined") {
    delete process.env[name];
    return;
  }

  process.env[name] = previous;
}

describe("startup bootstrap", () => {
  const previousPort = process.env.PORT;
  const previousApiAuthToken = process.env.API_AUTH_TOKEN;

  afterEach(() => {
    restoreEnv("PORT", previousPort);
    restoreEnv("API_AUTH_TOKEN", previousApiAuthToken);
  });

  it("fails clearly when startup configuration is invalid", async () => {
    process.env.API_AUTH_TOKEN = "issue23-token";
    process.env.PORT = "-1";
    vi.resetModules();

    await expect(import("./index.js")).rejects.toThrow("Invalid PORT value");
  });
});
