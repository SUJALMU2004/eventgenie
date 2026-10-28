# Deployment and operations

EventGenie runs as a Next.js Node application. Hosting is managed separately from repository CI; the workflow installs, checks, builds, and tests the application without publishing it.

## Runtime requirements

- Node.js **24.x**, the committed npm lockfile, and a Next.js-compatible Node runtime.
- Install with `npm ci`, build with `npm run build`, and serve with `npm start`.
- Configure `GOOGLE_GENERATIVE_AI_API_KEY` as a server secret. Set `GEMINI_MODEL` only when overriding the default.
- Allow HTTPS egress to Google's Gemini API and streaming responses to the browser.
- Support the routes' 120-second duration allowance. The application has a 90-second generation timeout.

Builds and labelled samples work without a provider key. The server needs no persistent event filesystem or database; saved plans belong to browser IndexedDB.

## Reverse proxy and browser policy

Preserve browser-facing host information and the request Origin header. The trusted TLS terminator must set or overwrite `x-forwarded-proto`; do not pass arbitrary client values through as trusted protocol metadata. HTTPS responses use one-year HSTS without subdomain/preload commitments. Local HTTP remains usable.

Do not buffer NDJSON responses until completion or cache personalized API responses. Preserve cancellation/disconnect propagation. CSP restricts event-handler attributes, frame loading, base URLs, and connection destinations. Static Next.js hydration retains inline bootstrap script permission; a strict nonce policy would require a separate rendering design.

## Public API abuse protection

Origin validation reduces browser misuse but is not authentication or distributed rate limiting. Protect public AI endpoints at the hosting boundary. Project-wide provider quotas remain independent of per-client limits.

The existing Vercel Hobby reference uses one shared fixed-window WAF rate-limit rule. This is a configuration reference, not an active rule or an instruction executed by CI. Confirm current account allowances in [Vercel's rate-limiting documentation](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting) before configuring it.

| Setting           | Value                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------- |
| Name              | EventGenie generation                                                                                         |
| Path condition    | One “is any of” condition matching `/api/plans/generate`, `/api/plans/enhance`, and `/api/plans/intelligence` |
| Method            | Exactly `POST`                                                                                                |
| Counting key      | Client IP                                                                                                     |
| Target            | Five requests per 60 seconds, shared across the endpoint group                                                |
| Exceeded response | HTTP 429                                                                                                      |

Stage the matching rule in log mode at a generous threshold, such as 30 requests/minute. Test in a preview environment before enforcing the five/minute target. Check that navigation, samples, and local plan operations are unaffected. Review shared-network traffic and monitor legitimate failures; return to logging if necessary.

Vercel counters are regional, so this is not a globally exact quota. Shared IPs can affect legitimate users, and distributed clients can still exhaust a provider project quota. An in-process Map cannot provide deployment-wide enforcement.

## Operational verification

1. Create a sample without a provider request; save, reopen, and update its checklist.
2. With an authorized server key, submit one synthetic AI request and verify progressive delivery and the complete validated plan.
3. Test cancellation, configuration failure, provider quota errors, and non-JSON platform 429 responses.
4. Verify HTTPS security headers and the actual trusted proxy behavior.
5. Inspect narrow layouts and keyboard navigation; confirm no private event text or credentials appear in logs.

Live provider, TLS, and WAF checks must be recorded separately from local mocked tests. See [verification](verification.md).

## Troubleshooting

| Symptom                                      | Check                                                                                                           |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| AI is not configured                         | Add the server-side key, confirm model access, and restart the server. Samples remain available.                |
| “Generate plans from the EventGenie website” | Check browser Origin, host, port, and trusted proxy protocol settings. Do not disable origin checks.            |
| Quota or service error                       | Respect the returned cooldown and try again later or use a labelled sample.                                     |
| No progressive output                        | Check proxy buffering, response content type, and request/function timeout settings.                            |
| Storage failure                              | Keep the tab open; review browser restrictions, quota, and blocked upgrades from other tabs, then retry saving. |
| Saved plan is missing                        | Use the original browser/profile. There is no server-side copy; restore a private backup if available.          |
