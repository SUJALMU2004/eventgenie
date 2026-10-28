import { z } from "zod";
import type { Workspace } from "./workspace";
import { financialPosition, simulateScenario } from "./finance";
import { inspectReadiness } from "./readiness";
export function compareScenarios(
  workspace: Workspace,
  selection: string[],
  clock: () => Date = () => new Date(),
) {
  const ids = z.array(z.string().uuid()).max(3).parse(selection);
  if (new Set(ids).size !== ids.length)
    throw new Error("Select each alternative once.");
  const { plan, enhancements } = workspace;
  const finance = financialPosition(
    plan,
    enhancements.quotes,
    enhancements.expenses,
  );
  const readiness = inspectReadiness(
    plan,
    enhancements.quotes,
    enhancements.expenses,
    enhancements.dependencies,
    clock,
  );
  const base = {
    id: "current",
    name: "Current plan",
    totalMinor: plan.event.budgetMinor,
    guests: plan.event.guests,
    priorities: plan.event.priorities,
    contingencyMinor: plan.budget.find((item) => item.id === "contingency")!
      .amountMinor,
    allocations: plan.budget,
    feasible:
      finance.protectedMinor +
        (plan.budget.find((item) => item.id === "contingency")?.amountMinor ??
          0) <=
      plan.event.budgetMinor,
    shortfallMinor: Math.max(
      0,
      finance.protectedMinor +
        (plan.budget.find((item) => item.id === "contingency")?.amountMinor ??
          0) -
        plan.event.budgetMinor,
    ),
  };
  const columns = [
    base,
    ...ids.map((id) => {
      const scenario = enhancements.scenarios.find((item) => item.id === id);
      if (!scenario || scenario.planId !== plan.id)
        throw new Error("Scenario is not saved in this event.");
      const result = simulateScenario(
        plan,
        scenario.input,
        enhancements.quotes,
        enhancements.expenses,
      );
      return {
        id,
        name: scenario.name,
        totalMinor: scenario.input.totalMinor,
        guests: scenario.input.guests,
        priorities: scenario.input.priorities,
        contingencyMinor: result.contingencyMinor,
        allocations: result.allocations,
        feasible: result.feasible,
        shortfallMinor: result.shortfallMinor,
      };
    }),
  ];
  return {
    columns: columns.map((column) => ({
      ...column,
      availableMinor: Math.max(
        0,
        column.totalMinor - finance.protectedMinor - column.contingencyMinor,
      ),
    })),
    finance,
    readiness,
    outstanding: plan.tasks.filter((task) => !task.completed).length,
    lowestBudget: Math.min(...columns.map((item) => item.totalMinor)),
    highestReserve: Math.max(...columns.map((item) => item.contingencyMinor)),
  };
}
