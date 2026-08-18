import { Badge, Button, Heading, Panel, Text } from "@githealth/ui";
import { useMemo, useState } from "react";
import {
  type HealthStatus,
  type UniverseConnection,
  type UniverseRepository,
  statusLabel
} from "../../../mock/repositoryUniverseData";

type Point = { x: number; y: number };

type UniverseVisualizationProps = {
  organizationName: string;
  organizationScore: number;
  repositories: UniverseRepository[];
  connections: UniverseConnection[];
  visibleRepositoryIds: Set<string>;
  hoveredRepositoryId: string | null;
  selectedRepositoryId: string | null;
  searchQuery: string;
  zoom: number;
  pan: Point;
  reducedMotion: boolean;
  onHoverRepository: (id: string | null) => void;
  onSelectRepository: (id: string) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onPanChange: (point: Point) => void;
};

const center = { x: 500, y: 320 };

function toneClass(status: HealthStatus): string {
  if (status === "needs-attention") {
    return "ru-tone-warning";
  }
  if (status === "critical") {
    return "ru-tone-critical";
  }
  if (status === "no-data") {
    return "ru-tone-muted";
  }
  return "ru-tone-healthy";
}

function project(point: Point, zoom: number, pan: Point): Point {
  return {
    x: center.x + (point.x - center.x) * zoom + pan.x,
    y: center.y + (point.y - center.y) * zoom + pan.y
  };
}

export function UniverseVisualization({
  organizationName,
  organizationScore,
  repositories,
  connections,
  visibleRepositoryIds,
  hoveredRepositoryId,
  selectedRepositoryId,
  searchQuery,
  zoom,
  pan,
  reducedMotion,
  onHoverRepository,
  onSelectRepository,
  onZoomIn,
  onZoomOut,
  onResetView,
  onPanChange
}: UniverseVisualizationProps) {
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState<{ pointerX: number; pointerY: number; panX: number; panY: number } | null>(null);

  const repositoryMap = useMemo(() => {
    const map = new Map<string, UniverseRepository>();
    repositories.forEach((repository) => {
      map.set(repository.id, repository);
    });
    return map;
  }, [repositories]);

  const activeRepositoryId = selectedRepositoryId ?? hoveredRepositoryId;

  const relatedRepositoryIds = useMemo(() => {
    if (!activeRepositoryId) {
      return new Set<string>();
    }

    const related = new Set<string>([activeRepositoryId]);
    connections.forEach((connection) => {
      if (connection.from === activeRepositoryId) {
        related.add(connection.to);
      }
      if (connection.to === activeRepositoryId) {
        related.add(connection.from);
      }
    });
    return related;
  }, [activeRepositoryId, connections]);

  const visibleConnections = useMemo(() => {
    return connections.filter((connection) => visibleRepositoryIds.has(connection.from) && visibleRepositoryIds.has(connection.to));
  }, [connections, visibleRepositoryIds]);

  const activeRepository = activeRepositoryId ? repositoryMap.get(activeRepositoryId) : null;

  return (
    <Panel tone="elevated" className="ru-universe-panel ru-stage ru-stage-universe">
      <div className="ru-universe-header">
        <div>
          <Heading as="h2" size="lg">
            Repository Universe
          </Heading>
          <Text size="sm" tone="muted">
            Interactive engineering ecosystem for {organizationName}
          </Text>
        </div>

        <div className="ru-universe-controls" role="group" aria-label="Universe zoom controls">
          <Button variant="tertiary" size="sm" onClick={onZoomOut} aria-label="Zoom out">
            -
          </Button>
          <Text size="sm" tone="muted">
            {Math.round(zoom * 100)}%
          </Text>
          <Button variant="tertiary" size="sm" onClick={onZoomIn} aria-label="Zoom in">
            +
          </Button>
          <Button variant="secondary" size="sm" onClick={onResetView}>
            Reset View
          </Button>
        </div>
      </div>

      <div className="ru-legend ru-stage-signal" aria-label="Health status legend">
        <Badge tone="healthy">Healthy</Badge>
        <Badge tone="warning">Needs Attention</Badge>
        <Badge tone="critical">Critical</Badge>
        <Badge tone="unknown">No Data</Badge>
      </div>

      <div
        className={`ru-universe-canvas ${isPanning ? "ru-universe-canvas--panning" : ""}`}
        onPointerDown={(event) => {
          if (event.button !== 0) {
            return;
          }
          setIsPanning(true);
          setDragStart({
            pointerX: event.clientX,
            pointerY: event.clientY,
            panX: pan.x,
            panY: pan.y
          });
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!dragStart) {
            return;
          }
          const dx = event.clientX - dragStart.pointerX;
          const dy = event.clientY - dragStart.pointerY;
          onPanChange({ x: dragStart.panX + dx, y: dragStart.panY + dy });
        }}
        onPointerUp={(event) => {
          setIsPanning(false);
          setDragStart(null);
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerLeave={() => {
          setIsPanning(false);
          setDragStart(null);
        }}
      >
        <svg viewBox="0 0 1000 640" role="img" aria-label="Repository relationship map">
          <defs>
            <radialGradient id="ruCoreGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(139, 92, 246, 0.95)" />
              <stop offset="65%" stopColor="rgba(58, 123, 255, 0.92)" />
              <stop offset="100%" stopColor="rgba(5, 11, 23, 0.55)" />
            </radialGradient>
            <linearGradient id="ruConnectionGradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="rgba(77, 215, 255, 0.25)" />
              <stop offset="100%" stopColor="rgba(139, 92, 246, 0.28)" />
            </linearGradient>
          </defs>

          <g className="ru-cluster-layer ru-enter-clusters">
            {(() => {
              const appCenter = project({ x: 700, y: 310 }, zoom, pan);
              const serviceCenter = project({ x: 360, y: 300 }, zoom, pan);
              const platformCenter = project({ x: 520, y: 470 }, zoom, pan);
              return (
                <>
                  <line className="ru-cluster-link ru-cluster-link--app-service" x1={appCenter.x} y1={appCenter.y} x2={serviceCenter.x} y2={serviceCenter.y} />
                  <line className="ru-cluster-link ru-cluster-link--service-platform" x1={serviceCenter.x} y1={serviceCenter.y} x2={platformCenter.x} y2={platformCenter.y} />
                  <line className="ru-cluster-link ru-cluster-link--platform-app" x1={platformCenter.x} y1={platformCenter.y} x2={appCenter.x} y2={appCenter.y} />
                  <circle className="ru-cluster ru-cluster--app" cx={appCenter.x} cy={appCenter.y} r={145 * zoom} />
                  <circle className="ru-cluster ru-cluster--service" cx={serviceCenter.x} cy={serviceCenter.y} r={128 * zoom} />
                  <circle className="ru-cluster ru-cluster--platform" cx={platformCenter.x} cy={platformCenter.y} r={136 * zoom} />
                  <text className="ru-cluster-label ru-cluster-label--app" x={appCenter.x} y={appCenter.y - 150 * zoom}>
                    Product Surface
                  </text>
                  <text className="ru-cluster-label ru-cluster-label--service" x={serviceCenter.x} y={serviceCenter.y - 132 * zoom}>
                    Service Mesh
                  </text>
                  <text className="ru-cluster-label ru-cluster-label--platform" x={platformCenter.x} y={platformCenter.y + 154 * zoom}>
                    Platform Core
                  </text>
                </>
              );
            })()}
          </g>

          <g className={reducedMotion ? "ru-enter-rings" : "ru-orbits ru-enter-rings"}>
            {[160, 230, 300, 370].map((radius) => {
              const projectedCenter = project(center, zoom, pan);
              return (
                <circle
                  key={radius}
                  className="ru-orbit-ring"
                  cx={projectedCenter.x}
                  cy={projectedCenter.y}
                  r={radius * zoom}
                />
              );
            })}
          </g>

          <g className="ru-connection-layer ru-enter-connections">
            {visibleConnections.map((connection) => {
              const fromRepository = repositoryMap.get(connection.from);
              const toRepository = repositoryMap.get(connection.to);
              if (!fromRepository || !toRepository) {
                return null;
              }

              const from = project({ x: fromRepository.x, y: fromRepository.y }, zoom, pan);
              const to = project({ x: toRepository.x, y: toRepository.y }, zoom, pan);

              const related =
                !activeRepositoryId ||
                relatedRepositoryIds.has(connection.from) ||
                relatedRepositoryIds.has(connection.to);
              const activePath =
                Boolean(activeRepositoryId) && (connection.from === activeRepositoryId || connection.to === activeRepositoryId);

              return (
                <line
                  key={`${connection.from}-${connection.to}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  className={`ru-connection ru-connection--${connection.strength} ${related ? "" : "ru-connection--dim"} ${activePath ? "ru-connection--active ru-connection--active-signal" : ""}`}
                />
              );
            })}
          </g>

          <g className="ru-org-group ru-enter-core">
            {(() => {
              const projectedCenter = project(center, zoom, pan);
              return (
                <>
                  <circle className="ru-org-energy" cx={projectedCenter.x} cy={projectedCenter.y} r={58 * zoom} />
                  <circle className="ru-org-glow" cx={projectedCenter.x} cy={projectedCenter.y} r={102 * zoom} />
                  <circle className="ru-org-glow ru-org-glow--inner" cx={projectedCenter.x} cy={projectedCenter.y} r={74 * zoom} />
                  <circle className="ru-org-core" cx={projectedCenter.x} cy={projectedCenter.y} r={40 * zoom} />
                  <text className="ru-org-score" x={projectedCenter.x} y={projectedCenter.y - 5 * zoom}>
                    {organizationScore}
                  </text>
                  <text className="ru-org-label" x={projectedCenter.x} y={projectedCenter.y + 16 * zoom}>
                    {organizationName}
                  </text>
                </>
              );
            })()}
          </g>

          <g className="ru-node-layer">
            {repositories
              .filter((repository) => visibleRepositoryIds.has(repository.id))
              .map((repository, index) => {
                const projected = project({ x: repository.x, y: repository.y }, zoom, pan);
                const related = !activeRepositoryId || relatedRepositoryIds.has(repository.id);
                const selected = selectedRepositoryId === repository.id;
                const hovered = hoveredRepositoryId === repository.id;
                const hasActiveFocus = Boolean(activeRepositoryId);
                const relatedFocus = hasActiveFocus && related && !selected;
                const unrelatedFocus = hasActiveFocus && !related;
                const matchingQuery =
                  searchQuery.trim().length === 0 ||
                  repository.name.toLowerCase().includes(searchQuery.trim().toLowerCase());

                const baseSize = repository.importance === "important" ? 16 : repository.importance === "medium" ? 12 : 9;
                const radius = baseSize * zoom;

                return (
                  <g
                    key={repository.id}
                    role="button"
                    tabIndex={0}
                    className={`ru-repository ru-enter-node ${toneClass(repository.status)} ${selected ? "ru-repository--selected" : ""} ${hovered ? "ru-repository--hovered" : ""} ${related ? "" : "ru-repository--dim"} ${relatedFocus ? "ru-repository--related" : ""} ${unrelatedFocus ? "ru-repository--unrelated" : ""} ${repository.importance === "important" ? "ru-repository--important" : ""} ${matchingQuery ? "" : "ru-repository--search-dim"}`}
                    style={{ animationDelay: `${360 + index * 26}ms` }}
                    onMouseEnter={() => onHoverRepository(repository.id)}
                    onMouseLeave={() => onHoverRepository(null)}
                    onFocus={() => onHoverRepository(repository.id)}
                    onBlur={() => onHoverRepository(null)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelectRepository(repository.id);
                      }
                    }}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectRepository(repository.id);
                    }}
                    aria-label={`${repository.name} ${statusLabel(repository.status)} health score ${repository.healthScore}`}
                  >
                    <circle className={`ru-repository-pulse ${reducedMotion ? "ru-repository-pulse--static" : ""}`} cx={projected.x} cy={projected.y} r={radius * 1.95} />
                    {selected ? <circle className="ru-repository-focus-ring" cx={projected.x} cy={projected.y} r={radius * 2.45} /> : null}
                    <circle className="ru-repository-node" cx={projected.x} cy={projected.y} r={radius} />
                    <text
                      className={`ru-repository-label ${selected ? "ru-repository-label--selected" : ""} ${relatedFocus ? "ru-repository-label--related" : ""} ${unrelatedFocus ? "ru-repository-label--muted" : ""} ${repository.importance === "support" ? "ru-repository-label--support" : ""}`}
                      x={projected.x}
                      y={projected.y + radius + 14}
                    >
                      {repository.name}
                    </text>
                  </g>
                );
              })}
          </g>
        </svg>

        {activeRepository ? (
          <div className="ru-hover-card" role="status" aria-live="polite">
            <strong>{activeRepository.name}</strong>
            <span>{statusLabel(activeRepository.status)}</span>
            <span>Health {activeRepository.healthScore}</span>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
