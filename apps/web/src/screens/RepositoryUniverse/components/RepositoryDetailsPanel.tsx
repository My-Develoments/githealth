import { Badge, Button, Heading, Panel, Text } from "@githealth/ui";
import { type UniverseRepository, statusLabel } from "../../../mock/repositoryUniverseData";

type RepositoryDetailsPanelProps = {
  repository: UniverseRepository | null;
  onClose: () => void;
};

function pathForTrend(values: number[], width: number, height: number): string {
  if (values.length === 0) {
    return "";
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  const step = width / (values.length - 1);

  return values
    .map((value, index) => {
      const x = index * step;
      const y = height - ((value - min) / range) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function toneFromStatus(status: UniverseRepository["status"]): "healthy" | "warning" | "critical" | "unknown" {
  if (status === "critical") {
    return "critical";
  }
  if (status === "needs-attention") {
    return "warning";
  }
  if (status === "no-data") {
    return "unknown";
  }
  return "healthy";
}

function statusExplanation(repository: UniverseRepository): string {
  if (repository.status === "no-data") {
    return "Health signals are unavailable for this repository. This missing-data state is not the same as a healthy or low numeric score.";
  }

  if (repository.status === "critical") {
    return "Multiple repository health signals are below target thresholds. Prioritize the remediation guidance below before the next release cycle.";
  }

  if (repository.status === "needs-attention") {
    return "At least one health domain is below target. Apply the listed remediation actions to prevent this repository from drifting into critical state.";
  }

  return "Available health signals indicate this repository is stable. Keep applying existing controls and monitor for regressions.";
}

export function RepositoryDetailsPanel({ repository, onClose }: RepositoryDetailsPanelProps) {
  if (!repository) {
    return (
      <Panel tone="subtle" className="ru-details-panel ru-details-panel--placeholder">
        <Heading as="h3" size="md">
          Repository Details
        </Heading>
        <Text size="sm" tone="muted">
          Select a repository node to inspect health signals, risks, and recommendations.
        </Text>
      </Panel>
    );
  }

  const trendPath = pathForTrend(repository.trend, 180, 64);
  const hasOperationalData = repository.operationalDataAvailable !== false;
  const hasTrendData = repository.trendDataAvailable !== false && repository.trend.length > 0;

  return (
    <Panel tone="base" className="ru-details-panel ru-details-panel--active" key={repository.id}>
      <div className="ru-details-header">
        <div>
          <Heading as="h3" size="lg">
            {repository.name}
          </Heading>
          <Text size="sm" tone="muted">
            Last activity: {hasOperationalData ? repository.lastActivity : "Unavailable"}
          </Text>
        </div>
        <Button variant="tertiary" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>

      <div className="ru-details-score-row">
        <div className="ru-details-score-value">
          <span>{repository.healthScore}</span>
          <Text size="sm" tone="muted">
            Health Score
          </Text>
        </div>
        <Badge tone={toneFromStatus(repository.status)}>{statusLabel(repository.status)}</Badge>
      </div>

      <Text size="sm" tone={repository.status === "no-data" ? "muted" : "secondary"}>
        {statusExplanation(repository)}
      </Text>

      <div className="ru-details-metrics">
        <div>
          <Text size="sm" tone="muted">
            Security
          </Text>
          <Heading as="h4" size="md">
            {repository.securityScore}
          </Heading>
        </div>
        <div>
          <Text size="sm" tone="muted">
            Governance
          </Text>
          <Heading as="h4" size="md">
            {repository.governanceScore}
          </Heading>
        </div>
        <div>
          <Text size="sm" tone="muted">
            CI/CD
          </Text>
          <Heading as="h4" size="md">
            {repository.cicdScore}
          </Heading>
        </div>
        <div>
          <Text size="sm" tone="muted">
            Quality
          </Text>
          <Heading as="h4" size="md">
            {repository.qualityScore}
          </Heading>
        </div>
      </div>

      <div className="ru-details-operational">
        {hasOperationalData ? (
          <>
            <Text size="sm" tone="secondary">
              Open issues: {repository.openIssues}
            </Text>
            <Text size="sm" tone="secondary">
              Pull requests: {repository.pullRequests}
            </Text>
            <Text size="sm" tone="secondary">
              Security alerts: {repository.securityAlerts}
            </Text>
            <Text size="sm" tone="secondary">
              Dependencies: {repository.dependencies}
            </Text>
          </>
        ) : (
          <Text size="sm" tone="muted">
            Operational repository metrics are unavailable from the current API source.
          </Text>
        )}
      </div>

      {hasTrendData ? (
        <div className="ru-details-trend" role="img" aria-label={`Health trend for ${repository.name}`}>
          <svg viewBox="0 0 180 72" preserveAspectRatio="none" aria-hidden="true">
            <path d={`${trendPath} L180,72 L0,72 Z`} className="ru-details-trend-area" />
            <path d={trendPath} className="ru-details-trend-line" />
          </svg>
        </div>
      ) : (
        <Text size="sm" tone="muted">
          Repository trend data is unavailable from the current API source.
        </Text>
      )}

      <div className="ru-details-columns">
        <div>
          <Heading as="h4" size="sm">
            Top Problems
          </Heading>
          <ul className="ru-details-list">
            {repository.topProblems.map((problem) => (
              <li key={problem}>
                <Text size="sm" tone="secondary">
                  {problem}
                </Text>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <Heading as="h4" size="sm">
            Recommendations
          </Heading>
          <ul className="ru-details-list">
            {repository.recommendations.map((recommendation) => (
              <li key={recommendation}>
                <Text size="sm" tone="secondary">
                  {recommendation}
                </Text>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Panel>
  );
}
