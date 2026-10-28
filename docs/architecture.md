# Architecture and trust boundaries

## Current release

The evaluation remediation retains database version **3**, all three endpoints, NDJSON versions and local cache namespaces. Storage commands, AI contracts and UI orchestration now have focused modules. See [current measurements and evaluation evidence](evaluation-remediation.md); [the earlier Phase 4 audit](phase4-audit.md) remains historical. This repository contains no deployment workflow and must not be linked or deployed to Vercel under the current authorization.

```mermaid
flowchart TD
  Wizard[Browser: guided requirements] --> Validation[Node API: origin, byte/deadline limits, strict schemas]
  Validation --> Adapter[Server-only Gemini adapter: structured streaming, no tools]
  Secret[Server environment key] --> Adapter
  Adapter <--> Google[Google Gemini API]
  Adapter --> Final[Validate output; application owns money, IDs and dates]
  Final --> Stream[Typed NDJSON: previews, complete or safe error]
  Stream --> View[Browser: text previews and plan dashboard]
  View --> Review[User reviews and confirms decisions]
  Review --> Domain[Pure finance, scenario, contingency and task engines]
  Domain --> Transaction[Revision-checked atomic workspace transaction]
  Transaction <--> Local[(Browser IndexedDB: plans, decisions, history)]
  Local --> View
```

```text
src/app/                    routes, layouts and API entry points
src/features/               wizard, dashboard and focused decision panels
src/components/ui/          shared semantic controls and native confirmation
src/data/                   deterministic event/vendor/demo templates
src/schemas/                reusable event, plan, financial and AI contracts
src/lib/planning/           financial and event-planning algorithms
src/lib/ai/                 prompts, provider adapter, streams and local-cache contracts
src/lib/storage/            IndexedDB repository and additive migrations
src/lib/history.ts          bounded snapshots, undo/redo and revision invariants
tests/e2e/                  full event journeys, axe and release browser checks
scripts/                    tracked-size and source/index/history/bundle credential checks
docs/                       architecture, evaluation evidence and release instructions
```

## Responsibility boundaries

| Boundary               | Modules                                                                             | Responsibility                                                                                                                                                          |
| ---------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Persistence contract   | `storage/contracts.ts`, `repository.ts`                                             | Existing `PlanRepository` API and compatibility exports; compose lower-level services.                                                                                  |
| Storage infrastructure | `storage/database.ts`, `record-store.ts`, `errors.ts`                               | Version-3 connections, additive store creation, request/transaction promises, bounded owned record access and typed failures.                                           |
| Durable validation     | `storage/records.ts`, planning schemas                                              | Validate envelopes and records before use; never reset incompatible data.                                                                                               |
| Workspace commands     | `storage/workspace-store.ts`, `plan-store.ts`                                       | Initial save/import and revision-checked mutations/history; retain one transaction across plans, events, enhancements and history. Notify other tabs only after commit. |
| Optional notification  | `storage/notifications.ts`                                                          | Publish plan ID, revision and random tab source only; browser policy failures never undo a completed save.                                                              |
| Targeted AI UI         | `decisions/use-plan-operation.ts`, `ai-workbench.tsx`, `operation-proposal.tsx`     | Request/cache/cancellation and reviewed acceptance separated from controls and proposal presentation; reuse the shared NDJSON transport and retry utilities.            |
| Intelligence contracts | `ai/intelligence-contracts.ts`, `intelligence-input.ts`                             | Operation types, operation-specific requirements, privacy minimization and valid task references.                                                                       |
| Intelligence context   | `ai/intelligence-context.ts`, `intelligence-identity.ts`                            | Relevant structured facts and stable input fingerprints; canonical schema parsing preserves payload order and cache identity.                                           |
| Intelligence output    | `ai/intelligence-output.ts`, `intelligence-prompt.ts`, `intelligence-samples.ts`    | Validate and normalize output, trusted instructions and clearly labelled deterministic samples. `intelligence.ts` preserves prior exports.                              |
| Deterministic rules    | `planning/contingency-rules.ts`, `readiness.ts`, `schedule.ts`, `task-workflows.ts` | Event-specific rule handlers and pure validation; application-owned financial calculations, identifiers and approved changes.                                           |
| Form feedback          | `lib/validation.ts`, `features/forms/use-field-errors.tsx`                          | Domain/Zod field paths become associated errors and focus targets. Unknown failures use a focusable summary.                                                            |
| Confirmations          | `components/ui/confirmation.tsx`                                                    | Native modal focus, described consequences, pending save status, retained failures and successful-only closure.                                                         |

The contingency controller and presentation are separate (`use-contingency.ts`, `presentation.tsx`). Schedule activity editing and dashboard statistics/status also use focused presentation components. Render paths do not request AI output. Existing lazy imports for the dashboard and Decision Studio remain in place.

ESLint uses the TypeScript project service to check floating/misused promises, type-only imports and unnecessary assertions, with a complexity limit of 15 across source functions. TypeScript also checks unused locals/parameters, implicit returns and switch fallthrough. No per-function complexity suppressions or relaxed coverage exclusions were added.

## Browser policy and accessible edits

Static pages retain their build-time rendering. The CSP explicitly blocks inline event-handler attributes, all frame loading and base URL changes. Static Next.js bootstrap scripts still require the existing inline script permission; this is a documented tradeoff, not a strict nonce policy. React renders generated text without interpreting HTML. One-year HSTS is attached only when the TLS terminator supplies `x-forwarded-proto: https`, without subdomain/preload commitments. A real hosting environment must set/overwrite that header at its trusted proxy boundary; local HTTP gets no HSTS header.

Known-cost input is controlled React state. Invalid amounts expose a currency-aware message, `aria-invalid`, associated descriptions and focus without changing the scenario. Task and schedule validation use field paths, including original activity indexes when times are sorted for validation. Schedule drafts are checked before confirmation, then revalidated against the current workspace during the save. A failed confirmation stays open with an associated error; a new confirmation has no stale error. Native dialogs restore focus on cancellation.

## Preserved implementation history

Phase 3 adds [shared transactional history and plan-specific intelligence](phase3.md). The current database version is **3**, adding only the history store to the Phase 2 stores. Original plan/event/draft envelopes stay at version 1, enhancements at version 2, with optional version-3 intelligence data. Version-3 streaming serves `/api/plans/intelligence`; earlier stream contracts remain supported. The paragraphs below describe the preserved foundation and its historical Phase 2 extension.

Phase 2 extended this architecture through [the Decision Studio design](phase2.md). Its historical upgrade introduced database version 2 and the owned enhancements store; Phase 3 subsequently added history at version 3. Plan/event/draft envelopes remain version 1. Shared structured-generation and NDJSON modules serve the original endpoint and targeted operations.

## Product boundary

EventGenie is a domain-specific planning product, not a general chatbot. A guided requirements form feeds one structured AI request. Weddings, birthdays and community events have different budgets, essential tasks and vendor templates. Advanced guest/payment management and conversational AI are outside Phase 1.

## Data contracts

- `EventInput`: event type, title/subtype, ISO date, city, bounded integer guests, integer `budgetMinor`, currency, style/setting, food/cultural preferences, up to three spending priorities, requirements and notes.
- `Recommendations`: overview, category explanations, 12–20 tasks with relative day offsets, 3–10 vendor categories with booking offsets, 4–6 ideas, 1–2 invitation drafts and warnings. The model does not own monetary amounts or final IDs.
- `EventPlan`: version 1 record with UUID, timestamp, input fingerprint, explicit `ai`/`demo` source, validated requirements, deterministic allocations, dated/identified checklists and recommendations.
- `StreamMessage`: discriminated `preview`, `complete` or `error` NDJSON frames. Every network frame is validated on the client. An interrupted stream never becomes a saved plan.
- `PlanRepository`: save event/plan, load/list/delete plans, atomic task/vendor updates, draft save/load/clear and local AI-result lookup.

## Browser → server

All event input is untrusted. The server checks method, content type, actual byte count (not merely Content-Length), browser origin context and strict input constraints before contacting Gemini. New generation requires a future date; stored records intentionally do not enforce that temporal rule. Origin checks reduce browser misuse but cannot authenticate curl or stop distributed abuse.

## Server → Gemini

Only the server-only provider imports `@ai-sdk/google`. The key configures the HTTP provider and is never supplied as prompt content. The system prompt controls domain behaviour; serialized event data remains untrusted requirements. No tools execute user-controlled instructions, and no search or paid gateway is involved. Bounded prompts and output tokens constrain compute.

The SDK's `partialOutputStream` yields partial objects. Individual section schemas filter incomplete fields; previews are never written to IndexedDB. After SDK completion, the recommendations schema is checked again and normalisation assigns IDs, dates, default checklist status and integer allocations. Budget totals and duplicate IDs are checked by the durable schema.

Provider failure before response setup uses non-2xx JSON. Failures during a 200 streaming response use terminal error frames, since headers cannot change after transmission starts. Error translation exposes safe codes and actions. Cancellation and a 90-second timeout reach the upstream provider. Automatic retries stop after one attempt or any delivered preview; long Retry-After hints are returned to the user.

## Browser persistence

IndexedDB object stores separate plans, events and drafts. Plan/event writes are transactional. Checklist updates read and write inside one readwrite transaction, avoiding last-writer loss for concurrent updates. Version 1 envelopes are validated on read. Unknown versions are preserved and reported; invalid records are skipped in lists with visible issues. There are no destructive speculative migrations.

An unavailable/full database never causes a false “saved” message. A completed plan can remain in tab memory and be retried. There is no cross-device sync or recovery after clearing browser data. SHA-256 fingerprints support browser-local reuse; samples are excluded. Fingerprint version changes invalidate reuse when prompt/budget semantics change.

## Arithmetic and dates

Decimal input becomes integer minor units without floating-point monetary multiplication. All supported budgets and intermediate products stay within JavaScript's safe integer range. Rounded contingency is reserved first. Priority-adjusted category weights receive the remaining amount using largest-remainder allocation and a stable category-order tie-break.

Date-only arithmetic runs in UTC to avoid daylight-saving issues. Asia/Kolkata defines today for the India-first experience. Past preparation deadlines move to the planning start with a short-preparation warning; tasks never move beyond the event date during normalisation.

## Deployment and security

Next.js pages use server rendering by default and client components only for interaction/storage. The wizard dynamically imports the dashboard. Static templates and an original SVG illustration keep the source small. The Node route is stateless; there is no server filesystem/database persistence or per-process rate-limit Map.

A manually configured Vercel WAF rule supplies deployment-level per-IP throttling. Counters are regional, shared IPs can affect legitimate groups, and Google project quotas remain global external constraints. Security headers and text rendering reduce common browser attack paths. Prompt separation and schema checks are safeguards, not proof that model recommendations cannot be influenced.

## Verification boundary

Unit/integration tests inject a mocked provider and mock SDK calls; Playwright mocks the generation HTTP response and exercises production browser rendering, IndexedDB and user actions. These provide complementary boundary evidence. They are not represented as live Google/Vercel deployment tests. A real-key smoke test and a deployed WAF check remain separate manual checks when credentials/deployment are available.
