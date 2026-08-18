import { Badge, Button, Heading, Panel, Text } from "@githealth/ui";
import { useEffect, useMemo, useState } from "react";
import {
  universeConnections,
  universeDomainFilters,
  universeFilters,
  universeOrganization,
  universeRepositories,
  universeRecentActivity,
  universeTopInsights,
  type HealthStatus,
  type UniverseRepository
} from "../../mock/repositoryUniverseData";
import { RepositoryDetailsPanel } from "./components/RepositoryDetailsPanel";
import { UniverseInsightsPanel } from "./components/UniverseInsightsPanel";
import { UniverseVisualization } from "./components/UniverseVisualization";
import "./repository-universe.css";

type RepositoryUniverseScreenProps = {
  onBack: () => void;
};

type DataState = "loading" | "ready" | "error";
type DomainFilter = "all" | "security" | "governance" | "cicd" | "quality";

function usePrefersReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setReducedMotion(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  return reducedMotion;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function matchesDomain(repository: UniverseRepository, filter: DomainFilter): boolean {
  if (filter === "all") {
    return true;
  }
  if (filter === "security") {
    return repository.securityScore < 88 || repository.securityAlerts > 0;
  }
  if (filter === "governance") {
    return repository.governanceScore < 88;
  }
  if (filter === "cicd") {
    return repository.cicdScore < 88;
  }
  return repository.qualityScore < 88;
}

export function RepositoryUniverseScreen({ onBack }: RepositoryUniverseScreenProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [dataState, setDataState] = useState<DataState>("loading");
  const [statusFilter, setStatusFilter] = useState<"all" | HealthStatus>("all");
  const [domainFilter, setDomainFilter] = useState<DomainFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRepositoryId, setSelectedRepositoryId] = useState<string | null>("frontend-web");
  const [hoveredRepositoryId, setHoveredRepositoryId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (dataState !== "loading") {
      return;
    }
    const delay = reducedMotion ? 260 : 1050;
    const timer = window.setTimeout(() => {
      setDataState("ready");
    }, delay);
    return () => {
      window.clearTimeout(timer);
    };
  }, [dataState, reducedMotion]);

  const filteredRepositories = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    return universeRepositories.filter((repository) => {
      if (statusFilter !== "all" && repository.status !== statusFilter) {
        return false;
      }
      if (!matchesDomain(repository, domainFilter)) {
        return false;
      }
      if (normalizedSearch.length > 0 && !repository.name.toLowerCase().includes(normalizedSearch)) {
        return false;
      }
      return true;
    });
  }, [statusFilter, domainFilter, searchQuery]);

  const visibleRepositoryIds = useMemo(() => {
    return new Set(filteredRepositories.map((repository) => repository.id));
  }, [filteredRepositories]);

  const selectedRepository = useMemo(() => {
    if (!selectedRepositoryId) {
      return null;
    }
    return universeRepositories.find((repository) => repository.id === selectedRepositoryId) ?? null;
  }, [selectedRepositoryId]);

  const hasNoResults = dataState === "ready" && filteredRepositories.length === 0;

  const shellClass = `ru-shell ${dataState === "ready" ? "ru-shell--ready" : ""}`;

  return (
    <div className={shellClass}>
      <header className="ru-header ru-stage ru-stage-shell">
        <div className="ru-header-title">
          <Button variant="tertiary" size="sm" onClick={onBack}>
            Back To Command Center
          </Button>
          <Heading as="h1" size="display">
            Repository Universe
          </Heading>
          <Text tone="secondary">Explore engineering health across repositories, services, and platform dependencies.</Text>
        </div>

        <div className="ru-header-actions">
          <Badge tone="neutral">{universeOrganization.repositories} repositories</Badge>
          <Button variant="tertiary" size="sm" selected={dataState === "loading"} onClick={() => setDataState("loading")}>
            Loading
          </Button>
          <Button variant="tertiary" size="sm" selected={dataState === "ready"} onClick={() => setDataState("ready")}>
            Live
          </Button>
          <Button variant="tertiary" size="sm" selected={dataState === "error"} onClick={() => setDataState("error")}>
            Error
          </Button>
        </div>
      </header>

      <Panel tone="subtle" className="ru-filter-bar ru-stage ru-stage-nav">
        <div className="ru-filter-group" role="group" aria-label="Status filters">
          {universeFilters.map((filter) => (
            <Button
              key={filter.id}
              size="sm"
              variant={statusFilter === filter.id ? "primary" : "tertiary"}
              selected={statusFilter === filter.id}
              onClick={() => {
                setStatusFilter(filter.id);
              }}
            >
              {filter.label}
            </Button>
          ))}
        </div>

        <div className="ru-filter-group" role="group" aria-label="Domain filters">
          {universeDomainFilters.map((filter) => (
            <Button
              key={filter.id}
              size="sm"
              variant={domainFilter === filter.id ? "secondary" : "tertiary"}
              selected={domainFilter === filter.id}
              onClick={() => {
                setDomainFilter(filter.id);
              }}
            >
              {filter.label}
            </Button>
          ))}
        </div>

        <label className="ru-search" htmlFor="repository-search">
          <span className="ru-search-label">Search repositories</span>
          <input
            id="repository-search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by repository name"
            aria-label="Search repositories"
          />
        </label>
      </Panel>

      {dataState === "loading" ? (
        <section className="ru-state-shell" aria-label="Loading state">
          <Panel tone="elevated" className="ru-loading-panel">
            <Heading as="h2" size="lg">
              Building Repository Universe
            </Heading>
            <Text tone="secondary">Scanning repository graph, mapping health signals, and preparing relationship topology.</Text>
            <div className="ru-loading-orbit" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </Panel>
        </section>
      ) : null}

      {dataState === "error" ? (
        <section className="ru-state-shell" aria-label="Error state">
          <Panel tone="elevated" className="ru-error-panel">
            <Heading as="h2" size="lg">
              Universe Visualization Unavailable
            </Heading>
            <Text tone="secondary">Repository topology service failed to respond. Retry to restore live engineering signals.</Text>
            <div className="ru-error-actions">
              <Button variant="primary" onClick={() => setDataState("loading")}>
                Retry Universe
              </Button>
              <Button variant="secondary" onClick={onBack}>
                Return To Command Center
              </Button>
            </div>
          </Panel>
        </section>
      ) : null}

      {dataState === "ready" ? (
        <section className="ru-layout ru-stage ru-stage-layout" aria-label="Repository Universe full experience">
          <div className="ru-layout-main">
            {hasNoResults ? (
              <Panel tone="elevated" className="ru-empty-panel">
                <Heading as="h2" size="lg">
                  No Repositories Match Current Filters
                </Heading>
                <Text tone="secondary">Adjust search or filter criteria to restore repository nodes in the universe map.</Text>
                <div className="ru-empty-actions">
                  <Button
                    variant="primary"
                    onClick={() => {
                      setStatusFilter("all");
                      setDomainFilter("all");
                      setSearchQuery("");
                    }}
                  >
                    Reset Filters
                  </Button>
                </div>
              </Panel>
            ) : (
              <UniverseVisualization
                organizationName={universeOrganization.name}
                organizationScore={universeOrganization.score}
                repositories={universeRepositories}
                connections={universeConnections}
                visibleRepositoryIds={visibleRepositoryIds}
                hoveredRepositoryId={hoveredRepositoryId}
                selectedRepositoryId={selectedRepositoryId}
                searchQuery={searchQuery}
                zoom={zoom}
                pan={pan}
                reducedMotion={reducedMotion}
                onHoverRepository={setHoveredRepositoryId}
                onSelectRepository={setSelectedRepositoryId}
                onZoomIn={() => setZoom((value) => clamp(Number((value + 0.1).toFixed(2)), 0.7, 1.55))}
                onZoomOut={() => setZoom((value) => clamp(Number((value - 0.1).toFixed(2)), 0.7, 1.55))}
                onResetView={() => {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
                onPanChange={(point) => {
                  setPan({ x: clamp(point.x, -280, 280), y: clamp(point.y, -210, 210) });
                }}
              />
            )}
          </div>

          <aside className="ru-layout-side ru-stage ru-stage-side">
            <RepositoryDetailsPanel repository={selectedRepository} onClose={() => setSelectedRepositoryId(null)} />
            <UniverseInsightsPanel
              insights={universeTopInsights}
              activity={universeRecentActivity}
              repositories={filteredRepositories.length > 0 ? filteredRepositories : universeRepositories}
            />
          </aside>
        </section>
      ) : null}
    </div>
  );
}
