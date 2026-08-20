import { describe, expect, it } from "vitest";
import { __testables } from "./githubHealthConfig";

describe("githubHealthConfig sanitizers", () => {
  it("requires explicit organization in live mode", () => {
    expect(__testables.sanitizeOrganization(undefined, "live")).toBe("");
    expect(__testables.sanitizeOrganization("   ", "live")).toBe("");
    expect(__testables.sanitizeOrganization("bad_org_slug", "live")).toBe("");
    expect(__testables.sanitizeOrganization("githealth-labs", "live")).toBe("githealth-labs");
  });

  it("keeps mock-mode organization defaults isolated from live mode", () => {
    expect(__testables.sanitizeOrganization(undefined, "mock")).toBe("githealth-labs");
    expect(__testables.sanitizeOrganization("   ", "mock")).toBe("githealth-labs");
    expect(__testables.sanitizeOrganization("bad_org_slug", "mock")).toBe("githealth-labs");
    expect(__testables.sanitizeOrganization("githealth-labs", "mock")).toBe("githealth-labs");
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

  it("defaults to local API base URL when running on known Vite dev hosts", () => {
    expect(__testables.sanitizeBaseUrl(undefined, { hostname: "localhost", port: "5173" })).toBe("http://localhost:4000");
    expect(__testables.sanitizeBaseUrl(undefined, { hostname: "127.0.0.1", port: "5174" })).toBe("http://localhost:4000");
    expect(__testables.sanitizeBaseUrl(undefined, { hostname: "localhost", port: "3000" })).toBe("");
  });
});
