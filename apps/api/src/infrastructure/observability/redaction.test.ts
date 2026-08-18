import { describe, expect, it } from "vitest";
import { redactString, redactUnknown } from "./redaction.js";

describe("redaction", () => {
  it("redacts bearer token in strings", () => {
    const value = redactString("Authorization: Bearer abc.def.ghi");
    expect(value).toContain("Bearer [REDACTED]");
    expect(value).not.toContain("abc.def.ghi");
  });

  it("redacts sensitive object keys recursively", () => {
    const input = {
      authorization: "Bearer token-value",
      nested: {
        token: "secret-token",
        safe: "value"
      }
    };

    const output = redactUnknown(input) as {
      authorization: string;
      nested: { token: string; safe: string };
    };

    expect(output.authorization).toBe("[REDACTED]");
    expect(output.nested.token).toBe("[REDACTED]");
    expect(output.nested.safe).toBe("value");
  });
});
