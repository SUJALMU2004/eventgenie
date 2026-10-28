# Targeted evaluation remediation

Measured locally on 28 October 2026 against commit `d544e0127acaa9e59c724a0535458d9c78fb3ef5`, with Node 24.13.1 and npm 11.19.0. No dependencies or product features were added. The evaluator's reported scores were Code Quality 88, Security 99, Accessibility 98, and 100 for Efficiency, Testing and Problem Statement Alignment. Exact deduction causes were not supplied. The changes address verified findings; only evaluator reassessment can establish a new score.

## Before and after

| Measurement                                              | Baseline                                    | Remediation                                                            |
| -------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------- |
| Stronger proposed lint rules                             | 22 diagnostics in the initial audit         | Zero diagnostics; type-aware rules enforced in CI                      |
| Source function complexity                               | Several functions over 15                   | Enforced maximum 15, no suppressions                                   |
| Type checks                                              | Existing strict checks                      | Also unused locals/parameters, implicit returns and switch fallthrough |
| Automated unit/API/storage/component tests               | 535 / 33 files                              | 562 / 37 files; all original tests retained                            |
| Production Chromium cases                                | 29                                          | 33, including original journeys                                        |
| Statements                                               | 98.32% (1464/1489)                          | 98.92% (1570/1587)                                                     |
| Branches                                                 | 96.58% (1189/1231)                          | 96.81% (1155/1193)                                                     |
| Functions                                                | 96.47% (383/397)                            | 98.20% (437/445)                                                       |
| Lines                                                    | 98.63% (1377/1396)                          | 99.12% (1469/1482)                                                     |
| Initial `/plan` JavaScript, sum of per-script gzip bytes | 246,681 / 12 scripts                        | 247,208 / 12 scripts (+0.21%)                                          |
| JavaScript acceptance ceiling                            | Baseline +5%                                | 259,015 bytes; passed                                                  |
| Static routes                                            | `/`, `/_not-found`, `/plans`, `/privacy`    | Unchanged                                                              |
| Dynamic routes                                           | `/plan`, `/plans/[id]`, three API endpoints | Unchanged                                                              |
| IndexedDB version                                        | 3                                           | 3; no migration/reset                                                  |

Coverage includes every `src/lib/**/*.ts`, budget TypeScript module and shared schema, excluding test files only. All four 80% thresholds remain unchanged. Refactoring changes the number of instrumented functions and branches; percentages are compared across the same module inclusion policy. The JavaScript browser case reads production HTML, downloads each unique initial script and sums Node gzip output. It excludes scripts loaded later through existing dynamic imports. It is a reproducible local/CI size comparison, not a real-user network latency benchmark.

## Evaluation matrix

| Criterion         | Implemented evidence                                                                                                                                                                                                                       | Verification                                                                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code quality      | Focused storage infrastructure/record/command/facade modules; focused AI context/input/output/prompt/sample/identity modules; request/cache/acceptance hook separate from rendering; contingency rule handlers and presentation components | Stronger lint and type checks pass; [architecture](architecture.md) documents responsibility and trust boundaries                                                           |
| Security          | CSP adds `script-src-attr 'none'`, `frame-src 'none'`, `base-uri 'none'`; HTTPS-only one-year HSTS; server-only credentials and bounded validated endpoints retained                                                                       | Header unit tests plus real Chromium CSP violation checks; HTTP/forwarded-HTTPS response assertions; source/index/history/bundle scans; npm audit reports 0 vulnerabilities |
| Accessibility     | Controlled known costs with visible associated errors and focus; equivalent task/schedule fields; described native confirmations retain failures, clear stale errors and announce saves                                                    | Component tests plus keyboard/focus/browser/axe regressions, including failure states; primary pages and responsive journeys retain existing axe checks                     |
| Efficiency        | Static pages/lazy imports retained; shared async transport and bounded retry/cancellation; cache versions preserved; deterministic arithmetic and graph traversal                                                                          | Progressive stream/cache/cancellation regressions, 0.21% initial JavaScript growth, repository size gate below 9 MB                                                         |
| Testing           | All 535 original tests and 29 browser cases retained; 27 unit/component/integration tests and 4 browser cases added                                                                                                                        | 562 automated tests and 33 Chromium cases pass; coverage improved in all four dimensions without changing inclusions/thresholds                                             |
| Problem alignment | Wedding/birthday/community-specific budgets, readiness, vendors, contingency tasks, schedule, invitation and reviewed AI workflows retained                                                                                                | Existing event journeys and application-controlled mutation/financial tests pass                                                                                            |

## Targeted regression evidence

- `src/features/decisions/validation.test.tsx`: invalid blank/zero/negative/text/precision costs, selected controlled category, JPY precision, field descriptions/focus for tasks and schedules, and actual schedule save results.
- `src/components/ui/confirmation.test.tsx`: false/rejected actions remain open, true actions close, new values clear stale errors, descriptions and pending announcements, Escape protection during commits.
- `src/lib/validation.test.ts`: domain and nested Zod field paths, duplicate-message selection and non-field recovery.
- `src/lib/remediation.test.ts`: incomplete/minimized AI context, unavailable budget categories, shared downstream dependencies, original-row schedule errors, blocked database upgrades/version changes and metadata-only notifications.
- `src/test/security-headers.test.ts` and `tests/e2e/release.spec.ts`: production header configuration, browser-enforced attribute/frame/base restrictions, HTTPS header scope and initial script budget.
- Existing schedule-conflict browser case now asserts that the invalid field is focused before a confirmation opens. Its original dependency/error/recovery coverage remains.

## Commands and results

| Command/check                                       | Measured result                                                                                          |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `npm run format:check`                              | Pass; all matched files use Prettier style                                                               |
| `npm run lint`                                      | Pass, zero warnings/errors under strengthened rules                                                      |
| `npm run typecheck`                                 | Pass                                                                                                     |
| `npm run test:coverage`                             | Pass, 562 tests / 37 files; coverage above                                                               |
| `npm run build` with server key forced empty        | Pass; 9/9 generated pages and unchanged classifications                                                  |
| `npm run test:e2e`                                  | Pass, 33/33 production Chromium cases (1.7 minutes in the first complete run)                            |
| Browser axe scans                                   | No violations in the exercised states and configured WCAG 2/2.1/2.2 A/AA rules                           |
| `npm run audit`                                     | Pass, 0 vulnerabilities reported by npm's advisory service                                               |
| `npm run security:check`, `npm run security:bundle` | Pass; source/index/history and generated-client checks, including exact configured-key comparison        |
| `npm run size:check`                                | Pass; less than 1.3 MB of source, below the 9,000,000-byte release gate and strict 10 MB evaluator limit |

GitHub Actions runs formatting, lint, types, security scans, coverage, key-free production build, browser tests, dependency audit and size checks on `main`. Publication is complete only after the pushed revision's full workflow succeeds; the Actions badge and run linked from the handoff provide that external evidence.

## Preserved contracts and limits

The three API endpoint paths and payloads, stream versions 1/2/3, cache namespaces, `PlanRepository` exports, database version 3 and owned record/history formats are unchanged. Existing dates, identifiers and completion states are preserved. Financial values and approved writes remain application-controlled; preview streams are never persisted as completed plans. No new runtime dependency, account, service, deployment workflow or Vercel account change was introduced.

The static-rendering choice retains inline bootstrap script permission. Blocking event-handler attributes does not block every possible inline script; see [MDN's directive scope](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src-attr). HSTS is deliberately scoped to the current HTTPS host without [subdomain or preload commitments](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Strict-Transport-Security). The local proxy-header test does not verify a deployed TLS terminator or browser HSTS persistence over real HTTPS.

Screen-reader output with NVDA/JAWS/VoiceOver was unavailable for this run. Browser accessibility-tree assertions, keyboard focus tests and axe provide scoped evidence, not full accessibility certification. Live Gemini calls were not repeated because the provider/model contract is unchanged; the prior Phase 4 smoke remains historical evidence. No deployment, Vercel linking, WAF changes or external evaluator rerun was performed.
