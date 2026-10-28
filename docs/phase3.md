# Phase 3 — decisions, intelligence and reliability

Phase 3 extends the existing Next.js application; it does not replace either earlier phase. It adds no dependency, account, hosted database, delivery service, marketplace or payment processor. No commit, push, deployment, firewall change or billing change is part of this implementation.

## Delivered experience

The dashboard now offers persistent undo/redo, a current revision indicator, dated history, budget/readiness summaries and links to next actions. **Open advanced planning** loads the optional feature bundle on demand. Closing it preserves in-tab drafts. The established ivory/navy/teal design, original planning wizard, all three event types and all five currencies remain supported.

Advanced planning contains:

- **Your next best steps:** deterministic high-priority, overdue and unblocked task ordering, readiness links, an event-specific fallback task, manual task editing and optional reviewed AI suggestions.
- **Compare strategies:** the active plan plus up to three saved alternatives, with exact budget/category/reserve figures, paid/protected amounts, feasibility, outstanding work, priorities and supplier-capacity cautions. Lowest budget and highest reserve are calculated highlights, not recommendations.
- **Contingency planning:** hypothetical rain, supplier cancellation, budget reduction, cost increase, additional guests, lower attendance and a delayed task. It explains local impacts before offering optional qualitative AI advice. Users select financial/guest, task and/or valid deadline changes, then confirm a single undoable mutation.
- **Ask EventGenie:** useful suggested questions, bounded custom questions, current local facts and optional structured AI explanations. Exact budget questions never invoke Gemini. The guest-increase example calculates the new count locally without inventing a per-guest price. Answers link only to actual supplied sections/task aliases. Up to five explicitly saved answers remain local to the owning event.
- **Invitation Studio:** five tones, short/detailed variants, one selected draft, manual editing, local templates, optional AI opening/closing prose, immutable insertion of the recorded title/date/city and user-confirmed time/venue/RSVP details. Unknown details remain placeholders. Copy, local text download and optional native sharing have clear fallbacks; no invitation is automatically sent.

Every existing Phase 2 panel remains available. Samples for wedding, birthday and community events work without a provider key. **Load fictional Phase 2 examples** still provides clearly labelled financial/vendor/schedule fixtures. Each new AI operation also has an explicitly labelled deterministic sample preview.

## Important modules and changes

| Responsibility                          | Files                                                                                                                   |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Durable history and commands            | `src/lib/history.ts`, `src/lib/storage/repository.ts`                                                                   |
| Shared dashboard mutation state         | `src/features/decisions/use-workspace.ts`, `src/features/event-plan/dashboard.tsx`, `src/features/history/controls.tsx` |
| Schemas and compatibility               | `src/schemas/intelligence.ts`, additive `src/schemas/enhancements.ts`, extended `src/schemas/plan.ts`                   |
| Deterministic decisions                 | `src/lib/planning/comparison.ts`, `contingency.ts`, `task-workflows.ts`, extended `readiness.ts`                        |
| AI contracts, minimization and cache    | `src/lib/ai/intelligence.ts`, `intelligence-handler.ts`, `intelligence-cache.ts`                                        |
| Shared provider and transport, retained | `structured.ts`, `output-schema.ts`, `http-stream.ts`, `src/lib/ndjson-client.ts`                                       |
| Node endpoint                           | `src/app/api/plans/intelligence/route.ts`                                                                               |
| Optional UI                             | `src/features/intelligence`, `scenarios`, `contingency`, `assistant`, `tasks`, `invitations`                            |
| Invitation text/share/download          | `src/lib/invitations.ts`                                                                                                |
| Portability                             | Additive changes to `src/lib/portability.ts`                                                                            |
| Browser evidence                        | `tests/e2e/phase3.spec.ts` and retained earlier suites                                                                  |
| Supporting changes                      | Dashboard summary, landing/privacy copy, root CSS imports, credential scanner and documentation                         |

## Additive storage migration

The database name **`eventgenie-local-v1` stays unchanged**. Database version **3** adds only a `history` object store. Existing `plans`, `events`, `drafts` and `enhancements` stores are retained. Plan/event/draft envelopes remain version 1; enhancement envelopes remain version 2. An optional, independently versioned `intelligence` value inside the enhancement record uses schema version 3. Legacy records do not need that field and are not rewritten just to inspect them.

History envelopes use version 1 and identify the owning plan. A history record contains its current revision, optional last-save timestamp, and bounded undo/redo stacks with descriptions, original change timestamps, IDs and sufficient local snapshots to restore decisions. The default limit is **20**, configurable through `createRepository(name, { historyLimit, clock })`; the supported range is 1–30. No history contains the server key. Disposable AI caches and conversations are excluded from snapshots. Recent local answers survive unrelated undo/redo and are labelled historical advice when viewed later.

All plan changes pass through the shared workspace transaction. The plan, event requirements, owned enhancements and history entry commit or abort together. Validation runs before writes. Snapshot IDs remain stable on restore; undo and redo increment the live revision rather than rewinding its number. A new meaningful edit clears redo. Cache/conversation-only writes do not create undo entries. Partial AI output never creates a revision.

UI writes provide `expectedRevision`. IndexedDB checks it inside the same readwrite transaction, so stale tabs cannot silently overwrite newer data. A BroadcastChannel carries only plan/revision/source metadata and provides a reload notice; it is not the concurrency mechanism. Dashboard hydration reads a consistent plan/decision snapshot. Legacy checklist methods also use the shared transaction, and bootstrap `savePlan` refuses to overwrite an event that already has revisioned decisions.

Unknown/corrupt history is reported and preserved, not reset. Missing/deleted plans are not silently recreated by saved tabs. A history-write abort rolls back the plan. A failed follow-up history **read** cannot replay an already committed mutation. Restricted/quota-failed storage keeps validated edits visibly unsaved in the tab; persistent undo/redo is disabled until saving succeeds. Closing such a tab can lose unsaved work. Browser storage does not sync across devices.

## Financial and task invariants

The earlier largest-remainder, integer-minor-unit allocator remains authoritative. Scenario/contingency operations reuse the existing protected-cost, contingency and category-minimum rules; there is no exchange-rate conversion or LLM arithmetic. Booked commitments and linked deposits are not counted twice. Applying a hypothetical does not cancel a booking, refund a deposit or change a payment record. Guest changes do not imply price scaling or a refund.

Comparison uses the current active plan as its baseline, rather than claiming to retain an immutable first-ever plan forever. Undo recovers the previous state within the bounded history. Priorities and changed allocations are displayed without labelling a cheaper alternative “best.” Alternative currency cannot be selected independently of the owning event.

AI-generated initial plans remain limited to 12–20 tasks. A saved plan can now contain up to **60** reviewed tasks and 60 dependency records, allowing additions without discarding legacy work. New IDs come from application code. Duplicate titles, missing/self references, invalid categories, cycles and out-of-window deadlines are rejected. Existing completed tasks cannot be silently edited; the user must reopen one explicitly. Task edits preserve IDs. Deadline changes cannot put unfinished prerequisites after dependent deadlines without reviewing those conflicts first.

The existing O(tasks + edges) dependency inspector is reused. Downstream contingency impact uses an adjacency list and queue, rather than repeated graph searches. Readiness now also identifies dependency deadline conflicts. Historical plans remain readable and are never automatically rescheduled.

## AI architecture and privacy

The four new operations share one typed endpoint:

| Operation               | Relevant context and result                                                                                                                                                               |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `contingency-playbook`  | Hypothetical structured disruption, category/status facts and applicable recorded financial totals → qualitative actions, alternatives, assumptions, limitations and validated references |
| `ask-plan`              | Bounded question and relevant task/category/status facts; finances only when relevant → explanation, ideas, assumptions, limitations and section/task references                          |
| `task-suggestions`      | Category/deadline/completion/dependency metadata → bounded reviewed task proposals; relative dates and final IDs remain application-controlled                                            |
| `invitation-refinement` | Generic event type, tone and length → generic opening/closing prose; dates, guest counts, venue/RSVP information and existing text are excluded                                           |

Private task titles, event titles, vendor names/contacts, guest names/lists, invitation text, backups and payment notes are never automatically added to Phase 3 prompts. Only necessary structured facts and the question/preferences explicitly entered are sent. Obvious phone/email strings are rejected in AI text inputs, but arbitrary names and every possible secret cannot be detected reliably. The UI tells users not to enter sensitive data. Saved conversations are not automatically sent back to Google.

Static trusted instructions and bounded untrusted JSON are separate SDK messages. No model tools, arbitrary URL access, filesystem access, messaging or storage permissions are exposed. Output schemas allow only the requested operation. Unknown references cause the entire new response to be rejected. Client acceptance checks relevant current context and current form preferences again. Stale previews cannot apply changes. Previously saved answers are historical text; they do not become trusted financial facts.

AI prose containing numerals, currency/percentage markers or currency-unit words is rejected. This is a defensive heuristic, not a proof that arbitrary generated language is true. Financial facts and figures are displayed separately from the deterministic engine. An approved qualitative suggestion can become a reviewed task; it cannot rewrite the ledger.

The server-only Gemini 3.5 Flash-Lite configuration and direct `@ai-sdk/google` integration are reused. `streamText` + `Output.object` use the existing provider-friendly schema conversion and full local validation. New operations cap output at **3,000 tokens**. Version-3 NDJSON supports bounded unfinished prose previews, complete results and terminal errors. Preview text is plain text with live announcements disabled; status updates describe actual observed progress. Only complete validated results enter a cache or become reviewable mutations.

The shared HTTP layer retains same-origin checks, JSON content type, a true 16 KiB byte limit, strict schemas, cancellation, a 90-second timeout and at most one transient retry before preview delivery. Long `Retry-After` windows produce user guidance rather than costly immediate retries. Non-JSON platform failures are handled. Provider logs contain only sanitized operational metadata and token/latency measurements.

Validated Phase 3 results use a versioned SHA-256 fingerprint including the owning plan and minimized request. The local cache is bounded at ten entries with a 24-hour TTL; future timestamps, expired entries, changed context and invalid cached references are not reused. Deterministic samples are never cached as AI results. The earlier Phase 2 cache remains separately bounded.

## Portability, sharing and recovery

Existing version-1 and version-2 backups remain readable. Selected-plan backups preserve invitation facts and owned decisions, but omit history, conversations and disposable AI caches. Import creates a new plan with remapped owned IDs and fresh history; it does not merge into another plan. The existing 2 MiB UTF-8 limit, prototype-key rejection and ownership validation remain in place.

Calendar export remains an escaped/folded RFC-oriented all-day event/milestone export; free-text invitation times are not converted into invented timezone offsets. Print views retain saved planning data. Invitation text downloads use temporary local Blob URLs. Native sharing is optional and user initiated; cancellation does not trigger sending or automatic copying. Copy and download remain available when sharing is unsupported.

## Setup and verification

Follow the README with Node 24. Preserve an existing `.env.local`; never replace it with the example when updating. Without a key, create any labelled sample, open advanced planning and use the local calculation/template/sample controls.

The actual command results, test counts, scope of browser/accessibility checks, size, performance and remaining verification limitations belong in [the Phase 3 verification record](phase3-verification.md). Existing coverage thresholds and inclusions are unchanged. New pure business/service modules are included under `src/lib`; UI hooks are additionally exercised by component and browser tests.

Vercel setup stays manual. One endpoint-scoped Hobby WAF rule groups **all three** POST paths under the same target allowance. No account setting is changed automatically. See [deployment instructions](deployment.md).

## Phase 4 audit recommendations

Phase 3 regression checks do not replace an independent final audit. Phase 4 should examine adversarial prompts and context spoofing, every live AI operation/event type, provider/schema drift, current dependency advisories, bundled-secret exposure, deployment timeouts and rate-limit enforcement, worst-case history/quota behavior, assistive technology and 200%/400% zoom, cross-browser native sharing/clipboard/focus, and production latency/bundle measurements. Recheck free-tier access and current platform limits in the actual deployment account. No evaluation score or complete accessibility certification is guaranteed.
