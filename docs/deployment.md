# Manual Vercel Hobby deployment and abuse protection

The implementation does not deploy, connect to or change a Vercel account. Follow the README's manual import and environment steps when you choose to deploy.

## One rule for the AI endpoint group

As checked against [Vercel's rate-limiting documentation](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting), Hobby includes one WAF rate-limit rule within three custom firewall rules and an included request allowance. Recheck the current dashboard and plan terms before saving; do not enable a paid feature or billing.

In the project's Firewall dashboard, create a fixed-window rate-limit rule:

| Setting          | Value                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| Name             | EventGenie generation                                                                             |
| Path condition   | One “is any of” condition: `/api/plans/generate`, `/api/plans/enhance`, `/api/plans/intelligence` |
| Method condition | Exactly `POST`                                                                                    |
| Counting key     | Client IP                                                                                         |
| Final target     | 5 allowed requests per 60 seconds                                                                 |
| Exceeded action  | Rate limit / HTTP 429                                                                             |

Use the three allowed paths within one condition, AND the POST method condition. All initial, targeted and Phase 3 operations share the same conservative per-IP allowance; do not create an independent rule per operation. Scope precisely so the landing page, samples and local plan library are unaffected. Do not use an in-process JavaScript Map as a substitute. This is a manual configuration proposal, not evidence that a rule is active.

## Review before enforcing

1. Stage the endpoint match in log mode at a generous threshold (for example 30/minute), and review which traffic matches. Publishing is a manual owner action.
2. Test enforcement in a preview environment first. Confirm the endpoint is throttled while regular navigation, samples and locally saved plans continue to work.
3. Review real traffic and then enforce the conservative 5/minute target for production. Shared office/mobile-network IPs may need adjustment. Monitor the first day and revert to logging or disable the rule if legitimate visitors are affected.
4. Check the response is 429; the app handles non-JSON platform-generated 429 responses too. Vercel counters are regional, so this is not a global hard quota or protection against every distributed attacker.

The free request allowance, Google project quotas and model access can change. Confirm them in the account used for the demo. A project-wide Google quota can still be exhausted by many distinct clients.

## Runtime checks after deployment

- Node 24, Next.js framework preset and Fluid Compute are selected.
- The server-only Gemini key is scoped to the intended environment and not named `NEXT_PUBLIC_*`.
- The generation function supports the configured 120-second duration; application timeout is 90 seconds.
- A sample event works without any Google request.
- One authorised live request streams previews and produces a validated plan. Reload the saved copy and verify checklist persistence.
- No request logs or application metrics reveal event text, credentials or raw provider errors.
- Test a narrow viewport, keyboard navigation, configuration failure and platform 429.

No build, browser test or CI job requires production credentials. CI contains no automatic deployment step.
