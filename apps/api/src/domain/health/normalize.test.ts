import { describe, expect, it } from "vitest";
import { normalizeMetric } from "./normalize.js";
import { METRIC_DEFINITIONS } from "./constants.js";
import type { HealthMetricDefinition } from "./types.js";

describe("normalizeMetric", () => {
  it("normalizes higher-is-better metrics to [0,1]", () => {
    const definition = METRIC_DEFINITIONS.find((value) => value.key === "test_coverage");
    if (!definition) {
      throw new Error("Metric definition not found");
    }

    const result = normalizeMetric(75, definition, "repo-a");
    expect(result.value).toBeCloseTo(0.75, 4);
    expect(result.missing).toBe(false);
  });

  it("normalizes lower-is-better metrics inversely", () => {
    const definition = METRIC_DEFINITIONS.find((value) => value.key === "security_alerts_open");
    if (!definition) {
      throw new Error("Metric definition not found");
    }

    const result = normalizeMetric(5, definition, "repo-a");
    expect(result.value).toBeCloseTo(0.75, 4);
  });

  it("marks missing values and emits validation issue", () => {
    const definition = METRIC_DEFINITIONS.find((value) => value.key === "ci_success_rate");
    if (!definition) {
      throw new Error("Metric definition not found");
    }

    const result = normalizeMetric(undefined, definition, "repo-a");
    expect(result.value).toBeNull();
    expect(result.missing).toBe(true);
    expect(result.invalid).toBe(false);
    expect(result.issues[0]?.code).toBe("METRIC_MISSING");
  });

  it("marks NaN values as explicit invalid metrics", () => {
    const definition = METRIC_DEFINITIONS.find((value) => value.key === "ci_success_rate");
    if (!definition) {
      throw new Error("Metric definition not found");
    }

    const result = normalizeMetric(Number.NaN, definition, "repo-a");
    expect(result.value).toBeNull();
    expect(result.missing).toBe(false);
    expect(result.invalid).toBe(true);
    expect(result.issues[0]?.code).toBe("METRIC_INVALID");
  });

  it("clamps out-of-range values", () => {
    const definition = METRIC_DEFINITIONS.find((value) => value.key === "vuln_resolution_rate");
    if (!definition) {
      throw new Error("Metric definition not found");
    }

    const result = normalizeMetric(180, definition, "repo-a");
    expect(result.value).toBe(1);
    expect(result.invalid).toBe(false);
    expect(result.issues[0]?.code).toBe("METRIC_CLAMPED");
  });

  it("handles invalid metric-definition bounds deterministically", () => {
    const invalidDefinition: HealthMetricDefinition = {
      key: "invalid_metric",
      label: "Invalid Metric",
      category: "security",
      weight: 1,
      min: 20,
      max: 20,
      direction: "higher-is-better"
    };

    const result = normalizeMetric(20, invalidDefinition, "repo-a");
    expect(result.value).toBeNull();
    expect(result.missing).toBe(false);
    expect(result.invalid).toBe(true);
    expect(result.issues[0]?.code).toBe("METRIC_CONFIG_INVALID");
  });
});
