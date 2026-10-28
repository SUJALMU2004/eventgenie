# Privacy and local storage

EventGenie has no application accounts, cloud event database, analytics, or automatic device sync. Plans and manual decisions belong to the current browser. AI generation sends necessary request data to Google; browser-only persistence does not mean AI processing stays on the device.

## What stays locally

- Event plans, requirements, wizard drafts, checklist completion, and saved alternatives.
- User-entered supplier quotes, optional contacts, commitments, and paid-amount records.
- Task dependencies, event-day schedules, invitation drafts, verified local invitation details, and saved answers.
- Bounded revision history and validated per-plan AI caches.

The application does not collect a guest list or deliver invitations. Native sharing opens only when explicitly selected. Copy and download provide alternatives when sharing is unavailable.

## What goes to Google

Initial generation sends the requirements submitted through the wizard, including notes. Follow-up operations use only relevant structured context and the bounded text explicitly entered. Event titles, private task titles, supplier contacts, current invitation text, and complete local records are excluded from follow-up prompts. Invitation refinement sends generic event type, tone, and length only.

Avoid sensitive data in notes, preferences, and questions. Google's unpaid API terms permit submitted content and responses to be used for product improvement. Review the [Gemini API terms](https://ai.google.dev/gemini-api/terms) for the data terms applicable to your project. See [AI integration](ai-integration.md) for operation-specific context.

## Storage contracts

IndexedDB database: **`eventgenie-local-v1`**, version **3**.

| Object store   | Record envelope | Purpose                                                                                          |
| -------------- | --------------- | ------------------------------------------------------------------------------------------------ |
| `events`       | Version 1       | Owned event requirements                                                                         |
| `plans`        | Version 1       | Complete validated plans                                                                         |
| `drafts`       | Version 1       | Recoverable setup inputs                                                                         |
| `enhancements` | Version 2       | Quotes, payments, scenarios, dependencies, schedules, and optional schema-version-3 intelligence |
| `history`      | Version 1       | Owned, bounded undo/redo history                                                                 |

Upgrades create missing stores additively. Legacy plans receive decision defaults without rewriting their original records on read. Unknown versions, corruption, and unavailable storage surface visible errors; they are not silently reset. Historical plans remain readable after the event date.

Workspace changes commit the plan, event requirements, enhancements, and history atomically. Expected revisions protect against stale-tab overwrites. Optional cross-tab notifications carry plan/revision/source metadata only. Deleting a selected plan removes its owned records without clearing other events.

## History and recovery

History defaults to 20 changes, configurable from 1 to 30 through repository construction. Undo/redo preserves owned identifiers and increments the live revision. New meaningful edits clear redo. Disposable AI caches and saved conversation content are excluded from history snapshots.

When storage is restricted, blocked, or full, validated changes may remain visibly unsaved in the open tab with retry controls. Persistent undo/redo is unavailable until saving succeeds. Closing the tab can lose unsaved work. Clearing browser data, switching profiles, or changing devices can remove access to saved plans.

## Backups and exports

JSON backups contain one selected event and its decisions, including any private vendor contacts or notes. Disposable caches, history, and saved exchanges are omitted. Files stay local; imports are never uploaded.

Imports accept supported plan-only and workspace backup versions, enforce a **2 MiB UTF-8** limit, reject prototype-related structures, validate ownership/references, and show a preview before confirmation. Restore creates a separate plan with remapped IDs and fresh history. Atomic additions reject collisions instead of merging into existing data.

Calendar export uses escaped, UTF-8-folded RFC-oriented all-day content. Print and text exports contain saved planning information. Protect downloaded files and printed copies as private data.
