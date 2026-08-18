import type { HealthMetricDefinition, MetricNormalizationResult, ValidationIssue } from "./types.js";
import { clamp } from "./utils.js";

function issue(message: string, metricKey: string, code: string, repositoryId: string): ValidationIssue {
  return {
    scope: "metric",
    code,
    message,
    metricKey,
    repositoryId
  };
}

export function normalizeMetric(
  rawValue: number | null | undefined,
  definition: HealthMetricDefinition,
  repositoryId: string
): MetricNormalizationResult {
  if (rawValue === null || rawValue === undefined) {
    return {
      value: null,
      missing: true,
      invalid: false,
      issues: [
        issue("Metric value is missing", definition.key, "METRIC_MISSING", repositoryId)
      ]
    };
  }

  if (Number.isNaN(rawValue)) {
    return {
      value: null,
      missing: false,
      invalid: true,
      issues: [
        issue("Metric value is invalid (NaN)", definition.key, "METRIC_INVALID", repositoryId)
      ]
    };
  }

  const clamped = clamp(rawValue, definition.min, definition.max);
  const wasClamped = clamped !== rawValue;
  const span = definition.max - definition.min;

  if (span <= 0) {
    return {
      value: null,
      missing: false,
      invalid: true,
      issues: [
        issue("Metric definition bounds are invalid", definition.key, "METRIC_CONFIG_INVALID", repositoryId)
      ]
    };
  }

  const normalizedBase = (clamped - definition.min) / span;
  const normalized =
    definition.direction === "higher-is-better"
      ? normalizedBase
      : 1 - normalizedBase;

  return {
    value: clamp(normalized, 0, 1),
    missing: false,
    invalid: false,
    issues: wasClamped
      ? [
          issue(
            "Metric value was out of bounds and clamped",
            definition.key,
            "METRIC_CLAMPED",
            repositoryId
          )
        ]
      : []
  };
}
