# GitHealth — GitHub Organization Intelligence & Governance Platform

## 1. Project Purpose

GitHealth is a premium developer-focused platform that analyzes GitHub organizations and repositories and provides:

* Organization health scores
* Repository health
* Security insights
* Governance insights
* CI/CD insights
* Actionable recommendations
* AI-powered intelligence
* Automated governance through GitHub Actions

This is an independent open-source project.

Do not use or request company/client proprietary code, data, credentials, internal APIs, internal architecture, or confidential information.

---

## 2. Primary Goal

Build a production-quality application that demonstrates how GitHub Copilot can be used throughout the complete software development lifecycle.

The project must demonstrate:

Requirements → Planning → Design → Development → Testing → Code Review → Security → CI/CD → Release → Maintenance.

Do not treat Copilot only as a code generator.

---

## 3. Technology Direction

Frontend:

* React
* TypeScript
* Vite
* Tailwind CSS
* Accessible component architecture
* Modern animation and interaction patterns

Backend:

* Node.js
* Express
* TypeScript
* GitHub API
* Octokit

Testing:

* Unit tests
* Integration tests
* End-to-end tests where appropriate

DevOps:

* GitHub Actions
* CodeQL
* Dependabot
* Automated quality checks

AI:

* Add AI capabilities only after the core application is stable and deterministic.

---

## 4. Architecture Principles

Use a clean monorepo architecture:

* apps/web → frontend application
* apps/api → backend API
* packages/ui → shared design system
* docs → product and technical documentation
* .github → Copilot instructions, prompts and workflows

Keep responsibilities separated.

Do not place business logic inside UI components.

Prefer reusable services, utilities and components.

Avoid unnecessary abstractions.

Do not introduce libraries unless they provide clear value.

---

## 5. UI QUALITY BAR

GitHealth must NOT look like a generic admin dashboard.

Avoid automatically generating:

* Generic sidebar + cards + table layouts
* Repetitive card grids
* Default-looking dashboards
* Excessive rounded containers
* Random gradients
* Unnecessary glassmorphism
* Decorative animations without purpose
* Visually noisy interfaces

The product should feel:

* Premium
* Futuristic
* Intelligent
* Interactive
* Technical
* Enterprise-grade
* Game-like without becoming childish

The experience should create a strong first impression while remaining usable and professional.

The design should feel original and distinctive rather than copying an existing product.

---

## 6. UI/UX PRINCIPLES

Prioritize:

* Strong visual hierarchy
* Excellent typography
* Intentional spacing
* Clear information architecture
* Meaningful data visualization
* Responsive layouts
* Accessibility
* Fast interactions
* Clear feedback
* Consistent design tokens
* Elegant empty states
* Useful loading states
* Helpful error states

Every visual element must have a purpose.

Do not add UI elements simply to fill empty space.

Before creating a new component:

1. Inspect existing components.
2. Reuse existing components when appropriate.
3. Reuse existing design tokens.
4. Follow the established visual language.
5. Avoid changing unrelated screens.

---

## 7. MOTION & INTERACTION

Motion is an important part of the GitHealth experience.

Use:

* Smooth transitions
* Micro-interactions
* Meaningful hover states
* Count-up animations
* Progress animations
* Interactive charts
* Contextual feedback
* Subtle ambient motion
* Command palette interactions
* Meaningful success states

Animations must improve:

* Feedback
* Understanding
* Navigation
* Perceived responsiveness

Do not animate everything.

Avoid excessive motion that hurts usability or performance.

Respect reduced-motion accessibility preferences.

---

## 8. GAME-LIKE EXPERIENCE

GitHealth may use carefully designed gamification concepts such as:

* Health score
* Progress
* Levels
* XP-style improvement indicators
* Achievements
* Organization milestones

Gamification must always represent meaningful GitHub metrics or improvements.

Never create fake metrics just to make the application look like a game.

The experience should feel like:

"an intelligent developer command center"

rather than:

"a children's game."

---

## 9. COPILOT WORKFLOW

Before implementing a significant feature:

1. Understand the requirement.
2. Inspect the existing code.
3. Identify affected files.
4. Propose an implementation plan.
5. Wait for approval when the task is ambiguous or large.
6. Implement only the approved scope.
7. Add or update tests.
8. Review the implementation.
9. Check security and accessibility.
10. Verify the build.

Do not immediately generate large amounts of code.

---

## 10. TOKEN-EFFICIENT BEHAVIOR

Keep Copilot responses and changes focused.

Rules:

* Do not analyze the entire repository unless required.
* Do not repeatedly explain existing architecture.
* Use repository instructions as the source of truth.
* Inspect only relevant files for the current task.
* Do not modify unrelated files.
* Do not rewrite working code without a reason.
* Prefer small incremental changes.
* Avoid unnecessary refactoring.
* Avoid generating duplicate code.
* Reuse existing utilities and components.
* For large tasks, work in small approved steps.

When asked to plan, do not implement.

When asked to review, do not modify code unless explicitly requested.

When asked to implement, modify only files required for the task.

---

## 11. CODE QUALITY

Write production-quality code.

Prefer:

* Clear naming
* Small focused functions
* Strong TypeScript types
* Explicit error handling
* Reusable components
* Maintainable architecture
* Minimal duplication

Avoid:

* `any` unless genuinely necessary
* Large monolithic components
* Hardcoded configuration
* Dead code
* Duplicate utilities
* Magic numbers
* Unnecessary comments

Comments should explain WHY, not obvious WHAT.

---

## 12. SECURITY

Never expose:

* GitHub tokens
* API keys
* Secrets
* Environment credentials
* Webhooks
* Private organization data

Never hardcode secrets.

Use environment variables for sensitive configuration.

Request the minimum GitHub permissions required.

Validate external input.

Handle GitHub API errors and rate limits safely.

Do not log sensitive values.

---

## 13. GITHUB API

Use GitHub API through a dedicated service layer.

Do not call GitHub APIs directly from random UI components.

Centralize:

* Authentication
* API clients
* Error handling
* Rate-limit handling
* Data transformation

Do not request excessive GitHub permissions.

Only retrieve data required for the current feature.

---

## 14. TESTING

Every meaningful feature should include appropriate tests.

Test:

* Happy paths
* Error states
* Empty states
* Loading states
* Edge cases
* Validation
* Security-sensitive behavior

Do not create meaningless tests simply to increase coverage.

Tests must validate actual behavior.

---

## 15. ACCESSIBILITY

All UI must consider accessibility.

Use:

* Semantic HTML
* Accessible labels
* Keyboard navigation
* Visible focus states
* Appropriate contrast
* Screen-reader-friendly interactions
* Reduced-motion support

Do not rely only on color to communicate status.

---

## 16. PERFORMANCE

Avoid unnecessary:

* Re-renders
* API calls
* Large dependencies
* Client-side computation
* Animation workloads

Use lazy loading where appropriate.

Do not optimize prematurely.

Measure before making complex performance changes.

---

## 17. ERROR, LOADING AND EMPTY STATES

Every data-driven feature should consider:

Loading:
Show a polished skeleton or meaningful progress state.

Error:
Explain what happened and what the user can do.

Empty:
Explain why there is no data and provide a useful next action.

Success:
Provide clear feedback without unnecessary interruption.

---

## 18. RESPONSIVE DESIGN

The application must work well across:

* Desktop
* Laptop
* Tablet
* Mobile

Do not design desktop first and ignore smaller screens.

Responsive behavior must be intentional.

---

## 19. PRODUCT EXPERIENCE

Important interactions should feel rewarding.

Examples:

* Organization scan
* Health score calculation
* Security improvement
* Repository filtering
* Insight discovery
* Report generation

Use motion and feedback to make these interactions feel polished.

Do not sacrifice usability for visual effects.

---

## 20. GITHUB COPILOT SDLC

Use GitHub Copilot throughout the lifecycle:

Requirements:
Help clarify requirements and acceptance criteria.

Planning:
Analyze issues and propose implementation plans.

Development:
Implement approved tasks incrementally.

Testing:
Generate and improve meaningful tests.

Review:
Identify bugs, security issues, accessibility problems and maintainability concerns.

Documentation:
Help maintain README and technical documentation.

CI/CD:
Help create and maintain GitHub Actions workflows.

Security:
Assist with security reviews and remediation.

Release:
Assist with release notes and release preparation.

Do not bypass human review.

---

## 21. GIT WORKFLOW

Use focused branches.

Examples:

* feature/organization-health
* feature/repository-security
* feature/health-scoring
* fix/github-api-error
* chore/update-dependencies

Keep commits focused and meaningful.

Do not mix unrelated changes.

---

## 22. DOCUMENTATION

Keep important technical decisions documented.

Documentation should explain:

* What the feature does
* Why it exists
* Architecture decisions
* API behavior
* Configuration
* Development workflow

Do not create unnecessary documentation files.

---

## 23. CHANGE MANAGEMENT

Before changing an established architecture, explain:

* Why the change is needed
* What files are affected
* What risks exist
* What alternatives were considered

Avoid large architectural changes for small features.

---

## 24. IMPORTANT DEFAULT BEHAVIOR

When requirements are ambiguous:

Do not guess silently.

First inspect the existing implementation and explain the assumption.

When multiple implementation approaches exist:

Prefer the simplest maintainable approach that fits the existing architecture.

When a requested change could negatively affect existing functionality:

Call it out before implementing.

Always preserve existing functionality unless the requirement explicitly changes it.

---

## 25. FINAL QUALITY STANDARD

Every feature should answer YES to these questions:

* Does it solve the actual user problem?
* Does it fit the GitHealth design language?
* Does it feel polished?
* Is the interaction intuitive?
* Is it accessible?
* Is it responsive?
* Is it secure?
* Is it tested?
* Is it maintainable?
* Does it avoid unnecessary complexity?
* Does it avoid modifying unrelated code?

GitHealth should feel like a product that could realistically be used by professional engineering teams.
