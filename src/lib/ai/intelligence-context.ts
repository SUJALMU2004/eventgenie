import type { Workspace } from "@/lib/planning/workspace";
import type { IntelligenceRequest } from "@/schemas/intelligence";
import { vendorCategories } from "@/data/vendor-categories";
import { today } from "@/lib/dates";
import { financialPosition } from "@/lib/planning/finance";
import { inspectDependencies } from "@/lib/planning/dependencies";
import { nextActions, taskCategories } from "@/lib/planning/task-workflows";
import {
  exactFinancialQuestion,
  type IntelligenceOptions,
} from "./intelligence-contracts";
import { validateIntelligenceRequest } from "./intelligence-input";
export function taskReferences(workspace: Workspace) {
  return new Map(
    workspace.plan.tasks.map((task, index) => [`task-${index + 1}`, task.id]),
  );
}
export function planFacts(
  workspace: Workspace,
  question: string,
  clock: () => Date = () => new Date(),
) {
  const { plan, enhancements } = workspace,
    finance = financialPosition(
      plan,
      enhancements.quotes,
      enhancements.expenses,
    ),
    actions = nextActions(workspace, clock);
  const guestMatch = question.match(
    /\b(\d{1,4})\s+(?:extra|more|additional)\s+guests?/i,
  );
  return {
    finance,
    readiness: actions.readiness,
    tasks: actions.tasks,
    extraGuestTotal:
      guestMatch && plan.event.guests + Number(guestMatch[1]) <= 10000
        ? plan.event.guests + Number(guestMatch[1])
        : undefined,
  };
}

function needsTaskContext(options: IntelligenceOptions) {
  if (
    options.operation === "task-suggestions" ||
    options.contingency?.kind === "task-delay"
  )
    return true;
  const question = options.question ?? "";
  return (
    options.operation === "ask-plan" &&
    /task|week|urgent|finish|prepar|deadline|simplify|priority|blocked/i.test(
      question,
    ) &&
    !exactFinancialQuestion(question)
  );
}
function needsFinancialContext(options: IntelligenceOptions) {
  return (
    options.operation === "contingency-playbook" ||
    (options.operation === "ask-plan" &&
      /budget|money|cost|fund|spen|guest|attend|paid|commit/i.test(
        options.question ?? "",
      ))
  );
}
function needsVendorContext(options: IntelligenceOptions) {
  return (
    options.operation === "contingency-playbook" ||
    (options.operation === "ask-plan" &&
      /vendor|supplier|caterer/i.test(options.question ?? ""))
  );
}
function sectionReferences(options: IntelligenceOptions, financial: boolean) {
  switch (options.operation) {
    case "invitation-refinement":
      return ["invitations"];
    case "contingency-playbook":
      return ["budget", "vendors", "timeline", "schedule"];
    case "task-suggestions":
      return ["timeline", "vendors"];
    case "ask-plan":
      if (financial) return ["budget", "vendors"];
      return /vendor|supplier|caterer/i.test(options.question ?? "")
        ? ["vendors"]
        : ["overview", "timeline", "schedule"];
  }
}
function taskContext(
  workspace: Workspace,
): IntelligenceRequest["context"]["tasks"] {
  const graph = inspectDependencies(
    workspace.plan,
    workspace.enhancements.dependencies,
  );
  const blocked = new Set(graph.blocked.map((task) => task.id));
  return workspace.plan.tasks.map((task, index) => ({
    ref: "task-" + (index + 1),
    category: task.category,
    priority: task.priority,
    dueDate: task.dueDate,
    completed: task.completed,
    blocked: blocked.has(task.id),
  }));
}
function vendorContext({ plan, enhancements }: Workspace) {
  return vendorCategories(plan.event.eventType).map((category) => ({
    category: category.id,
    recordedBookedCount: enhancements.quotes.filter(
      (quote) => quote.category === category.id && quote.booking === "booked",
    ).length,
    checklistConfirmed: plan.vendors.some(
      (vendor) =>
        vendor.completed &&
        vendor.category.toLowerCase() === category.category.toLowerCase(),
    ),
  }));
}
function financialContext({ plan, enhancements }: Workspace) {
  const finance = financialPosition(
    plan,
    enhancements.quotes,
    enhancements.expenses,
  );
  return {
    budgetMinor: plan.event.budgetMinor,
    paidMinor: finance.paidMinor,
    protectedMinor: finance.protectedMinor,
    availableMinor: finance.uncommittedMinor,
    shortfallMinor: finance.shortfallMinor,
  };
}
/** Relevant structured facts only: private titles, contacts and notes stay local. */
function buildContext(
  workspace: Workspace,
  options: IntelligenceOptions,
  clock: () => Date,
): IntelligenceRequest["context"] {
  const { plan } = workspace;
  if (options.operation === "invitation-refinement")
    return {
      eventType: plan.event.eventType,
      references: ["invitations"],
      tasks: [],
      categories: [],
      priorities: [],
      vendors: [],
    };
  const tasks = needsTaskContext(options) ? taskContext(workspace) : [];
  const financial = needsFinancialContext(options);
  return {
    eventType: plan.event.eventType,
    eventDate: plan.event.date,
    today: today(clock),
    guests: plan.event.guests,
    currency: plan.event.currency,
    references: [
      ...sectionReferences(options, financial),
      ...tasks.map((task) => task.ref),
    ],
    tasks,
    categories: taskCategories(workspace),
    priorities: plan.event.priorities,
    vendors: needsVendorContext(options) ? vendorContext(workspace) : [],
    ...(financial ? { finances: financialContext(workspace) } : {}),
  };
}
function contingencyContext(
  workspace: Workspace,
  options: IntelligenceOptions,
) {
  if (!options.contingency) return {};
  const { taskId, ...contingency } = options.contingency;
  const index = taskId
    ? workspace.plan.tasks.findIndex((task) => task.id === taskId)
    : -1;
  if (taskId && index < 0)
    throw new Error("Task belongs to another event or was removed.");
  return {
    contingency: {
      ...contingency,
      ...(taskId ? { taskRef: "task-" + (index + 1) } : {}),
    },
  };
}
export function buildIntelligenceRequest(
  workspace: Workspace,
  options: IntelligenceOptions,
  clock: () => Date = () => new Date(),
): IntelligenceRequest {
  return validateIntelligenceRequest({
    operation: options.operation,
    question: options.question ?? "",
    preferences: options.preferences ?? "",
    context: buildContext(workspace, options, clock),
    ...contingencyContext(workspace, options),
    ...(options.tone ? { tone: options.tone } : {}),
    ...(options.length ? { length: options.length } : {}),
  });
}
