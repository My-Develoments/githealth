# GitHealth

GitHealth is a monorepo for GitHub organization intelligence and governance insights. It provides a backend API for health scoring and a frontend command-center experience for visualizing repository health signals.

## Project Overview

GitHealth helps engineering teams evaluate organization and repository health across security, governance, CI/CD, and quality dimensions using deterministic scoring and clear API contracts.

## Key Capabilities

- Organization and repository health scoring APIs
- GitHub-backed health scoring routes and mock scoring routes
- Command-center style web UI
- Shared UI package for reusable components and design tokens
- CI/CD security gates (dependency audit, CodeQL, smoke validation, repository hygiene)

## Monorepo Architecture

- [apps/web](apps/web): React + Vite frontend
- [apps/api](apps/api): Node.js + Express + TypeScript API
- [packages/ui](packages/ui): shared UI components and styles

Workspace packages are declared in [pnpm-workspace.yaml](pnpm-workspace.yaml).

## Prerequisites

- Node.js 22.x
- pnpm 9.15.0

The workspace declares `pnpm@9.15.0` in [package.json](package.json).

## Local Setup

1. Install dependencies:

```bash
pnpm install
```

2. Optional full workspace checks:

```bash
pnpm typecheck
pnpm build
```

## Commands

### Workspace (root)

- Build all packages:

```bash
pnpm build
```

- Typecheck all packages:

```bash
pnpm typecheck
```

### API (`@githealth/api`)

- Test:

```bash
pnpm --filter @githealth/api test
```

- Typecheck:

```bash
pnpm --filter @githealth/api typecheck
```

- Build:

```bash
pnpm --filter @githealth/api build
```

- Start (compiled output):

```bash
pnpm --filter @githealth/api start
```

### Web (`@githealth/web`)

- Dev server:

```bash
pnpm --filter @githealth/web dev
```

- Test:

```bash
pnpm --filter @githealth/web test
```

- Typecheck:

```bash
pnpm --filter @githealth/web typecheck
```

- Build:

```bash
pnpm --filter @githealth/web build
```

- Preview built app:

```bash
pnpm --filter @githealth/web preview
```

### UI (`@githealth/ui`)

- Typecheck:

```bash
pnpm --filter @githealth/ui typecheck
```

- Build:

```bash
pnpm --filter @githealth/ui build
```

## Environment Configuration

The API uses the following environment variables:

### Core server

- `PORT` (defaults to `4000`)
- `DATABASE_URL`
- `DATABASE_SSL_MODE` (`disable` by default, `require` for managed TLS-enforced Postgres)

Recommended for Neon and other managed PostgreSQL providers:

```env
DATABASE_URL=
DATABASE_SSL_MODE=require
```

When `DATABASE_SSL_MODE=require` is set, the API connects with TLS and certificate verification enabled.

### GitHub integration settings

- `GITHUB_TOKEN`
- `GITHUB_API_BASE_URL` (defaults to `https://api.github.com`)
- `GITHUB_REQUEST_TIMEOUT_MS` (defaults to `8000`)
- `GITHUB_MAX_RETRIES` (defaults to `2`)
- `GITHUB_RETRY_BASE_DELAY_MS` (defaults to `100`)
- `GITHUB_MAX_PAGINATION_PAGES` (defaults to `3`)
- `GITHUB_REPOSITORY_CONCURRENCY` (defaults to `4`)
- `GITHUB_SIGNAL_CONCURRENCY` (defaults to `2`)

### GitHub endpoint protection settings

- `API_AUTH_TOKEN`
- `ALLOWED_GITHUB_ORGS`
- `INTERNAL_API_BEARER_BYPASS_ENABLED` (defaults to `true` in tests and `false` otherwise)
- `GITHUB_ENDPOINT_RATE_LIMIT_WINDOW_MS` (defaults to `60000`)
- `GITHUB_ENDPOINT_RATE_LIMIT_MAX_REQUESTS` (defaults to `60`)

Do not commit real secrets or credentials.

## API Health and Readiness Endpoints

From [opsRoutes.ts](apps/api/src/http/opsRoutes.ts):

- `GET /health`

Response:

```json
{ "status": "ok" }
```

- `GET /ready`

Response shape:

```json
{
  "status": "ready",
  "service": "<service-name>",
  "version": "<service-version>",
  "environment": "<environment>",
  "checks": {
    "configuration": "ok"
  }
}
```

## CI/CD and Security

- Main CI workflow: [.github/workflows/ci.yml](.github/workflows/ci.yml)
- CodeQL workflow: [.github/workflows/codeql.yml](.github/workflows/codeql.yml)
- Security gate details: [docs/security-ci-gates.md](docs/security-ci-gates.md)

## Contribution and Development Workflow

1. Create a branch for your work.
2. Install dependencies with `pnpm install`.
3. Run relevant checks locally:
   - API: test, typecheck, build
   - Web: test, typecheck, build
   - UI: typecheck, build
4. Run root checks when touching multiple packages:
   - `pnpm typecheck`
   - `pnpm build`
5. Open a pull request to `main` and ensure GitHub Actions checks pass.
