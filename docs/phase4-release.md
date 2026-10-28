# EventGenie AI release and submission guide

This guide accompanies the [Phase 4 audit](phase4-audit.md) and [evaluation matrix](phase4-evaluation-matrix.md). It is a reproducible source-code handoff, not an external score certificate.

## Requirements and setup

Use Node **24.x**, npm and the committed lockfile. Existing stack: Next.js App Router, strict TypeScript, React, Tailwind, Zod, AI SDK/direct Google provider, IndexedDB, Vitest/RTL and Playwright/axe. No account, hosted database, payment service or paid integration is required.

```powershell
git clone https://github.com/SUJALMU2004/eventgenie.git
cd eventgenie
npm ci
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm run dev
```

Open `http://localhost:3000`. Choose any clearly labelled sample on the landing page or review step to try all event types without a Gemini key. Open a saved plan, then **Open advanced planning** for Phase 3. Preserve existing `.env.local`; never replace a working secret with the example or upload it to GitHub.

## Environment and privacy

`GOOGLE_GENERATIVE_AI_API_KEY` is server-only and optional for samples/tests/builds. `GEMINI_MODEL` optionally overrides the default `gemini-3.5-flash-lite`. Do not rename credentials to `NEXT_PUBLIC_*` or put them in Next's public `env` configuration. Use eligible free-tier access; the application cannot determine or alter a Google project's billing status. [Google pricing](https://ai.google.dev/gemini-api/docs/pricing) lists free tokens and product-improvement processing for the selected model's free tier; access/quotas depend on the actual project.

Initial generation sends necessary bounded requirements. Targeted requests minimize context and omit private vendor contacts, full invitation text and full saved libraries. Questions/preferences are explicitly user-entered; do not enter unnecessary personal data. Plans, manual quotes/payments, history and retained answers stay in the current browser. No analytics, messaging delivery or server database is introduced. Clearing browser data can remove local plans; private downloaded backups may contain contact notes and should be protected.

## Exact local verification commands

Run heavyweight stages sequentially on small machines:

```powershell
npm ci
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run test:coverage
$env:GOOGLE_GENERATIVE_AI_API_KEY=''
npm run build
Remove-Item Env:GOOGLE_GENERATIVE_AI_API_KEY
npm run security:check
npm run security:bundle
npx playwright install chromium
npm run test:e2e
npm run audit
npm run size:check
git diff --check
```

The temporary PowerShell key override proves the build is key-free and does not edit `.env.local`; remove it before a manual live request. If the shell already had a deliberate credential override, preserve and restore that shell value instead. CI does not create or need local credentials. On Linux use `npx playwright install --with-deps chromium`. Browser tests start a no-key production server at port **3100**, so build first and keep that port free.

For production preview, use `npm run build` then `npm start`. The four-worker unit limit does not weaken test timeouts or coverage. Report output rather than guessing counts. Coverage, traces, screenshots, dependencies and build artifacts remain ignored.

## Security configuration

- All three AI POST endpoints share actual-byte 16 KiB reading, a 10-second upload deadline, origin checks, strict inputs, a 90-second generation timeout and bounded retry/token settings. Requests have no model tools or direct mutation permissions.
- Successful candidates are fully validated and the provider must terminate cleanly before a `complete` frame is emitted. Only complete results can be persisted. The client rejects interrupted/malformed/oversized streams.
- `security:check` examines source and staged data plus credential indicators in available Git history. `security:bundle` additionally scans built client JS and compares the exact configured local key without printing it. Pattern scans cannot identify every possible secret.
- Security headers restrict framing, objects, referrers, device permissions and production eval. Inline Next script/style compatibility remains documented; no strict nonce-CSP certification is claimed.
- CI uses read-only contents permission, immutable official action commits and no persisted checkout credential. Dependabot proposes action updates for review; it does not auto-merge or deploy.

## Hosting boundary and rate limiting

**The owner explicitly requested no Vercel deployment or linking. None is performed.** For a separately authorized future deployment, existing [manual hosting instructions](deployment.md) document the Next/Node preset, server-only variables, streaming and duration checks. They are reference only, not active account configuration.

The reference rule is **one shared fixed-window rule**, matching POST on `/api/plans/generate`, `/api/plans/enhance` or `/api/plans/intelligence`, counted by client IP, targeting **five requests per 60 seconds** with HTTP 429. [Vercel's official rule limits](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting) document one Hobby rate-limit rule. No distributed enforcement, active WAF or global quota is claimed. Stage in logging, verify scoped preview enforcement and legitimate traffic, then let the owner decide production enforcement. Do not substitute a per-process counter for distributed controls.

## Troubleshooting

| Symptom                                            | Action                                                                                                                                                    |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| “Generate plans from the EventGenie website”       | Use the application's own origin. Host/port must match the browser-facing origin; do not spoof forwarded hosts. Loopback development cases are tested.    |
| Missing AI configuration or provider authorization | Check the ignored server key and optional model; restart the local server after changes. Never paste credentials into an issue. Samples remain available. |
| 429 / provider overload                            | Respect the displayed retry window, or use a labelled sample. No billing change or infinite retry is attempted.                                           |
| Timeout / interrupted stream                       | Inputs remain available; incomplete results are not saved. Retry or use a sample. Slow uploads now terminate too.                                         |
| Another tab changed the event                      | Reload the saved revision before applying changes; review open drafts again.                                                                              |
| Quota/restricted IndexedDB                         | Keep the tab open, use backup/download, retry saving when available. Persistent undo is disabled while changes remain unsaved.                            |
| Advisory service cannot be reached                 | Run `npm run audit` in a normal networked terminal or CI. A request failure does not establish a clean dependency tree.                                   |
| UI test timeouts under heavy load                  | Run the documented stages sequentially; four workers are configured. Do not skip failing tests or lower coverage.                                         |

## Submission checklist

1. Read the measured audit and unresolved external limitations. Confirm local commands and the repository workflow outcome.
2. Submit the complete source, docs, tests, `.env.example`, lockfile and workflow. Include all Phase 2–4 files; generated/install artifacts and `.env.local` must remain excluded.
3. Supply the repository URL and a sample walkthrough: wedding, birthday, community; generate/sample, save/reopen, checklists, decisions, comparison/contingency, assistant/task/invitation review, undo/redo and local export.
4. Explain AI-generated suggestions versus recorded facts and deterministic financial calculations. Vendor categories are planning checklists, not fabricated real businesses.
5. Keep screen-reader/actual browser zoom, untested live operations, deployment/WAF and any unavailable remote checks explicitly qualified. Do not promise a guaranteed score.

The owner has authorized a source commit/push to the named GitHub repository. This authorization does not extend to deployment, Vercel configuration, publishing credentials or enabling paid services.
