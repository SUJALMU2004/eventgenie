# Verification record

Verified locally on 26 October 2026 using Windows, Node 24.13.1 and npm 11.19.0. This record separates automated boundary tests from live external-service verification.

| Gate                              | Result                                                                                                                                                                            |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clean install                     | Passed: `npm ci` installed 484 packages from the lockfile and reported zero vulnerabilities.                                                                                      |
| Production build                  | Passed: Next.js 16.4.3 production build, without a Gemini key. Landing, library and privacy pages prerender; wizard, saved-plan pages and generation endpoint render dynamically. |
| TypeScript                        | Passed: `next typegen` and `tsc --noEmit`, strict mode.                                                                                                                           |
| ESLint                            | Passed with zero warnings in application/test/config sources.                                                                                                                     |
| Vitest unit, service and UI tests | **180 passed across 16 files**, including mocked SDK/provider endpoints and error paths.                                                                                          |
| Core coverage                     | **95.45% statements, 94.07% branches, 90.47% functions, 95.60% lines**. All configured 80% gates passed.                                                                          |
| Playwright                        | **10 passed**, running against a production server with the Gemini key disabled.                                                                                                  |
| Automated accessibility           | Zero axe violations under WCAG 2 A/AA, 2.1 AA and 2.2 AA tags on landing, wizard, library, privacy and all three event dashboards.                                                |
| Keyboard/mobile                   | Passed: keyboard-only progression, invalid-field focus, native delete-dialog Escape handling, and no horizontal overflow at 390px.                                                |
| Manual visual review              | Inspected desktop landing/dashboard and full-page mobile wizard screenshots.                                                                                                      |
| Dependency audit                  | `npm audit --audit-level=high`: **0 vulnerabilities** reported.                                                                                                                   |
| Credential/content scan           | Passed across source candidates; no real key configured or committed.                                                                                                             |
| Repository content                | Approximately **0.59 MB**, including the lockfile and tests; release script enforces less than 9,000,000 bytes, below the evaluator's 10,000,000-byte hard limit.                 |

Formatting also passed: `npm run format:check` reported that all matched files use Prettier code style. The exact byte count changes slightly when this evidence document is updated; `npm run size:check` reports current tracked/source bytes.

## Browser scenarios executed

1. Wedding creation, task completion, saved-copy navigation, refresh restore and identical-input reuse with one mocked generation request.
2. The same complete flow for birthdays.
3. The same complete flow for community events.
4. Automated accessibility scans on the landing page, wizard, empty library and privacy page.
5. Invalid-form focus and debounced IndexedDB draft restoration after refresh.
6. Keyboard-only wizard navigation at a 390 × 844 mobile viewport.
7. Platform-style HTML 429, preserved requirements and explicit sample fallback.
8. Community sample creation and selected deletion through a native confirmation dialog.
9. Real production route validation and missing-configuration responses.
10. Cancellation, preserved review inputs and an enabled retry action.

The first browser pass found insufficient contrast in decorative event-card numbers, which was corrected. Navigation was explicitly awaited before the refresh assertion, and error locators were scoped to the app's main landmark to avoid matching Next.js's route announcer. The complete suite then passed.

## Reliability and security evidence

Provider/handler tests prove that a valid preview arrives before the provider finishes; partial-only, malformed and interrupted results cannot become complete plans. They exercise 429, 503, timeout, network, missing-key and abort paths, bounded retries and Retry-After guidance. Storage tests exercise atomic concurrent checklist updates, unavailable databases, transaction failures, unknown versions, corrupted records and historical plans.

Prompt tests verify serialized untrusted user data and instruction separation. Adapter tests verify direct Google-provider use, the configured model, structured output, token limits, disabled SDK retries, no model tools and metrics without event text. These tests demonstrate implementation controls; they do not prove every model response resists all prompt injection.

## External checks not performed

The local development server was also exercised in Chromium: landing → birthday setup → essentials, with **zero browser errors** after correcting the development-only React debugging CSP requirement. Two header regression tests and the production endpoint browser assertion confirm that production does not permit `unsafe-eval`. The final production browser rerun passed all 10 scenarios in 60.0 seconds.

No Gemini key or Vercel deployment has been configured by the implementation. Live Gemini generation, deployed streaming and WAF enforcement must not be marked verified without those separate checks.

GitHub Actions is configured but has not run remotely. No Vercel account, billing setting, firewall rule, production deployment or external repository was modified. No full screen-reader/assistive-technology certification was performed.

ESLint 9's upstream support warning is documented in the README: the current Next.js React/import/accessibility plugins declare ESLint 9 compatibility. A checked ESLint 10 install produced peer incompatibilities and was replaced by the supported compatible version.
