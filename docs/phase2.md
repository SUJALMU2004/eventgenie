# Phase 2 architecture, guarantees and handoff

Historical Phase 2 record: [Phase 3](phase3.md) subsequently adds the version-3 history store and shared undoable workflows. Current release measurements are in [Phase 3 verification](phase3-verification.md).

## Prerequisite audit

The workspace contained the completed Next.js 16.4.3 / React 19.3.1 Phase 1 application, its lockfile and staged source. No replacement repository was created and no commit, push or deployment was performed. Baseline checks passed: 180 tests; coverage 95.45% statements / 94.07% branches / 90.47% functions / 95.60% lines; lint, strict types, formatting, production build, credential scan and 10 browser scenarios. Baseline source content was 593,684 bytes.

Reusable contracts were `EventInput`, `EventPlan`, integer-minor-unit `allocateBudget`, date-only arithmetic, event templates, the direct Google Gemini adapter, validated NDJSON and IndexedDB repository. There were no missing code prerequisites. A valid provider key and deployed WAF remain external verification prerequisites.

## Domain and interface changes

- `src/schemas/finance.ts` defines bounded manual quotes, payments and saved scenario inputs; `src/lib/planning` owns deterministic finance, dependency, readiness, vendor and schedule rules.
- `PlanEnhancements` is a separate version-2 record owned by one Phase 1 plan. It contains contingency settings, quote/payment/scenario records, dependency edges, an optional running order, adopted qualitative recommendations and a bounded local AI cache.
- The repository adds `loadEnhancements`, transactional `mutateWorkspace`, and collision-rejecting `importWorkspace`. UI code proposes typed mutations; it never writes directly to object stores while rendering.
- `POST /api/plans/enhance` accepts only `rescue-ideas`, `day-of-schedule` or `refine-section`, with a strict minimized context. It uses protocol version 2. The original generation endpoint and unversioned Phase 1 NDJSON contract remain compatible.
- The existing provider/client transport was extracted into shared structured-generation, HTTP-stream and NDJSON-consumer modules. No second AI client, agent framework or new dependency was introduced.

## Additive storage migration

The existing database name **`eventgenie-local-v1` is retained** to preserve access to browser data. The IndexedDB database version increases from 1 to 2, adding only an `enhancements` object store. The original `plans`, `events` and `drafts` stores and their version-1 envelopes remain intact. A legacy plan receives empty Phase 2 defaults on read; its original record is not rewritten during inspection.

Phase 2 writes use `{ version: 2, data: PlanEnhancements }`. Plan, event and enhancement updates share one readwrite transaction. Revisions increment on successful workspace changes. Failed validation aborts the transaction. Plan deletion removes that plan's event and enhancement record, without touching another event. Unknown/corrupt enhancement versions are surfaced and are not silently reset or overwritten.

If IndexedDB is unavailable, explicit user changes can remain in tab memory with an unsaved warning and retry control. Closing the tab can lose these unsaved changes. Browser data still does not sync across devices. No destructive database reset is used.

## Financial correctness

Quotes, contractual commitments and paid expenses are distinct. For each vendor, protected cost is `max(booked commitment, sum of linked payments)`; unlinked payments are then added once. Unbooked quotes are not commitments. Only user-entered figures contribute to the ledger; no ratings, availability or prices are invented.

Scenario category minima include existing protected costs. They do not add the same deposit twice. The engine reserves the explicitly selected contingency, protects all category minima, and allocates the remaining integer minor units with the Phase 1 largest-remainder engine. Feasible totals reconcile exactly; infeasible cases expose their shortfall and cannot be applied. INR, USD, EUR, GBP and JPY retain their own precision without conversion.

What-If inputs, presets, priority changes and sliders produce previews only. Saved scenarios are separate records. Apply requires a confirmation and reruns feasibility against the current ledger. It changes only guest count, financial priorities, budget and contingency, preserving dates, currency, task IDs/completion, quote records and payments. Existing generated narrative is retained with an explicit reminder to review it against changed figures.

Budget Rescue adds calculated recovery alternatives and quote-specific impact analysis. A quote assessment projects the cost of retaining other allocations while accommodating that entered quote, then shows a category-by-category recovery comparison. This does not book the quote. A zero-contingency recovery is an explicit risk tradeoff, never an automatic choice.

Booked quotes or quotes linked to paid records cannot be deleted until the user explicitly releases the booking and detaches payments. Detaching a payment keeps its paid amount recorded, and the UI explains that remaining commitments must also be reviewed. Removing a payment record does not reverse any real payment.

## Readiness and event-day schedules

Readiness is an explainable rule report, with no synthetic AI score. Rule identifiers cover critical overdue tasks, other overdue tasks, missing supplier decisions, budget shortfall, blocked dependencies, compressed preparation and historical events. The graph uses one Kahn traversal, O(tasks + edges), and rejects self-links, missing references, duplicate edges and cycles. Completion is never inferred or applied automatically. The clock is injectable.

Day-of schedules are separate from preparation tasks. Users choose a same-day local window and explicit IANA time context. Six to twelve blocks require positive durations, unique IDs, valid links, window containment, no overlaps and the essential event-specific order. Overnight windows are deliberately rejected. The offline wedding, birthday and community templates are labelled samples. Supplier arrival and travel details remain unverified estimates.

Editing blocks changes a draft. Saved running orders remain intact until confirmation and validation. Users can edit titles, starts, durations and links, and move blocks using buttons; drag-and-drop is not required. AI schedules are proposals, and accepting one explicitly warns that saved and unsaved schedule edits will be replaced.

## AI operations and privacy

The shared server-only adapter uses direct `@ai-sdk/google`, configurable `GEMINI_MODEL` (default Gemini 3.5 Flash-Lite), `streamText` and `Output.object`. Targeted operations cap output at 4,000 tokens, compared with 8,000 for initial plans. SDK retries remain disabled; the shared handler permits at most one short transient retry before any preview. Timeouts, cancellation, body limits, same-origin browser checks, safe errors and no-store responses are retained.

`output-schema.ts` caches a provider-friendly decoding schema that preserves structure, required fields, enums and top-level minimum counts. Upper/nested bounds and numeric/string limits are enforced by the unchanged full local validator. Sending every bound to Gemini can exceed its constrained-decoding grammar complexity and cause HTTP 400. Stream errors retain the underlying provider status, and SDK-wrapped connection failures receive a network error rather than a generic internal message.

The typed refinement registry declares the permitted input/output schemas, target fields, required context, bounded preferences and validation. Actions cover saving ideas, simpler decor, formal/playful invitations, children’s schedules, inclusive community events and rainy-day activities. Only a permitted target section can be accepted through trusted application code.

Phase 2 requests exclude event titles, guest names/lists, current invitation text, vendor names, contacts, private notes, service inclusions and backups. Only event type/date/count/currency, category figures, an applicable time window and bounded preferences are sent. Obvious email/phone strings in preferences are rejected, and the UI tells users not to enter names or sensitive data. Arbitrary names cannot reliably be detected in free text; data minimization and review remain necessary.

Invitation proposals use neutral placeholders; trusted local code substitutes the event title, date and city only when accepted. Refinement proposes alternatives from minimized facts rather than uploading and copyediting private original text. The original section is shown locally alongside the proposal.

Qualitative AI suggestions have conditions, tradeoffs and limitations. Output schemas reject extra financial fields, and monetary/percentage savings claims are rejected for rescue/idea outputs. Only deterministic comparisons display monetary impact. Adopting a rescue idea records that idea; it cannot rewrite budget totals or financial obligations.

Partial items are schema-checked and streamed as received-item progress. Full content is shown for review only after final validation. Interrupted output is not cached or applied. Valid AI repeats use a versioned SHA-256 fingerprint in the owning event's cache, capped at ten entries with a 24-hour TTL. Demo outputs are never cached as AI. Applying financial/refinement changes invalidates relevant cached results. Acceptance rejects stale plan context or a changed target section. No model has tools to mutate storage or contact anyone.

## Portability and print

JSON backups contain one selected event and its owned decisions, excluding disposable cached AI results. Imports stay in the browser, enforce a 2 MiB UTF-8 limit, reject prototype-related structures and malformed/unsupported records, validate ownership and references, and show metadata before explicit confirmation. Import always creates a new event with remapped IDs. Atomic `add` operations reject collisions without merging or replacing existing records. Version-1 plan-only backups receive Phase 2 defaults.

Calendar files use RFC 5545 CRLF content lines, escaped text, UTF-8 octet-aware 75-byte folding, stable safe UIDs and exclusive all-day end dates. They include the main date and optionally planning milestones. They do not invent timezone offsets or travel times. Browser print styling includes saved financial/checklist/vendor/schedule information and hides forms, navigation and action controls. No PDF library is needed.

## Verification and deployment

Run the commands in the README. All ordinary tests use mocks and require no Gemini key. The current implementation evidence belongs in `docs/phase2-verification.md`; do not treat old Phase 1 measurements as the Phase 2 result.

For Vercel Hobby, keep the Next.js/Node 24 setup, add only server-side environment variables, and use one manually reviewed WAF rule covering **both** POST AI paths with a shared allowance. No deployment, firewall change or billing action is automated. Source size is measured separately from installed dependencies and deployed function bundle size.

## Phase 3 recommendations

Potential next work includes accessible multi-scenario comparison, richer local quote/payment history, more granular undo/history, optional local guest/RSVP records without sending contact lists to AI, and a broader assistive-technology audit. These are recommendations, not unfinished controls in Phase 2.
