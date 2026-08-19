import { describe, expect, it } from "vitest";
import { __testables } from "./githubHealthConfig";

describe("githubHealthConfig sanitizers", () => {
  it("falls back to default org for invalid slugs", () => {
    expect(__testables.sanitizeOrganization(undefined)).toBe("githealth-labs");
    expect(__testables.sanitizeOrganization("   ")).toBe("githealth-labs");
    expect(__testables.sanitizeOrganization("bad_org_slug")).toBe("githealth-labs");
    expect(__testables.sanitizeOrganization("githealth-labs")).toBe("githealth-labs");
  });

  it("defaults to live for missing/invalid sources while preserving explicit mock", () => {
    expect(__testables.sanitizeSource(undefined)).toBe("live");
    expect(__testables.sanitizeSource("bad-value")).toBe("live");
    expect(__testables.sanitizeSource("mock")).toBe("mock");
    expect(__testables.sanitizeSource("live")).toBe("live");
  });

  it("trims trailing slash from base URL", () => {
    expect(__testables.sanitizeBaseUrl("https://example.com/")).toBe("https://example.com");
    expect(__testables.sanitizeBaseUrl("https://example.com")).toBe("https://example.com");
  });
});
