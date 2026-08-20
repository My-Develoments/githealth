export type DatabaseSslMode = "disable" | "require";

export type DatabaseConfig = {
  connectionString: string;
  sslMode: DatabaseSslMode;
};

function parseRequiredString(rawValue: string | undefined, envName: string): string {
  const normalized = typeof rawValue === "string" ? rawValue.trim() : "";
  if (normalized.length === 0) {
    throw new Error(`Invalid ${envName} value. Expected a non-empty connection string.`);
  }

  return normalized;
}

function parseSslMode(rawValue: string | undefined): DatabaseSslMode {
  const normalized = typeof rawValue === "string" ? rawValue.trim().toLowerCase() : "";
  if (normalized.length === 0 || normalized === "disable") {
    return "disable";
  }

  if (normalized === "require") {
    return "require";
  }

  throw new Error("Invalid DATABASE_SSL_MODE value. Expected 'disable' or 'require'.");
}

export function getDatabaseConfig(): DatabaseConfig {
  return {
    connectionString: parseRequiredString(process.env.DATABASE_URL, "DATABASE_URL"),
    sslMode: parseSslMode(process.env.DATABASE_SSL_MODE)
  };
}