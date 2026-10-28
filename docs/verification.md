# Verification record

The functional verification baseline was recorded on **28 October 2026**, using Node 24.13.1 and npm 11.19.0 locally. The [complete GitHub Actions run](https://github.com/SUJALMU2004/eventgenie/actions/runs/40667543247) for commit [`10d69d3`](https://github.com/SUJALMU2004/eventgenie/commit/10d69d3) independently passed every quality gate. The [current workflow](https://github.com/SUJALMU2004/eventgenie/actions/workflows/quality.yml) shows checks for subsequent revisions.

## Recorded results

| Gate                                    | Result                                                                                                                                            |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Formatting                              | Prettier passed for all matched files                                                                                                             |
| Lint                                    | Zero diagnostics under type-aware rules; source function complexity at most 15                                                                    |
| Types                                   | Strict TypeScript, unused-code, return, and switch-fallthrough checks passed                                                                      |
| Unit, API, storage, and component tests | **562 passed across 37 files**                                                                                                                    |
| Production browser tests                | **33 Chromium cases passed**, including wedding, birthday, and community journeys                                                                 |
| Production build                        | Passed without a Gemini key; 9/9 pages generated, static route classifications retained                                                           |
| Credential checks                       | Source, staged content, available history indicators, and client-bundle scans passed; local bundles also checked against the exact configured key |
| Dependency audit                        | npm reported **0 vulnerabilities** locally and in the recorded CI run                                                                             |
| Repository size                         | Approximately **1.25 MB** in the recorded release, including lockfile, tests, and documentation; the script reports current content               |
| Initial planner JavaScript              | **247,208 gzip bytes** across 12 initial scripts, **0.21%** above the 246,681-byte comparison baseline; the 5% browser gate passed                |

## Coverage

| Measure    | Recorded coverage      |
| ---------- | ---------------------- |
| Statements | **98.92%** (1570/1587) |
| Branches   | **96.81%** (1155/1193) |
| Functions  | **98.20%** (437/445)   |
| Lines      | **99.12%** (1469/1482) |

Coverage includes `src/lib/**/*.ts`, budget TypeScript modules, and shared schemas, excluding tests only. All four thresholds remain **80%**. Coverage instrumentation counts can change with refactoring; compare measurements with the same inclusion policy.

## Reproduce the checks

```sh
npm ci
npm run format:check
npm run lint
npm run typecheck
npm run test:coverage
npm run build
npx playwright install chromium
npm run test:e2e
npm run security:check
npm run security:bundle
npm run audit
npm run size:check
```

`npm test` runs the unit suite without coverage; `npm run format` applies formatting. Linux CI installs Chromium with `--with-deps`. Browser tests start a dedicated production server on port 3100 with the Gemini key disabled. Coverage, traces, screenshots, and generated reports stay ignored.

The tracked-content release gate fails at 9,000,000 bytes, preserving headroom below the strict 10 MB submission limit. The JavaScript gate downloads unique initial scripts from `/plan` production HTML and sums per-script gzip output. It excludes modules loaded later on demand and does not measure real-user latency.

## What the suite exercises

- Exact budget totals, rounding, priorities, contingency, currency precision, dates, financial commitments, linked payments, scenario feasibility, and event templates.
- Dependency cycles, blocked tasks, readiness, schedule conflicts, original-row validation paths, and approved task/contingency mutations.
- Progressive delivery, malformed/empty/incomplete output, output references, quotas, timeouts, network failures, cancellation, bounded retry, origins, and body limits.
- Atomic saves, stale-tab conflicts, blocked database upgrades, unknown/corrupt records, quota failures, history, deletion, and backup ownership.
- Wizard editing, refresh persistence, cache reuse, sample labels, checklist changes, comparison, invitation workflows, export, and recovery.
- Associated field errors, focus restoration, failed confirmations, pending saves, keyboard navigation, responsive layouts, and reduced motion.
- Browser-enforced CSP attribute/frame/base restrictions, HTTPS-header scope, text-only rendering of hostile output, and credential hygiene.

## Verification scope

Automated axe checks use WCAG 2/2.1/2.2 A/AA rules in the exercised pages and states. Keyboard/focus and narrow-layout checks supplement them. NVDA, JAWS, and VoiceOver output was not verified; automated results do not certify full accessibility compliance.

Browser AI flows mock HTTP responses. Service tests separately mock provider and SDK boundaries. A historical synthetic invitation smoke succeeded against Gemini, but not every live operation or provider behavior has been verified. Structured validation proves contracts and arithmetic, not the factual accuracy of every recommendation.

Real deployed TLS behavior, streaming infrastructure, WAF enforcement, and production load remain separate operational checks. No deployment or hosting-account change is part of repository CI. External evaluation scores require an independent reassessment.
