# Issue #25 CI/CD Security and Release Gates

This document describes the CI/CD security and release gates added for Issue #25.

## Workflow Coverage

Primary CI workflow: .github/workflows/ci.yml

Jobs:
- API Checks: runs API unit tests, typecheck, and build.
- Web Checks: runs web unit tests, typecheck, and build.
- Dependency Security Audit: runs pnpm audit with enforced severity policy.
- Runtime Smoke Validation: starts the built API and validates /health and /ready endpoints.
- Secret Pattern Check: scans tracked files for high-risk credential/key patterns.
- Repository Hygiene: validates whitespace/conflict markers and generated artifact hygiene.

Code scanning workflow: .github/workflows/codeql.yml
- Language: javascript-typescript
- Triggers: pull_request to main, push to main, workflow_dispatch
- Purpose: semantic static analysis with CodeQL SARIF reporting.

## Dependency Audit Policy

Dependency Security Audit job executes:
- pnpm audit --audit-level high

Policy:
- Fails CI on high or critical vulnerabilities reported by pnpm audit.
- Moderate/low findings are visible in audit output but do not fail this gate.

## Secret Scanning

Workflow-enforced validation:
- Secret Pattern Check scans tracked files for high-risk patterns:
  - private key headers
  - GitHub PAT formats
  - AWS access key format

Important limitation:
- This is a lightweight pattern gate and not a full replacement for GitHub Secret Scanning.

Expected repository-level configuration:
- Enable GitHub Advanced Security secret scanning for the repository.
- Enable push protection for secret scanning (if available for the plan/org).
- Keep default and partner patterns enabled.

## Lint Status

No lint script/config currently exists in this repository.
- This issue intentionally does not add ESLint or any new lint framework.
- CI does not claim lint coverage.

## Smoke Validation

Runtime Smoke Validation provides additional release confidence beyond build/test/typecheck:
- Compiles API
- Boots API process with required runtime security env values
- Confirms liveness endpoint response status: ok
- Confirms readiness endpoint response status: ready

## In-Memory/Process Notes

No production runtime behavior was changed for application scoring/signals/auth adapter logic in this issue.
CI-only gates were added.
