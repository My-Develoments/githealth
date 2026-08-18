# GitHealth UI Specification

## 1. Purpose and product intent

GitHealth is a premium developer-focused intelligence platform for GitHub organizations and repositories. The frontend is the product differentiator, not a generic admin dashboard. The visual language must feel like an intelligent developer command center: sharp, high-contrast, operational, predictive, and technically premium.

The approved reference image at docs/design/reference/githealth-command-center.png is the visual source of truth. The implementation must preserve the approved direction and avoid drifting into a default SaaS dashboard style.

## 2. Product experience goals

- Deliver an intelligent, premium command-center feel for engineering leadership and engineering teams.
- Make the Organization Health Score the primary hero interaction.
- Preserve the interactive Repository Universe as a core MVP experience.
- Treat the Organization Scan as a meaningful, guided workflow.
- Present security, governance, CI/CD, and quality data as operational intelligence, not as generic widgets.
- Use subtle gamification only when it reflects real measurable engineering improvement.
- Keep motion purposeful and performance-conscious.
- Stay original and not resemble a generic SaaS/admin template.

## 3. Core design principles

- Premium, futuristic, technical, enterprise-grade.
- Original and distinctive; do not copy GitHub, Linear, Vercel, or other products.
- Strong information hierarchy and clear mission-critical signals.
- Data-first, but polished and emotionally engaging.
- Interactive and responsive, with purposeful motion.
- Accessibility and performance are product requirements, not secondary tasks.
- Gamification must represent real engineering improvements, not fake metrics.
- AI features remain deferred; the UI must support the deterministic product core first.

## 4. Visual identity

The interface should feel like an operational control room for developer health and engineering quality. It must be dark, premium, and signal-rich. The base impression is engineered and intelligent rather than decorative.

### 4.1 Core aesthetic characteristics

- Dark atmosphere with high contrast
- Strong spatial hierarchy
- Luminous accent colors only where they communicate data or focus
- Sharp layout rhythm without filler content
- Clear emphasis on health score, scan workflow, repository visualization, and command interactions
- High-signal layout balanced with premium polish

### 4.2 Desired product mood

The visual language should communicate:
- signal
- clarity
- confidence
- operational intelligence
- engineering trust

### 4.3 Visual constraints

- Must not become a generic admin dashboard
- Must not rely on repetitive card grids as the primary layout language
- Must not use excessive rounded containers or decorative glassmorphism
- Must not use random gradients or purely decorative motion
- Must not feel childish or game-like in tone
- Must not copy another product’s layout or visual language

## 5. Design tokens

### 5.1 Color palette

Backgrounds
- Night base: #050B17
- Panel base: #0B1220
- Panel elevated: #101A2B
- Surface subtle: #111D2E
- Surface stronger: #132235

Text
- Primary: #EAF3FF
- Muted: #9AA8BB
- Secondary muted: #7E8EA6
- Inverse: #020812

Accent palette
- Cyan: #4DD7FF
- Blue: #3A7BFF
- Violet: #8B5CF6
- Magenta: #C855F7
- Green: #34D399
- Amber: #FBBF24
- Red: #F87171
- White: #EAF3FF

Status semantics
- Healthy: green
- Warning: amber
- Critical: red
- Neutral: cyan/blue
- Unknown: gray

Use accents sparingly and meaningfully. Accent colors are for attention, analytics, and flow, not decoration.

### 5.2 Spacing scale

- 4, 8, 12, 16, 20, 24, 32, 40, 48, 64

Use spacing in a consistent rhythm. Tight groupings for related content; broader separation between major product areas.

### 5.3 Radius scale

- 8, 12, 16, 20, 24

Use radius to suggest premium surfaces and data containers without excessive rounding.

### 5.4 Border and opacity

- Border width: 1px to 1.5px
- Border opacity: low-contrast and subtle
- Use selected/focused states with stronger visibility, not opaqueness alone

### 5.5 Elevation and glow

- Use soft ambient glow behind key indicators and high-value metrics
- Keep glows associated with active data, focus, or score rings
- Avoid decorative ambient glow everywhere

## 6. Typography

Type should be modern, highly legible, and technical. The UI should not feel playful or marketing-heavy.

### 6.1 Hierarchy

- Primary headings: bold, high contrast, visually strong
- Section labels: uppercase or compact, spaced and secondary
- Metric numbers: large and high-visibility
- Body text: readable, neutral, compact
- Supporting metadata: muted and concise

### 6.2 Behavior

- Use strong weight for metric values and status labels
- Keep line lengths readable
- Avoid heavy ornamentation or very condensed display styles for body text
- Keep labels compact and information-dense when appropriate

## 7. Layout and grid

- Use a disciplined grid system for layout and rhythm
- Keep the app shell stable and structured
- Reserve generous whitespace around primary sections but avoid empty filler
- Use alignment to support scanning and operational clarity
- Maintain consistent margins and gutters across screen sizes

### 7.1 Layout pattern

Primary layout pattern:
- Persistent navigation shell
- High-priority content in the main panel
- Secondary modules grouped around the hero and intelligence areas
- Visual flow should move from organization health to insight to action

### 7.2 Composition rules

- Do not turn the view into an ordinary dashboard full of stacked cards
- Preserve the concept of a command center with a strong focal point
- Keep the hero score visually dominant
- Let secondary modules support the story rather than compete with it

## 8. Navigation

Navigation should feel like a developer control surface.

### 8.1 Structure

- Left or vertical rail for core sections
- Header for context, action triggers, and quick commands
- Main content area dedicated to live intelligence

### 8.2 Core section grouping

- Command Center
- Repository Universe
- Security
- Governance
- CI/CD
- Health Intelligence
- Settings or administration

### 8.3 Navigation rules

- Persistent and easy to scan
- Active section visibly emphasized
- Minimal chrome and maximum data visibility
- Avoid generic dashboard nav patterns that feel templated

## 9. Organization Health Score

This is the principal hero interaction and must be the dominant visual element.

### 9.1 Purpose

- Deliver the overall status of the GitHub organization at a glance
- Communicate trust, quality, and operational health
- Provide immediate narrative context for organizational performance

### 9.2 Visual treatment

- Large circular or radial score display
- Central score value
- Surrounding ring or orbital structure with category contributions
- Strong accenting around the selected score visual

### 9.3 Supporting details

- Score label and status text
- Short explanatory insight below or adjacent
- Trend delta and short performance comparison
- Contribution summary to show what is driving the score

### 9.4 Design requirement

The health score should feel like a flagship moment, not a generic KPI tile.

## 10. Organization Pulse

Organization Pulse provides the live trajectory of health over time.

### 10.1 Purpose

- Show movement in overall health
- Reveal stability or concerning declines
- Support narrative understanding of the organization’s state

### 10.2 Visual patterns

- Trend line or sparkline
- Strong signal path with supportive labels
- Compact but readable data treatment
- Clear time-window context

The pulse should support the health score and never overwhelm it.

## 11. Repository Universe

This is a core MVP experience and must remain a flagship interaction.

### 11.1 Purpose

- Explore the organization as a living system rather than a flat list
- Understand repo health, relationships, and risk clusters
- Provide visual discovery of outliers and problem areas

### 11.2 Visual behavior

- Repositories represented as nodes or orbital elements, connected by relationships or shared signals
- Strong focus treatment on hovered or selected repo
- Health states encoded by color and intensity
- A coherent map of the organization’s structure and risk quality

### 11.3 Interaction model

- Hover for detail
- Select for deeper inspection
- Highlight related repos or service clusters
- Visualize health variance across the org

This must not collapse into a plain table or default card list.

## 12. Organization Scan experience

The scan experience is a premium workflow, not a loading spinner.

### 12.1 Purpose

- Surface organization analysis as a guided product lifecycle
- Communicate progress and completion in a polished way

### 12.2 Flow pattern

- Initiate scan from header or command surface
- Display staged progress with meaningful labels
- Show each category being checked
- Transition to completion summary with overall score and recommendations

### 12.3 Progress states

- scanning repository inventory
- reviewing health signals
- checking security posture
- auditing governance
- evaluating CI/CD quality
- calculating organizational health

### 12.4 Visual rules

- Progress state must be visible and purposeful
- Use measured transitions and contextual feedback
- Keep scan motion tied to real progress, not decorative animation

## 13. Security visualization

Security should be represented as clear operational intelligence.

### 13.1 Data patterns

- risk level
- issue severity distribution
- dependency exposure
- security posture health

### 13.2 Visual approach

- Compact risk rings or segmented indicators
- Severity-based color coding
- Signal-rich summaries and actionable items
- Strong emphasis on the most critical observations

The security section should help engineers understand operational risk without turning into a generic issue list.

## 14. Governance visualization

Governance should show how aligned the organization is with policies and engineering standards.

### 14.1 Visual approach

- status bars or segmented indicators
- compliance coverage or policy adherence scores
- trend toward healthier or riskier processes
- compact explanations of governance gaps

The UI should reinforce the idea of organizational maturity and sustainable engineering norms.

## 15. CI/CD visualization

CI/CD should communicate release confidence and execution health.

### 15.1 Visual approach

- pipeline health summary
- trend or throughput signal
- reliability and failure indicators
- readiness state for release or deployment confidence

The focus should be on operational confidence and product delivery quality, not isolated build logs.

## 16. Quality visualization

Quality should explain code health and engineering reliability.

### 16.1 Visual approach

- quality composition blocks or signal bars
- trend view for health over time
- maintainability and review quality indicators
- severity of quality issues

The quality panel should feel like an engineering intelligence layer, not a generic bug report.

## 17. Health Intelligence

Health Intelligence is the explanation layer around the score and the metrics.

### 17.1 Purpose

- Explain what is driving the organization’s health
- Surface the most relevant opportunities for improvement
- Provide action-oriented recommendations

### 17.2 Display pattern

- concise insight cards or ranked signal blocks
- short statements with impact and urgency
- a small set of high-value recommendations
- summary of what matters most right now

The text should be short, credible, and executive-level enough for engineering leadership.

## 18. Gamification, levels, XP and achievements

Gamification is allowed only when it reflects actual engineering improvements.

### 18.1 Use cases

- health progression tiers
- XP-style gains from real improvements
- achievement badges for real milestones
- organization milestones tied to measurable fixes or maturity improvements

### 18.2 Examples of valid gamification signals

- improved repo health score
- reduced security findings
- higher governance adoption
- improved CI/CD stability
- reduced risk across key repos

### 18.3 Rules

- No fake metrics
- No game-like styling that undermines professional tone
- No childish or cartoonish treatment
- Rewards must map to real engineering data and measurable outcomes

## 19. Command Palette

The command palette is a premium workflow surface.

### 19.1 Behavior

- keyboard-driven quick actions
- rapid context switching
- scoped commands for scans, repo focus, filters, insights, and navigation
- overlay or centered modal within the command-center experience

### 19.2 Design rules

- high clarity
- fast interaction
- visible focus states
- minimal but deliberate motion
- strong text hierarchy

This should feel like a high-end developer workflow control, not a generic search field.

## 20. Buttons and interactive controls

Controls must be consistent, readable, and purposeful.

### 20.1 Button hierarchy

- Primary action: accent color with strong visual weight
- Secondary action: supporting tone with moderate emphasis
- Tertiary action: low emphasis but clearly visible

### 20.2 Rules

- consistent sizing
- distinct hover/focus states
- disabled behavior must be obvious
- hover effects must not be decorative alone
- every control should map to an operational action

## 21. Loading, empty, error and success states

### 21.1 Loading states

- Use elegant skeletons and contextual progress.
- Show meaningful progress for scan or data-fetch workflows.
- Avoid blank areas and sudden layout shifts.

### 21.2 Empty states

- Explain what is missing and why.
- Offer a useful next action or remediation path.
- Keep the tone clear and confident.

### 21.3 Error states

- Communicate the issue plainly.
- Include likely causes and recovery guidance.
- Avoid generic failure messaging.

### 21.4 Success states

- Confirm meaningful completion without overloading the user.
- Use subtle positive feedback that reinforces trust.

## 22. Hover, focus and selected states

### 22.1 Hover

- indicate action and hierarchy
- use accent border, glow, or subtle motion
- never use large decorative effects

### 22.2 Focus

- must be highly visible and accessible
- follow a consistent pattern across interactive components

### 22.3 Selected

- should read clearly as the active item without breaking the rest of the composition

The state model must be consistent globally.

## 23. Motion and animation rules

Motion is important, but only when it supports understanding and responsiveness.

### 23.1 Approved motion purposes

- score transitions
- phase transitions during scan
- repository focus movement
- selection and filtering feedback
- contextual response to user actions

### 23.2 Motion rules

- smooth and brief
- purposeful and readable
- support comprehension and orientation
- respect reduced-motion preferences
- never animate purely for decoration

### 23.3 Disallowed motion

- excessive movement across the interface
- decorative floating or random motion
- heavy glows on every element
- distracting transitions that obscure content

## 24. Responsive behavior

The product must remain premium and operational across devices.

### 24.1 Rules

- preserve the strongest hierarchy across screen sizes
- keep the health score prioritized on larger screens and maintain its importance on smaller screens
- adapt repository universe and command palette without losing clarity
- keep navigation usable and compact
- maintain data readability on tablet and mobile

The system should compress gracefully rather than turning into a generic mobile dashboard.

## 25. Accessibility requirements

Accessibility is not optional.

### 25.1 Required behaviors

- semantic structure and readable hierarchy
- keyboard access for major controls and flows
- visible focus states
- strong contrast ratios
- status not communicated by color alone
- screen-reader-friendly labeling and context
- reduced-motion support
- responsive, readable layouts across devices

## 26. Performance requirements

- Smooth interaction and fast feedback
- Purposeful motion without expensive visual clutter
- Lightweight charts and state transitions
- Minimal unnecessary re-renders or over-rendering
- Performance must remain strong even with dashboard and repo visualization complexity

## 27. UI anti-patterns that must never be introduced

- Generic admin dashboard layout
- repetitive card grids with no clear hierarchy
- default SaaS template patterns
- excessive rounded containers
- random gradient flooding
- decorative glassmorphism without purpose
- noisy motion everywhere
- stock dashboard charts with no product-specific story
- tables used as the main experience when a more insightful visualization is required
- fake metrics or childish gamification
- design that copies or resembles GitHub, Linear, Vercel, or other products too closely
- motion or chrome added for spectacle rather than user understanding

## 28. Frontend source of truth

This specification and the approved visual reference at docs/design/reference/githealth-command-center.png are the frontend UI source of truth.

All future implementation decisions must remain aligned to this document and the visual reference. If a change would contradict the approved visual direction, it must be rejected or revised before implementation.

## 29. Implementation summary

The GitHealth frontend must feel like a premium, futuristic developer command center built for engineering leadership and engineering teams. The Organization Health Score is the hero. The Repository Universe is a core interaction. The Organization Scan is a polished workflow. Motion and UI states are purposeful. Gamification reflects real engineering improvements. The design remains original, premium, and operational. The implementation must align to the approved visual reference and this specification without inventing a different style.
