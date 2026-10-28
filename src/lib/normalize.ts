import { allocateBudget } from "@/features/budget/engine";
import { taskDate, today, daysBetween } from "./dates";
import {
  planSchema,
  recommendationsSchema,
  type EventPlan,
} from "@/schemas/plan";
import type { EventInput } from "@/schemas/event";

export function normalizePlan(
  event: EventInput,
  raw: unknown,
  fingerprint: string,
  source: "ai" | "demo",
  clock: () => Date = () => new Date(),
  id = crypto.randomUUID(),
): EventPlan {
  const data = recommendationsSchema.parse(raw);
  const start = today(clock);
  const warnings = [...data.warnings];
  if (daysBetween(start, event.date) < 30)
    warnings.push(
      "Preparation time is limited. Some tasks have been moved to today; prioritise the essentials and confirm feasibility with suppliers.",
    );
  return planSchema.parse({
    schemaVersion: 1,
    id,
    fingerprint,
    source,
    createdAt: clock().toISOString(),
    event,
    overview: data.overview,
    budget: allocateBudget(
      event.eventType,
      event.budgetMinor,
      event.priorities,
    ),
    budgetNotes: data.budgetNotes,
    tasks: data.tasks.map(({ daysBefore, ...task }, index) => ({
      ...task,
      id: `${id}-task-${index + 1}`,
      dueDate: taskDate(event.date, daysBefore, start),
      completed: false,
    })),
    vendors: data.vendors.map(({ daysBefore, ...vendor }, index) => ({
      ...vendor,
      id: `${id}-vendor-${index + 1}`,
      bookingDate: taskDate(event.date, daysBefore, start),
      completed: false,
    })),
    ideas: data.ideas,
    invitations: data.invitations,
    warnings,
  });
}
