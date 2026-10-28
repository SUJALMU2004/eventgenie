import { z } from "zod";
import { dateSchema, prioritySchema } from "@/schemas/event";
import { localText } from "@/schemas/finance";
import { importanceSchema } from "@/schemas/plan";
import { budgetCategories } from "@/data/templates";
import { today, taskDate } from "@/lib/dates";
import { validateWorkspace, type Workspace } from "./workspace";
import { inspectReadiness } from "./readiness";
export const taskProposalSchema = z
  .object({
    taskId: localText(180).optional(),
    title: localText(120).min(2),
    reason: localText(500).min(1),
    category: prioritySchema,
    dueDate: dateSchema,
    priority: importanceSchema,
    relatedTaskIds: z.array(localText(180)).max(3),
    assumptions: z.array(localText(500)).max(3),
  })
  .strict();
export type TaskProposal = z.infer<typeof taskProposalSchema>;
export function taskCategories(workspace: Workspace) {
  return [
    ...new Set([
      ...budgetCategories[workspace.plan.event.eventType].map(
        (item) => item.id,
      ),
      ...workspace.plan.tasks.map((task) => task.category),
    ]),
  ];
}
export function applyTaskProposal(
  workspace: Workspace,
  raw: TaskProposal,
  clock: () => Date = () => new Date(),
): Workspace {
  const proposal = taskProposalSchema.parse(raw),
    { plan, enhancements } = workspace;
  if (proposal.dueDate < today(clock) || proposal.dueDate > plan.event.date)
    throw new Error("Task deadlines must be between today and the event date.");
  if (!taskCategories(workspace).includes(proposal.category))
    throw new Error("Choose a category for this event type.");
  const existing = proposal.taskId
    ? plan.tasks.find((task) => task.id === proposal.taskId)
    : undefined;
  if (proposal.taskId && !existing)
    throw new Error("The referenced task does not exist in this event.");
  if (existing?.completed)
    throw new Error(
      "Completed tasks are preserved. Reopen the task explicitly before editing it.",
    );
  if (
    plan.tasks.some(
      (task) =>
        task.id !== proposal.taskId &&
        task.title.trim().toLocaleLowerCase() ===
          proposal.title.trim().toLocaleLowerCase(),
    )
  )
    throw new Error("A task with this title already exists.");
  if (
    proposal.relatedTaskIds.some(
      (id) =>
        id === proposal.taskId || !plan.tasks.some((task) => task.id === id),
    )
  )
    throw new Error(
      "Task dependencies must reference other tasks in this event.",
    );
  if (
    proposal.relatedTaskIds.some((id) => {
      const task = plan.tasks.find((item) => item.id === id)!;
      return !task.completed && task.dueDate > proposal.dueDate;
    })
  )
    throw new Error("A task cannot be due before an unfinished prerequisite.");
  if (
    proposal.taskId &&
    enhancements.dependencies.some(
      (edge) =>
        edge.dependsOn.includes(proposal.taskId!) &&
        plan.tasks.some(
          (task) =>
            task.id === edge.taskId &&
            !task.completed &&
            task.dueDate < proposal.dueDate,
        ),
    )
  )
    throw new Error(
      "Review dependent deadlines before delaying their prerequisite.",
    );
  const id = existing?.id ?? `${plan.id}-task-${crypto.randomUUID()}`;
  const task = {
    id,
    title: proposal.title,
    description: proposal.reason,
    category: proposal.category,
    dueDate: proposal.dueDate,
    priority: proposal.priority,
    completed: existing?.completed ?? false,
  };
  const tasks = existing
    ? plan.tasks.map((item) => (item.id === id ? task : item))
    : [...plan.tasks, task];
  const dependencies = [
    ...enhancements.dependencies.filter((edge) => edge.taskId !== id),
    ...(proposal.relatedTaskIds.length
      ? [{ taskId: id, dependsOn: proposal.relatedTaskIds }]
      : []),
  ];
  return validateWorkspace(
    { ...plan, tasks },
    { ...enhancements, dependencies, cache: [] },
  );
}
export function nextActions(
  workspace: Workspace,
  clock: () => Date = () => new Date(),
) {
  const { plan, enhancements } = workspace;
  const readiness = inspectReadiness(
    plan,
    enhancements.quotes,
    enhancements.expenses,
    enhancements.dependencies,
    clock,
  );
  const blocked = new Set(readiness.blocked.map((task) => task.id));
  const priority = { high: 0, medium: 1, low: 2 };
  const tasks = plan.tasks
    .filter((task) => !task.completed && !blocked.has(task.id))
    .sort(
      (a, b) =>
        priority[a.priority] - priority[b.priority] ||
        a.dueDate.localeCompare(b.dueDate),
    )
    .slice(0, 5);
  const type = plan.event.eventType;
  const title =
    type === "wedding"
      ? "Review the indoor ceremony backup"
      : type === "birthday"
        ? "Confirm a backup birthday activity"
        : "Confirm the volunteer backup roster";
  const proposal: TaskProposal = {
    title,
    reason:
      "Agree a practical fallback and name a responsible organiser before the celebration.",
    category:
      type === "community"
        ? "logistics"
        : type === "wedding"
          ? "venue"
          : "entertainment",
    priority: "high",
    dueDate: taskDate(plan.event.date, 7, today(clock)),
    relatedTaskIds: [],
    assumptions: [
      "Availability and arrangements must be confirmed by the organiser.",
    ],
  };
  return {
    readiness,
    tasks,
    proposal:
      plan.tasks.some(
        (task) => task.title.toLowerCase() === title.toLowerCase(),
      ) || plan.event.date < today(clock)
        ? undefined
        : proposal,
  };
}
