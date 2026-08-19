import { Badge, Heading, Panel, Text } from "@githealth/ui";
import {
  type UniverseActivity,
  type UniverseInsight,
  type UniverseRepository,
  statusLabel
} from "../../../mock/repositoryUniverseData";

type UniverseInsightsPanelProps = {
  insights: UniverseInsight[];
  activity: UniverseActivity[];
  repositories: UniverseRepository[];
};

function badgeToneFromStatus(status: string): "healthy" | "warning" | "critical" | "unknown" {
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

export function UniverseInsightsPanel({ insights, activity, repositories }: UniverseInsightsPanelProps) {
  const highestRisk = [...repositories]
    .filter((repository) => repository.status !== "no-data")
    .sort((a, b) => a.healthScore - b.healthScore)
    .slice(0, 4);

  return (
    <div className="ru-intelligence-column">
      <Panel tone="base" className="ru-insight-panel">
        <Heading as="h3" size="md">
          Universe Intelligence
        </Heading>
        <ul className="ru-insight-list">
          {insights.map((insight) => (
            <li key={insight.id}>
              <Text size="sm" tone="muted">
                {insight.label}
              </Text>
              <Badge tone={badgeToneFromStatus(insight.tone)}>{insight.value}</Badge>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel tone="subtle" className="ru-risk-panel">
        <Heading as="h3" size="sm">
          Top Risk Repositories
        </Heading>
        <ul className="ru-risk-list">
          {highestRisk.map((repository) => (
            <li key={repository.id}>
              <Text size="sm">{repository.name}</Text>
              <div className="ru-risk-score-wrap">
                <span className="ru-risk-bar" style={{ width: `${repository.healthScore}%` }} />
                <Text size="sm" tone="muted">
                  {repository.healthScore}
                </Text>
                <Text size="sm" tone="secondary">
                  {statusLabel(repository.status)}
                </Text>
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel tone="subtle" className="ru-activity-panel">
        <Heading as="h3" size="sm">
          Recent Engineering Activity
        </Heading>
        {activity.length > 0 ? (
          <ul className="ru-activity-list">
            {activity.map((entry) => (
              <li key={entry.id}>
                <span className={`ru-activity-dot ru-activity-dot--${badgeToneFromStatus(entry.tone)}`} aria-hidden="true" />
                <div>
                  <Text size="sm">{entry.event}</Text>
                  <Text size="sm" tone="secondary">
                    {entry.context}
                  </Text>
                </div>
                <Text size="sm" tone="muted">
                  {entry.when}
                </Text>
              </li>
            ))}
          </ul>
        ) : (
          <Text size="sm" tone="muted">
            Recent engineering activity is unavailable from the current API source.
          </Text>
        )}
      </Panel>
    </div>
  );
}
