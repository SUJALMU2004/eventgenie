# AI integration

EventGenie uses Google's direct Gemini API through `@ai-sdk/google`. The shared server-only adapter is `src/lib/ai/structured.ts`; the model defaults to `gemini-3.5-flash-lite` and can be changed through `GEMINI_MODEL`. Credentials remain on the server.

## Endpoints and contracts

All endpoints accept JSON through `POST` and return typed newline-delimited JSON. Their contracts are shared with the browser through Zod schemas.

| Endpoint                  | Operations                                                                      | Output budget | Stream contract              |
| ------------------------- | ------------------------------------------------------------------------------- | ------------- | ---------------------------- |
| `/api/plans/generate`     | Complete event blueprint from validated requirements                            | 8,000 tokens  | Initial unversioned protocol |
| `/api/plans/enhance`      | `rescue-ideas`, `day-of-schedule`, `refine-section`                             | 4,000 tokens  | Version 2                    |
| `/api/plans/intelligence` | `ask-plan`, `task-suggestions`, `contingency-playbook`, `invitation-refinement` | 3,000 tokens  | Version 3                    |

Each stream contains `preview`, `complete`, or `error` frames. The initial contract is defined in `src/schemas/plan.ts`; targeted and contextual contracts are in `operations.ts` and `intelligence.ts` under `src/schemas`.

## Generation lifecycle

1. Validate browser origin context, JSON content type, actual request bytes, and the strict operation-specific schema.
2. Build bounded relevant context, separated from trusted system instructions.
3. Call `streamText` with `Output.object` and consume `partialOutputStream`.
4. Emit only schema-valid sections/items or bounded prose previews supported by that operation. Progress reflects received data.
5. Await final output and provider-stream termination, validate the full result, and normalize application-owned fields.
6. Send a complete frame. The client validates every frame and permits persistence or reviewed acceptance only for a complete result.

`output-schema.ts` caches a provider-friendly structured-decoding schema. Full local validation remains authoritative for bounds, references, financial restrictions, and domain rules. The model has no tools, filesystem access, messaging permissions, or storage mutation capability.

## Context and privacy

| Operation                           | Context sent                                                                                                                            |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Initial blueprint                   | The requirements explicitly submitted in the wizard, including entered notes                                                            |
| Targeted decisions                  | Event/category facts, financial category totals, the applicable time window, and bounded preferences; private original text stays local |
| Plan questions and task suggestions | Relevant category, date, priority, completion, and dependency metadata, plus the explicit question/preferences                          |
| Contingency advice                  | The selected hypothetical disruption and relevant recorded category/status/financial facts                                              |
| Invitation refinement               | Generic event type, tone, and length; existing invitation text, venue/RSVP details, guest count, and event dates stay local             |

Follow-up context excludes event titles, private task titles, vendor names/contacts, guest lists, backups, and full local records. Saved answers are not automatically replayed as conversation context. Email/phone patterns are rejected in bounded AI text fields, but arbitrary names and secrets cannot be identified reliably. Users must avoid sensitive free text.

AI produces suggestions and explanations. Exact budget questions are answered by deterministic local calculations. Qualitative follow-up outputs reject financial/numeric claims and unknown references. Acceptance checks current relevant context and the target section again, preventing stale proposals from applying changes.

## Reliability and cancellation

- Actual body limit: **16 KiB**, including chunked requests; upload deadline: **10 seconds**.
- Generation timeout: **90 seconds**; Node route duration allowance: **120 seconds**.
- SDK retries: disabled. One automatic transient retry is permitted before preview delivery, with a delay of at most two seconds. Longer `Retry-After` guidance is shown to the user.
- Request aborts propagate to the provider. Partial, interrupted, malformed, or post-completion data cannot become a saved complete result.
- The client bounds cumulative stream data at 8 MiB and individual buffered lines at 1,000,000 characters, with streaming UTF-8 decoding.
- Before streaming, failures use JSON error responses. After streaming begins, failures use terminal error frames. Platform-generated non-JSON errors have explicit fallbacks.

Operational logs contain sanitized error classifications, status codes, duration, and token counts. Raw SDK errors, prompts, event text, and credentials are not logged or returned.

## Local reuse and samples

Initial AI plans can be reused only for identical validated input fingerprints in the current browser. Samples remain distinguishable and are excluded from AI reuse.

Targeted and contextual operations retain separate versioned, plan-owned caches, each bounded at ten entries with a 24-hour TTL. Cached output is validated again. Expired/future entries, invalid references, changed context, or a different owning event prevent reuse. Changes invalidate relevant cached results. Cache hits make no provider request.

Samples use deterministic templates, carry explicit labels, and require no key. Tests mock both provider/SDK and HTTP boundaries. Live model behavior is a separate verification step; see [verification](verification.md).
