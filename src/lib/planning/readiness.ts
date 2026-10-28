import type { EventPlan } from "@/schemas/plan";
import type { Expense, VendorQuote } from "@/schemas/finance";
import type { TaskDependency } from "@/schemas/schedule";
import { vendorCategories } from "@/data/vendor-categories";
import { daysBetween, today } from "@/lib/dates";
import { financialPosition } from "./finance";
import { inspectDependencies } from "./dependencies";
export type ReadinessFinding = {
  ruleId: string;
  severity: "critical" | "attention" | "info";
  message: string;
  taskId?: string;
};
export function inspectReadiness(
  plan: EventPlan,
  quotes: VendorQuote[],
  expenses: Expense[],
  dependencies: TaskDependency[],
  clock: () => Date = () => new Date(),
) {
  const date = today(clock),
    remainingDays = daysBetween(date, plan.event.date);
  const graph = inspectDependencies(plan, dependencies);
  const findings: ReadinessFinding[] = [];
  for (const edge of dependencies) {
    const task = graph.tasks.get(edge.taskId)!;
    if (
      !task.completed &&
      edge.dependsOn.some((id) => {
        const prerequisite = graph.tasks.get(id)!;
        return !prerequisite.completed && prerequisite.dueDate > task.dueDate;
      })
    )
      findings.push({
        ruleId: "RULE_DEPENDENCY_DEADLINE_CONFLICT",
        severity: "attention",
        message: `${task.title} is due before an unfinished prerequisite. Review these deadlines explicitly.`,
        taskId: task.id,
      });
  }
  const overdue = plan.tasks.filter(
    (task) => !task.completed && task.dueDate < date,
  );
  for (const task of overdue)
    findings.push({
      ruleId:
        task.priority === "high"
          ? "RULE_CRITICAL_TASK_OVERDUE"
          : "RULE_TASK_OVERDUE",
      severity: task.priority === "high" ? "critical" : "attention",
      message: `${task.title} was due on ${task.dueDate}.`,
      taskId: task.id,
    });
  for (const task of graph.blocked) {
    const overdueDependencies = (graph.requirements.get(task.id) ?? []).filter(
      (id) => {
        const prerequisite = graph.tasks.get(id)!;
        return !prerequisite.completed && prerequisite.dueDate < date;
      },
    );
    findings.push({
      ruleId: "RULE_DEPENDENCY_BLOCKED",
      severity: overdueDependencies.length ? "critical" : "attention",
      message: `${task.title} has unfinished prerequisites${overdueDependencies.length ? ", including overdue dependencies" : ""}.`,
      taskId: task.id,
    });
  }
  for (const category of vendorCategories(plan.event.eventType))
    if (
      !quotes.some(
        (quote) => quote.category === category.id && quote.booking === "booked",
      ) &&
      !plan.vendors.some(
        (vendor) =>
          vendor.category.toLowerCase() === category.category.toLowerCase() &&
          vendor.completed,
      )
    )
      findings.push({
        ruleId: "RULE_VENDOR_NOT_BOOKED",
        severity: remainingDays <= 14 ? "critical" : "attention",
        message: `${category.category}: no booked quote or completed matching supplier checklist decision.`,
      });
  const finance = financialPosition(plan, quotes, expenses);
  if (finance.shortfallMinor)
    findings.push({
      ruleId: "RULE_BUDGET_SHORTFALL",
      severity: "critical",
      message:
        "Protected commitments and payments exceed the available budget. Open Budget Rescue.",
    });
  if (
    remainingDays >= 0 &&
    remainingDays < 30 &&
    plan.tasks.some((task) => !task.completed)
  )
    findings.push({
      ruleId: "RULE_SHORT_PREPARATION_WINDOW",
      severity: "attention",
      message:
        "Fewer than 30 days remain. Prioritise essential decisions and confirm supplier feasibility.",
    });
  if (remainingDays < 0)
    findings.push({
      ruleId: "RULE_HISTORICAL_EVENT",
      severity: "info",
      message:
        "This event is in the past. Findings describe the recorded plan, not a live readiness guarantee.",
    });
  const upcoming = plan.tasks.filter(
    (task) =>
      !task.completed &&
      task.dueDate >= date &&
      daysBetween(date, task.dueDate) <= 7,
  );
  return {
    remainingDays,
    findings,
    overdue,
    upcoming,
    blocked: graph.blocked,
    status:
      remainingDays < 0
        ? "Historical event"
        : findings.some((item) => item.severity === "critical")
          ? "Critical decisions need attention"
          : findings.length
            ? "A few things to review"
            : "No critical blockers found",
  };
}
