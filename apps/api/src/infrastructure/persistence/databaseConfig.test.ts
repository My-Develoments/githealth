import { afterEach, describe, expect, it } from "vitest";
import { getDatabaseConfig } from "./databaseConfig.js";

function restoreEnv(name: string, previous: string | undefined): void {
  if (typeof previous === "undefined") {
    delete process.env[name];
    return;
  }

  process.env[name] = previous;
}

describe("getDatabaseConfig", () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousDatabaseSslMode = process.env.DATABASE_SSL_MODE;

  afterEach(() => {
    restoreEnv("DATABASE_URL", previousDatabaseUrl);
    restoreEnv("DATABASE_SSL_MODE", previousDatabaseSslMode);
  });

  it("defaults ssl mode to disable when not provided", () => {
    process.env.DATABASE_URL = "postgres://user:password@localhost:5432/githealth";
    delete process.env.DATABASE_SSL_MODE;

    expect(getDatabaseConfig()).toMatchObject({
      sslMode: "disable"
    });
  });

  it("accepts require ssl mode for managed postgres", () => {
    process.env.DATABASE_URL = "postgres://user:password@localhost:5432/githealth";
    process.env.DATABASE_SSL_MODE = "require";

    expect(getDatabaseConfig()).toMatchObject({
      sslMode: "require"
    });
  });

  it("rejects invalid ssl mode", () => {
    process.env.DATABASE_URL = "postgres://user:password@localhost:5432/githealth";
    process.env.DATABASE_SSL_MODE = "invalid";

    expect(() => getDatabaseConfig()).toThrow("Invalid DATABASE_SSL_MODE value");
  });
});
