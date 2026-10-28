# Phase 2 verification record

Verified locally on **27 October 2026**, Windows, Node.js 24.13.1 and npm 11.19.0. Phase 1 baseline: 180 passing tests and 10 passing production browser scenarios. Existing tests were retained; database-opening fixtures were updated for the additive version-2 migration.

## Verified release checks

### Follow-up: live generation and error reporting

A valid Google authorization key and Gemini 3.5 Flash-Lite were confirmed through a token-free model metadata request. Live diagnostics then isolated two failures: the original nested/bounded provider schema received `400 INVALID_ARGUMENT`, and the development server's restricted process received `EACCES` contacting Google. A partial-stream wrapper also hid the original provider error behind a generic internal error.

The shared adapter now caches a compact provider schema that retains types, required fields, enums and top-level minimum section counts. Nested/upper-count and numeric bounds remain enforced by the original full Zod validator before final output is accepted. This follows [Google's schema-complexity guidance](https://ai.google.dev/gemini-api/docs/structured-output#limitations). The adapter preserves the original streaming error; provider request rejections and SDK-wrapped network failures now have stable, actionable messages. Logs contain only sanitized operational metadata.

After restarting the development server with outbound network access, a fictional birthday request through **the real local API** returned `source: ai`, **34 schema-valid preview messages**, and a fully validated **12-task** plan. A direct adapter check also completed with 65 partial chunks in approximately 5.9 seconds (679 input tokens, 1,814 output tokens); partial SDK chunks are distinct from validated API previews. No user event or guest data was used in diagnostics. Model/key values were not printed or changed.

Regression result: **341 tests across 24 files passed**. Coverage: **97.28% statements, 95.46% branches, 95.34% functions, 97.50% lines**. Lint, strict types and production build passed. Ordinary tests still require no key and make no live provider requests. This live check verifies one initial-plan event type, not all live Phase 2 operations or deployed behavior.

### Follow-up: local origin rejection

The shared API origin guard compared the browser's Origin with Next.js's internal bind URL. This incorrectly rejected `127.0.0.1:3000` when the internal URL used `localhost:3000`. The guard now compares against the browser-facing Host and protocol, retains exact port matching, rejects malformed/cross-site origins and does not trust forwarded hosts.

After the fix: **329 tests across 23 files passed**; coverage was **97.21% statements, 95.18% branches, 95.22% functions and 97.43% lines**. Lint, strict types and the production build passed. One added Chromium regression test passed against both loopback browser addresses and both AI endpoints, using invalid payloads to avoid provider calls. The original 18-browser-test release run below was not repeated for this isolated follow-up.

### Original Phase 2 release measurements

| Command / check          | Actual result                                                                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:coverage`  | **314 tests passed across 23 files**                                                                                                                                      |
| Statements               | **97.18%**, 967 / 995                                                                                                                                                     |
| Branches                 | **95.12%**, 644 / 677                                                                                                                                                     |
| Functions                | **95.20%**, 258 / 271                                                                                                                                                     |
| Lines                    | **97.41%**, 904 / 928                                                                                                                                                     |
| `npm run test:e2e`       | **18 Chromium browser tests passed** against the production build: original 10 plus 8 Phase 2 scenarios                                                                   |
| `npm run lint`           | Passed, zero warnings                                                                                                                                                     |
| `npm run typecheck`      | Passed, generated route types and strict TypeScript                                                                                                                       |
| `npm run format:check`   | Passed                                                                                                                                                                    |
| `npm run build`          | Passed; key-free production build                                                                                                                                         |
| `npm run audit`          | Zero reported vulnerabilities                                                                                                                                             |
| `npm run security:check` | Passed; credential/generated-content patterns and example-environment placeholder                                                                                         |
| `npm run size:check`     | Passed; tracked working content 596,004 bytes and all source candidates 865,352 bytes before this final evidence update; final exact value is emitted by the size command |
| `git diff --check`       | Passed; Git reports a generated declaration-file CRLF normalization notice                                                                                                |

Coverage is measured across the configured core schemas, planning, AI, portability and storage modules, with all four thresholds enforced at 80%. It is not a claim of 95% UI coverage. No dependencies were added for Phase 2. The lockfile remains retained.

The source-size check includes untracked source candidates so the pending Phase 2 files cannot evade the limit. Installed dependencies, build outputs, coverage and screenshots are ignored generated artifacts. Both measured source counts are comfortably below the 9 MB release threshold and strict 10 MB evaluation limit. Source remains in the working tree for review; no commit or push was made.

## Exercised behavior

- Exact INR/USD/EUR/GBP/JPY financial allocation, contingency, priorities, protected category minima, infeasible budgets, duplicate quotes and quote-specific recovery. Booked commitments and linked deposits are not added twice.
- Genuine IndexedDB version-1 upgrade, original plan/draft/completion preservation, unknown versions, atomic rollback, concurrent mutations, ownership, collision rejection, deletion, quota/unavailable storage and stale revision/deleted-plan protection.
- Missing/self/duplicate/cyclic dependencies, injected dates, explainable readiness, all three schedule templates, timing/ordering/overlap/link validation and draft preservation.
- Strict operation schemas, minimized prompts, malicious preference/output handling, schema-valid progressive delivery, final normalization, cache bounds/expiry, one pre-preview retry, 429/503, malformed output, timeout, cancellation, origin/body/content-type checks and non-JSON platform errors. Provider calls are mocked.
- Selected-plan backup, legacy defaults, remapped identifiers/references, prototype-related input rejection, UTF-8 byte limits, safe calendar escaping/folding/line endings and all-day end dates.
- Browser wedding/birthday/community decisions, cancel/confirm application, vendor booking and payment, schedule edits, refresh persistence, AI preview/rejection/cache/acceptance, import/download, failure recovery and unavailable IndexedDB.

The first combined browser run identified four test-selector/wait issues. These were corrected, the four affected cases passed, and the final full 18-test run passed with no failed tests.

## Accessibility and visual verification

Automated axe scans passed for the primary Phase 1 pages and expanded Phase 2 forms, tables and AI controls for all three event types, using WCAG A/AA tags through WCAG 2.2. Browser checks exercise keyboard disclosure controls, focus/confirmation behavior, mobile width containment, dynamic status/error visibility and print visibility of saved schedules with controls hidden. Desktop and 390-pixel mobile screenshots were captured for visual review.

A separate development-server walkthrough caught a Tailwind relative CSS-import resolution error that the production compiler did not reproduce. Importing the feature stylesheet through the documented Next.js root-layout CSS boundary fixed it. The development wizard returned HTTP 200 and the full sample-to-Decision-Studio flow passed at desktop and mobile sizes after the fix. The production build and browser suite were then rechecked.

This is **partial accessibility verification**, not certification: comprehensive manual screen-reader testing, every browser/assistive-technology combination and a full independent contrast/announcement audit have not been performed.

## External verification scope

- **Live Gemini generation:** subsequently verified for one fictional birthday through the local API, as recorded above. Live wedding/community generation and targeted Phase 2 operations remain unverified; automated coverage uses mocks. Samples remain explicitly labelled deterministic.
- **Deployment, Vercel Hobby runtime limits and WAF enforcement:** not verified. Deployment and the single shared endpoint-scoped rate-limit rule are documented only; no account, billing or firewall settings were changed.
- **Remote GitHub Actions execution:** workflow is configured, but was not pushed or run remotely. Its underlying local commands passed.
- Calendar output is tested against RFC-oriented invariants; import into every calendar vendor is not verified. IndexedDB tests and browser flows do not establish cross-device sync or indefinite browser retention.

## Handoff and reproduction

See [README setup and scripts](../README.md), [architecture, migration, important modules and Phase 3 recommendations](phase2.md), [evaluation matrix](evaluation.md), and [Vercel Hobby deployment/WAF instructions](deployment.md).

With Node 24, run `npm ci`, create `.env.local` from the placeholder example only if no local configuration exists, and run `npm run dev`. Open `http://localhost:3000`; choose any labelled sample for a key-free walkthrough, then use **Load fictional Phase 2 examples** in its Decision Studio. Review the confirmation before loading. The example creates local fictional decisions without changing the active plan's budget.

To repeat checks, run formatting, lint, typecheck, coverage, production build, `npx playwright install chromium`, browser tests, audit, credential scan and size check using the scripts listed above. Browser tests deliberately disable the provider key. Exact setup and environment handling are in the README; do not overwrite existing local secrets when following first-run instructions.

The environment value found in `.env.example` was preserved in ignored `.env.local` and the documented placeholder was restored. The subsequent metadata and generation checks confirmed the active local key works. Mocked tests and deterministic samples do not make live provider calls.
