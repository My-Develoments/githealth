import { describe, expect, it } from "vitest";
import { __testables } from "./githubHealthConfig";

describe("githubHealthConfig sanitizers", () => {
  it("falls back to default org for invalid slugs", () => {
    expect(__testables.sanitizeOrganization(undefined)).toBe("githealth-labs");
    expect(__testables.sanitizeOrganization("   ")).toBe("githealth-labs");
    expect(__testables.sanitizeOrganization("bad_org_slug")).toBe("githealth-labs");
    expect(__testables.sanitizeOrganization("githealth-labs")).toBe("githealth-labs");
  });

  it("falls back to mock for invalid sources", () => {
    expect(__testables.sanitizeSource(undefined)).toBe("mock");
    expect(__testables.sanitizeSource("bad-value")).toBe("mock");
    expect(__testables.sanitizeSource("live")).toBe("live");
  });

  it("trims trailing slash from base URL", () => {
    expect(__testables.sanitizeBaseUrl("https://example.com/")).toBe("https://example.com");
    expect(__testables.sanitizeBaseUrl("https://example.com")).toBe("https://example.com");
  });
});
