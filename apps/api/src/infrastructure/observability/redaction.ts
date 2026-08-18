const SECRET_KEYS = [
  "authorization",
  "token",
  "secret",
  "password",
  "apiKey"
] as const;

function isSecretKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return SECRET_KEYS.some((secretKey) => normalized.includes(secretKey.toLowerCase()));
}

function redactBearerToken(value: string): string {
  return value.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]");
}

function redactKnownSecrets(value: string): string {
  const knownSecrets = [
    process.env.GITHUB_TOKEN,
    process.env.GITHUB_API_BASE_URL
  ].filter((entry): entry is string => typeof entry === "string" && entry.length > 0);

  let result = value;
  for (const secret of knownSecrets) {
    result = result.split(secret).join("[REDACTED]");
  }

  return result;
}

export function redactString(value: string): string {
  return redactKnownSecrets(redactBearerToken(value));
}

export function redactUnknown(value: unknown): unknown {
  if (typeof value === "string") {
    return redactString(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactUnknown(entry));
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    const redacted = entries.map(([key, entry]) => {
      if (isSecretKey(key)) {
        return [key, "[REDACTED]"] as const;
      }
      return [key, redactUnknown(entry)] as const;
    });
    return Object.fromEntries(redacted);
  }

  return value;
}
