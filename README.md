# EventGenie AI

A local-first, India-first celebration planner for **Challenge 5: Celebration & Event Planner**. Turn wedding, birthday and community-event requirements into an actionable blueprint with budgets, timelines, vendor categories, personalised ideas and invitation drafts.

The application has no login, hosted database, payment processing, analytics or mandatory paid infrastructure. Plans and manual financial records stay in the current browser; AI generation uses Google's direct Gemini API.

## Release verification — Phase 4

The release audit retains all three phases and hardens upload deadlines, cancellation, final-stream validation, atomic-save notifications, responsive keyboard access and form contrast. **534 automated tests and 29 production Chromium tests pass locally**. Core coverage is **98.32% statements / 96.58% branches / 96.47% functions / 98.63% lines**; ordinary tests and production builds work without a Gemini key. One small synthetic Phase 4 Gemini invitation request was verified live.

Start with the [architecture and trust boundaries](docs/architecture.md), [audit and measured baseline comparison](docs/phase4-audit.md), [criterion-by-criterion evaluation matrix](docs/phase4-evaluation-matrix.md), and [release/setup/submission guide](docs/phase4-release.md). The owner reports a clean terminal dependency audit; this agent's advisory request failed, so that evidence remains qualified. Full screen-reader certification and untested external behavior are not claimed. **No Vercel deployment or linking is authorized or performed.** No external evaluation score is guaranteed.

## Phase 3 — Confident decisions

**Phase 3 is now implemented:** persistent undo/redo and revision history, up to three saved alternatives beside the current plan, seven hypothetical contingency playbooks, a plan-aware Ask EventGenie panel, reviewed task workflows and a five-tone Invitation Studio. Open any saved plan and select **Open advanced planning**. Local facts, templates and clearly labelled samples work without Gemini. See [Phase 3 architecture and privacy](docs/phase3.md) and [current verification evidence and limitations](docs/phase3-verification.md).

The additive database version-3 migration adds only owned history; existing plans and decisions are retained. Every plan edit uses the shared revision-checked transaction. History is bounded at 20 changes by default, saved answers at five, and the new local AI cache at ten entries. No dependency or hosted service was added.

## Phase 2 — Decision Studio

The existing dashboard includes reviewed decision tools for all three event types:

- **What-If Simulator:** budget/guest/priority/contingency presets, exact category comparisons, known-cost minima, saved scenarios, reset and explicit confirmed application.
- **Budget Rescue:** distinct quoted, committed and paid amounts; linked deposits counted once; projected quote pressure; calculated recovery options; optional qualitative AI ideas with no fabricated monetary savings.
- **Vendor Decision Desk:** add/edit/delete actual user-entered options, compare quotes and inclusions, record shortlist/booking/availability, and keep optional contacts local. Booked or payment-linked quotes cannot disappear silently.
- **Readiness:** explainable overdue, supplier, budget, dependency and preparation-window rules. Efficient graph validation detects cycles and missing/self references; there is no invented readiness percentage.
- **Day-of Schedule:** explicit same-day local start/end/timezone, event-specific samples, editable activities and links, keyboard move controls, conflict checks, saved running orders and reviewable AI proposals.
- **Targeted refinements:** saving ideas, simpler decor, formal/playful invitations, children’s schedules, inclusion and rainy-day alternatives. Compare original and proposed content, reject or confirm acceptance. Unrelated data remains intact.
- **Portability:** browser print styling, escaped/folded all-day `.ics` calendars, selected-plan JSON backup, local-only import preview and collision-safe restore to a new plan.

Phase 2 adds no dependency or account requirement. Deterministic samples work without a Gemini key. No scenario slider, numeric edit or rendering path makes an AI call. Validated repeated AI operations use a per-plan ten-entry cache with a 24-hour TTL. The new AI endpoint uses version-2 NDJSON; the original generation contract remains compatible.

The additive IndexedDB upgrade retains the existing database name and every Phase 1 store/record, adding an owned enhancements store at database version 2. Workspace changes and imports are transactional. Clearing browser data still removes local plans; keep private backups when needed.

See [Phase 2 architecture, migration and privacy details](docs/phase2.md) and [Phase 2 verification](docs/phase2-verification.md). The earlier Phase 1 evidence remains available separately.

## What works in Phase 1

- Responsive landing page and four-step, keyboard-accessible setup wizard.
- Event-specific, progressively streamed AI blueprints: overview, budget explanations, 12–20 tasks, 3–10 vendor categories, 4–6 ideas, 1–2 invitation drafts and warnings.
- Exact integer budget allocations, spending priorities and a 10% contingency. INR by default; USD, EUR, GBP and JPY also supported with their proper precision. No exchange-rate conversion.
- Date-relative timelines, task completion, vendor checklist status and invitation copying. Invitations are **never sent**.
- Validated IndexedDB storage, saved-plan library, selected deletion, wizard drafts and local reuse of identical AI inputs.
- Explicit, deterministic samples for all three event types; these work without an API key. Sample plans are always labelled.
- Cancellation, bounded retries, provider error messages and visible storage-failure states.

## Architecture

```text
Next.js pages + accessible feature components
        │ event requirements
        ▼
POST /api/plans/generate
  request limits → Zod validation → isolated prompt → Gemini adapter
        │ streamText + Output.object
        ▼
validated section previews → final schema validation
        │ deterministic budget/date/ID normalisation
        ▼
NDJSON complete message → client validation → IndexedDB → dashboard
```

UI lives in `src/app`, `src/components` and `src/features`. Pure financial logic lives in `src/features/budget/engine.ts`. `src/lib/ai` separates prompts, provider integration, preview validation and HTTP orchestration. `src/schemas` defines shared contracts. `src/lib/storage` is the persistence boundary. Templates and demo fixtures live in `src/data`.

See [architecture and trust boundaries](docs/architecture.md), [evaluation matrix](docs/evaluation.md) and [verification evidence](docs/verification.md).

## Stack and prerequisites

- Node.js **24.x** and npm; Node 24.13.1 was available during implementation.
- Next.js 16.4.3 App Router, React 19.3.1 and strict TypeScript.
- Tailwind CSS 4, Lucide and a selective shadcn/ui-style Button primitive using Radix Slot/CVA.
- AI SDK 7, `@ai-sdk/google` 4 and Zod 4.
- Vitest, React Testing Library, fake-indexeddb, Playwright Chromium and axe-core.

The lockfile is the reproducible dependency source of truth. No external font download is required to build.

ESLint 9.39.5 is retained because Next.js's current React/import/accessibility plugins declare support through ESLint 9. ESLint 10 was checked and rejected for peer incompatibility. npm emits an ESLint 9 support warning; dependency auditing remains a release gate.

## Install and run

```powershell
npm ci
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
# Edit .env.local locally; never paste or commit a real key.
npm run dev
```

Open <http://localhost:3000>. Without a key, use the sample plan option from the landing page or final review step. AI submission reports a configuration error without crashing.

For a production preview:

```powershell
npm run build
npm start
```

### Server-only environment

| Variable                       | Purpose                                                                  |
| ------------------------------ | ------------------------------------------------------------------------ |
| `GOOGLE_GENERATIVE_AI_API_KEY` | A Gemini API key from Google AI Studio, used only in the server adapter. |
| `GEMINI_MODEL`                 | Optional model override; default `gemini-3.5-flash-lite`.                |

Use an eligible **free-tier Google project without billing** to honour the no-paid-API constraint. The app cannot determine or change your Google billing tier. Quotas and model access depend on Google's project policy. Do not enable billing to bypass a quota failure; use a sample instead.

The original brief requested `gemini-2.5-flash-lite`. During planning, Google documented legacy-access restrictions on 2.5 models and the project owner approved 3.5 Flash-Lite instead. A server-side override supports a legacy-access project. See [Google model availability](https://ai.google.dev/gemini-api/docs/deprecations) and [pricing](https://ai.google.dev/gemini-api/docs/pricing).

## AI integration and streaming

The adapter calls Google's direct provider with `streamText({ output: Output.object({ schema }) })`. It consumes `partialOutputStream`, validates individual preview sections, and awaits the SDK's final output. The route returns genuine NDJSON frames; no timers simulate AI progress. The client uses `fetch`/`ReadableStream` rather than a chat UI hook so terminal structured errors and final normalised data share one typed protocol.

- `preview`: valid overview, task, vendor or idea content; transient only.
- `complete`: the fully validated and normalised `EventPlan`; eligible for saving.
- `error`: a safe machine-readable error; partial results are discarded as durable plans.

No model tools, search grounding, vendor lookup or invitation delivery is enabled. One generation request is made normally. The SDK's automatic retries are disabled; the route permits at most one transient retry before any preview, only when the delay is at most two seconds. Longer `Retry-After` guidance is returned to the UI. Generation has a 90-second application timeout and a 120-second function allowance.

The model produces recommendations; TypeScript owns the money, final identifiers, deadlines and completion state. Development operational metrics contain latency and token counts, never event text. Browser tests mock the generation HTTP boundary; service tests independently mock the provider and SDK boundary. Live Gemini behaviour requires a separate credentialed smoke test.

## Financial and date correctness

Money input is parsed from decimal text into integer minor units. The pure allocator reserves rounded contingency, doubles selected category weights and applies largest-remainder allocation to the balance. Stable category-order tie-breaking produces reproducible results. Totals exactly equal the budget, including for tiny budgets and JPY. All amounts are planned estimates, not actual expenses or verified market prices.

Dates are ISO date-only strings. UTC arithmetic avoids daylight-saving shifts; “today” uses Asia/Kolkata. Tasks that would fall before planning starts move to today, with an explicit preparation-time warning. New generation requires a future event date; saved historical plans remain readable.

## Local storage and privacy

IndexedDB stores versioned events, complete plans and wizard drafts. Reads validate records. Unknown versions are reported without destructive migration; corrupted records do not hide healthy plans. Readwrite transactions preserve concurrent checklist updates. IndexedDB is optional at runtime: failed saves keep the completed plan in the current tab and offer retry.

Input fingerprints are SHA-256 hashes of canonical, versioned requirements. Only an identical **local AI plan** is reused. Demo plans are excluded from AI reuse. Static templates are bundled; there is no public personalised-response cache.

Plans do not automatically sync, and clearing browser data can remove them. Necessary event requirements, including notes, go to Google for AI generation. Google's free tier permits product-improvement use of submitted content; avoid sensitive personal data. No guest list or contact fields are collected. See the app's `/privacy` page and [Google's terms](https://ai.google.dev/gemini-api/terms).

## Testing and quality commands

```powershell
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run test:coverage
npm run build
npx playwright install chromium
npm run test:e2e
npm run security:check
npm run security:bundle
npm run audit
npm run size:check
```

`npm run format` applies formatting. Browser tests start a dedicated production server on port **3100**, with the Gemini key disabled; run a build first. On Linux CI, install the browser with `npx playwright install --with-deps chromium`.

Coverage thresholds enforce **80% statements, branches, functions and lines** across schemas, financial logic and all library services, including provider and error paths. Tests do not need a real key. Playwright covers all three event types, refresh/restore, local reuse, validation, keyboard navigation, sample fallback, deletion and axe checks. Reports, screenshots, traces and coverage stay ignored.

GitHub Actions runs the same secrets-free gates on pull requests and main updates with read-only repository permissions. It does not deploy.

## Security

- `.env*` is ignored except the placeholder-only `.env.example`. No `NEXT_PUBLIC_` credential exists. The provider is marked `server-only` and initialised at request time.
- The endpoint enforces JSON content type, actual streamed body size of 16 KiB, strict bounded inputs, future dates, safe integer budgets, output-token limits and abort propagation.
- Same-origin browser checks are an additional mitigation, **not authentication or distributed rate limiting**. Non-browser callers can supply or omit Origin.
- User data is serialized separately from system instructions. There are no executable model tools. Schemas validate outputs, and React renders text rather than untrusted HTML.
- Error codes cover bad requests, configuration, quota, timeout, transport, abort, malformed output and internal errors. Stack traces, raw prompts, keys and provider details are not returned.
- Security headers restrict framing, content sniffing, camera/microphone and connection destinations. The baseline CSP allows inline scripts/styles for Next.js hydration; it is not a nonce-based strict CSP. React debugging eval is permitted only in development; production explicitly omits it.
- Credential-pattern checking complements manual review and dependency auditing; it is not a complete secret-scanning guarantee.

## Accessibility and performance

Semantic sections, proper headings, labelled forms, error descriptions, visible focus, skip navigation, native controls/dialogs and status announcements support keyboard and screen-reader use. Charts have a textual table equivalent. Progress updates are tied to received data; reduced motion is respected. Automated axe checks supplement manual focus and narrow-layout checks; they do not certify WCAG compliance.

There are no AI calls while typing or rendering, no cloud cache, no heavy chart library and no stock image assets. The dashboard loads on demand from the wizard. Static templates avoid redundant compute. The size script measures tracked file bytes plus untracked source candidates, failing at **9,000,000 bytes**, below the strict 10 MB evaluator limit; installed dependencies/build output are excluded.

## Optional future hosting reference — no deployment performed

The owner explicitly requested **no Vercel deployment or project linking**. The steps below are retained for a separately authorized future release; the GitHub submission does not deploy the application.

1. Push the source and lockfile to your own GitHub repository, preserving the ignore rules.
2. Import the repository in Vercel as a Next.js project on the Hobby plan. Select Node **24.x**. Use the default install/build settings (`npm ci`, `npm run build`).
3. Add `GOOGLE_GENERATIVE_AI_API_KEY` through Vercel Project Settings → Environment Variables for the environments you intend to use. Treat it as a secret; never prefix it with `NEXT_PUBLIC_`. Set `GEMINI_MODEL` only if overriding the default.
4. Confirm the project uses Fluid Compute and the function duration supports the route's 120-second allowance. No Edge runtime, persistent process, filesystem storage or database is required.
5. Review the free allowances, deploy manually to the included `vercel.app` subdomain and verify a sample plan plus one authorised live generation.
6. Follow [the rate-limit instructions](docs/deployment.md) before exposing the public generation endpoint widely.

No Vercel resources or billing were changed during implementation. Builds succeed without an API key. Free-plan quotas remain external constraints; see [supported Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions) and [function duration](https://vercel.com/docs/functions/configuring-functions/duration).

## Troubleshooting and limitations

- **Configuration error:** set a valid server key and confirm model eligibility, then restart/redeploy. Never put a key in a browser field.
- **429 or unavailable service:** details remain in the wizard. Respect the cooldown or use an explicitly labelled sample. No paid model fallback occurs.
- **Storage failure:** keep the tab open and retry saving; private browsing, browser policy, full storage or another tab can interfere.
- **Missing saved plan:** open the original browser/device; there is no cloud copy.
- **AI recommendations:** verify cultural details, dates, permissions, dietary arrangements and supplier quotes. Structural validation does not prove advice is factually correct or immune to every prompt-injection attempt.
- **Public API protection:** the code alone does not enforce a distributed per-IP quota. The documented WAF rule requires manual setup; a shared Google project quota can still be exhausted.
- **Currency changes:** entered amounts retain their face value and are never converted.

## Release scope

Phase 3 delivers history, multi-scenario comparison, contingency support, grounded assistance, task workflows and invitation refinement. Phase 4 performs the independent evaluation audit, hardening and regression checks; its reports distinguish verified local results from owner-reported and unavailable external checks. No guest messaging, account, marketplace or autonomous agent was added.
