# Contributing to EventGenie

Start with the [README](README.md), [product guide](docs/product-guide.md), and [architecture](docs/architecture.md). Use Node.js 24.x and `npm ci` with the committed lockfile. Preserve your existing `.env.local`; samples and ordinary tests require no provider key.

## Development workflow

1. Create a branch for a focused change.
2. Follow the repository's [agent guidance](AGENTS.md) and installed Next.js documentation when changing framework code.
3. Keep interface components, domain rules, storage commands, and AI orchestration separate.
4. Run checks appropriate to the change, then the full quality gates before submitting a code change.
5. Open a pull request explaining the user-visible behavior, relevant implementation choices, validation, and limitations.

## Code conventions

- Use strict TypeScript, meaningful names, type-only imports, and explicit handling of asynchronous failures.
- Format with Prettier and resolve ESLint findings; source functions must remain at complexity 15 or below.
- Reuse shared Zod contracts and domain functions. Keep monetary arithmetic, identifiers, completion state, and approved writes application-controlled.
- Preserve IndexedDB records, revision checks, API protocols, and cache identities unless the change includes an explicit compatibility design.
- Render generated content as text. Keep credentials server-only and logs limited to operational metadata.
- Use labelled semantic controls, visible focus, field-level descriptions, keyboard interactions, and restrained status announcements.
- Document non-obvious recovery behavior and architectural decisions. Update relevant guides when behavior changes.

## Validation

Use the commands in [verification](docs/verification.md). Business, service, or storage changes should include meaningful regressions for the affected behavior. Update existing browser cases when labels or interactions change; retain coverage of their original workflows.

CI checks formatting, lint, types, coverage, production builds, browser/accessibility cases, dependency advisories, credential hygiene, and repository size. It runs without production credentials and does not deploy. Generated artifacts and installed dependencies stay out of Git.

## Issues and security

For a bug report, include the affected workflow, expected and actual behavior, browser/runtime versions, and safe reproduction steps. Use fictional event details. Do not attach private backups, provider keys, contact data, or raw sensitive logs.

Follow [SECURITY.md](SECURITY.md) for suspected vulnerabilities rather than posting exploit details or secrets in a public issue.
