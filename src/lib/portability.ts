import { z } from "zod";
import { planSchema, type EventPlan } from "@/schemas/plan";
import { enhancementSchema, emptyEnhancements } from "@/schemas/enhancements";
import { validateWorkspace, type Workspace } from "./planning/workspace";
import { addDays } from "./dates";
export const MAX_BACKUP_BYTES = 2 * 1024 * 1024;
const backupSchema = z
  .object({
    backupVersion: z.literal(2),
    exportedAt: z.string().datetime(),
    plan: planSchema,
    enhancements: enhancementSchema,
  })
  .strict();
const legacyBackupSchema = z
  .object({
    backupVersion: z.literal(1),
    exportedAt: z.string().datetime(),
    plan: planSchema,
  })
  .strict();
function rejectPrototypeKeys(value: unknown) {
  const queue: unknown[] = [value];
  for (let index = 0; index < queue.length; index++) {
    const item = queue[index];
    if (typeof item !== "object" || item === null) continue;
    for (const [key, child] of Object.entries(item)) {
      if (["__proto__", "prototype", "constructor"].includes(key))
        throw new Error(
          "Prototype-related structures are not allowed in backups",
        );
      queue.push(child);
    }
  }
}
export function createBackup(
  workspace: Workspace,
  clock: () => Date = () => new Date(),
): string {
  const valid = validateWorkspace(workspace.plan, workspace.enhancements);
  // Cached AI results are disposable; export only selected event decisions.
  return JSON.stringify(
    {
      backupVersion: 2,
      exportedAt: clock().toISOString(),
      plan: valid.plan,
      enhancements: {
        ...valid.enhancements,
        cache: [],
        ...(valid.enhancements.intelligence
          ? {
              intelligence: {
                ...valid.enhancements.intelligence,
                cache: [],
                exchanges: [],
              },
            }
          : {}),
      },
    },
    null,
    2,
  );
}
export function parseBackup(text: string): Workspace {
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES)
    throw new Error("Backup files must be 2 MiB or smaller");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("This file is not valid JSON");
  }
  rejectPrototypeKeys(raw);
  const modern = backupSchema.safeParse(raw);
  if (modern.success)
    return validateWorkspace(modern.data.plan, modern.data.enhancements);
  const legacy = legacyBackupSchema.safeParse(raw);
  if (legacy.success)
    return validateWorkspace(
      legacy.data.plan,
      emptyEnhancements(legacy.data.plan.id),
    );
  throw new Error(
    "Unsupported backup version, corrupted records or invalid event data",
  );
}
/** Always import a new event. Remap every owned ID/reference rather than silently merging. */
export function cloneImportedWorkspace(
  workspace: Workspace,
  clock: () => Date = () => new Date(),
): Workspace {
  const original = validateWorkspace(workspace.plan, workspace.enhancements);
  const id = crypto.randomUUID();
  const taskIds = new Map(
    original.plan.tasks.map((task) => [
      task.id,
      `${id}-task-${crypto.randomUUID()}`,
    ]),
  );
  const quoteIds = new Map(
    original.enhancements.quotes.map((quote) => [
      quote.id,
      crypto.randomUUID(),
    ]),
  );
  const plan = {
    ...structuredClone(original.plan),
    id,
    tasks: original.plan.tasks.map((task) => ({
      ...task,
      id: taskIds.get(task.id)!,
    })),
    vendors: original.plan.vendors.map((vendor) => ({
      ...vendor,
      id: `${id}-vendor-${crypto.randomUUID()}`,
    })),
  };
  const enhancements = {
    ...structuredClone(original.enhancements),
    planId: id,
    revision: 0,
    importedAt: clock().toISOString(),
    ...(original.enhancements.intelligence
      ? {
          intelligence: {
            ...original.enhancements.intelligence,
            cache: [],
            exchanges: [],
          },
        }
      : {}),
    quotes: original.enhancements.quotes.map((quote) => ({
      ...quote,
      id: quoteIds.get(quote.id)!,
      planId: id,
    })),
    expenses: original.enhancements.expenses.map((expense) => ({
      ...expense,
      id: crypto.randomUUID(),
      planId: id,
      ...(expense.vendorQuoteId
        ? { vendorQuoteId: quoteIds.get(expense.vendorQuoteId)! }
        : {}),
    })),
    scenarios: original.enhancements.scenarios.map((scenario) => ({
      ...scenario,
      id: crypto.randomUUID(),
      planId: id,
    })),
    dependencies: original.enhancements.dependencies.map((edge) => ({
      taskId: taskIds.get(edge.taskId)!,
      dependsOn: edge.dependsOn.map((taskId) => taskIds.get(taskId)!),
    })),
    adoptedRescue: original.enhancements.adoptedRescue.map((item) => ({
      ...item,
      recommendationId: crypto.randomUUID(),
    })),
    cache: [],
    ...(original.enhancements.schedule
      ? {
          schedule: {
            ...original.enhancements.schedule,
            activities: original.enhancements.schedule.activities.map(
              (item) => ({
                ...item,
                id: crypto.randomUUID(),
                taskId: item.taskId ? taskIds.get(item.taskId)! : null,
              }),
            ),
          },
        }
      : {}),
  };
  return validateWorkspace(plan, enhancements);
}
export function escapeCalendarText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\n|\r/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}
/** RFC 5545 folds content lines at 75 UTF-8 octets, never splitting a code point. */
export function foldCalendarLine(value: string): string {
  let result = "",
    octets = 0;
  for (const character of value) {
    const length = new TextEncoder().encode(character).length;
    if (octets + length > 75) {
      result += "\r\n ";
      octets = 1;
    }
    result += character;
    octets += length;
  }
  return result;
}
function calendarUid(value: string): string {
  try {
    return `uri-${encodeURIComponent(value)}`;
  } catch {
    let units = "";
    for (let index = 0; index < value.length; index++)
      units += value.charCodeAt(index).toString(16).padStart(4, "0");
    return `utf16-${units}`;
  }
}
export function createCalendar(
  plan: EventPlan,
  includeTasks = true,
  clock: () => Date = () => new Date(),
): string {
  planSchema.parse(plan);
  const date = (value: string) => value.replaceAll("-", "");
  const stamp = clock()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  const entries = [
    {
      id: plan.id,
      date: plan.event.date,
      title: plan.event.title,
      description: `Event in ${plan.event.city}. Check local arrangements with your host.`,
    },
    ...(includeTasks
      ? plan.tasks.map((task) => ({
          id: task.id,
          date: task.dueDate,
          title: task.title,
          description: task.description,
        }))
      : []),
  ];
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EventGenie//Celebration Planner//EN",
    "CALSCALE:GREGORIAN",
    ...entries.flatMap((entry) => [
      "BEGIN:VEVENT",
      `UID:${calendarUid(entry.id)}@eventgenie.local`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${date(entry.date)}`,
      `DTEND;VALUE=DATE:${date(addDays(entry.date, 1))}`,
      `SUMMARY:${escapeCalendarText(entry.title)}`,
      `DESCRIPTION:${escapeCalendarText(entry.description)}`,
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
  ];
  return lines.map(foldCalendarLine).join("\r\n") + "\r\n";
}
