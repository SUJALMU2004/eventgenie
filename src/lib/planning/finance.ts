import { allocateBudget, type Allocation } from "@/features/budget/engine";
import { budgetCategories } from "@/data/templates";
import { vendorCategories } from "@/data/vendor-categories";
import {
  scenarioInputSchema,
  vendorQuoteSchema,
  expenseSchema,
  type Expense,
  type ScenarioInput,
  type VendorQuote,
} from "@/schemas/finance";
import type { EventPlan } from "@/schemas/plan";
import type { Priority } from "@/schemas/event";

export function validateLedger(
  plan: EventPlan,
  quotes: VendorQuote[],
  expenses: Expense[],
) {
  const categoryIds = new Set(
    budgetCategories[plan.event.eventType].map((item) => item.id),
  );
  const vendorIds = new Set(
    vendorCategories(plan.event.eventType).map((item) => item.id),
  );
  if (
    new Set(quotes.map((item) => item.id)).size !== quotes.length ||
    new Set(expenses.map((item) => item.id)).size !== expenses.length
  )
    throw new Error("Duplicate financial record IDs");
  const byId = new Map(
    quotes.map((quote) => [quote.id, vendorQuoteSchema.parse(quote)]),
  );
  for (const quote of quotes)
    if (quote.planId !== plan.id || !vendorIds.has(quote.category))
      throw new Error(
        "Vendor quote belongs to another plan or unsupported category",
      );
  for (const expense of expenses) {
    expenseSchema.parse(expense);
    if (expense.planId !== plan.id || !categoryIds.has(expense.category))
      throw new Error(
        "Payment belongs to another plan or unsupported category",
      );
    if (expense.vendorQuoteId) {
      const quote = byId.get(expense.vendorQuoteId);
      if (!quote || quote.category !== expense.category)
        throw new Error(
          "Payment must reference an existing vendor in the same category",
        );
    }
  }
}
export function financialPosition(
  plan: EventPlan,
  quotes: VendorQuote[],
  expenses: Expense[],
) {
  validateLedger(plan, quotes, expenses);
  const paidByQuote = new Map<string, number>();
  const floors = new Map<Priority, number>();
  const add = (category: Priority, amount: number) =>
    floors.set(category, (floors.get(category) ?? 0) + amount);
  for (const expense of expenses) {
    if (expense.vendorQuoteId)
      paidByQuote.set(
        expense.vendorQuoteId,
        (paidByQuote.get(expense.vendorQuoteId) ?? 0) + expense.amountMinor,
      );
    else add(expense.category, expense.amountMinor);
  }
  let contractualMinor = 0;
  for (const quote of quotes) {
    const commitment = quote.booking === "booked" ? quote.commitmentMinor : 0;
    contractualMinor += commitment;
    add(quote.category, Math.max(commitment, paidByQuote.get(quote.id) ?? 0));
  }
  const paidMinor = expenses.reduce((sum, item) => sum + item.amountMinor, 0);
  const protectedMinor = [...floors.values()].reduce(
    (sum, value) => sum + value,
    0,
  );
  return {
    paidMinor,
    contractualMinor,
    protectedMinor,
    outstandingMinor: protectedMinor - paidMinor,
    uncommittedMinor: Math.max(0, plan.event.budgetMinor - protectedMinor),
    shortfallMinor: Math.max(0, protectedMinor - plan.event.budgetMinor),
    surplusMinor: Math.max(0, plan.event.budgetMinor - protectedMinor),
    floors,
  };
}
export function scenarioDefaults(
  plan: EventPlan,
  contingencyPercent = 10,
): ScenarioInput {
  return {
    totalMinor: plan.event.budgetMinor,
    guests: plan.event.guests,
    priorities: [...plan.event.priorities],
    contingencyPercent,
    knownCosts: [],
  };
}
export type ScenarioResult = {
  feasible: boolean;
  shortfallMinor: number;
  contingencyMinor: number;
  protectedMinor: number;
  allocations: Allocation[];
  comparison: {
    id: string;
    label: string;
    originalMinor: number;
    simulatedMinor: number;
    differenceMinor: number;
    percentDifference: number | null;
  }[];
  warnings: string[];
};
export function simulateScenario(
  plan: EventPlan,
  input: ScenarioInput,
  quotes: VendorQuote[] = [],
  expenses: Expense[] = [],
): ScenarioResult {
  const scenario = scenarioInputSchema.parse(input);
  const categories = budgetCategories[plan.event.eventType];
  if (
    scenario.priorities.some(
      (id) => !categories.some((category) => category.id === id),
    ) ||
    scenario.knownCosts.some(
      (item) => !categories.some((category) => category.id === item.category),
    )
  )
    throw new Error("Choose categories belonging to this event type");
  const position = financialPosition(plan, quotes, expenses);
  for (const cost of scenario.knownCosts)
    position.floors.set(
      cost.category,
      Math.max(position.floors.get(cost.category) ?? 0, cost.minimumMinor),
    );
  const protectedMinor = [...position.floors.values()].reduce(
    (sum, value) => sum + value,
    0,
  );
  const contingencyMinor = allocateBudget(
    plan.event.eventType,
    scenario.totalMinor,
    scenario.priorities,
    scenario.contingencyPercent,
  ).at(-1)!.amountMinor;
  const shortfallMinor = Math.max(
    0,
    protectedMinor + contingencyMinor - scenario.totalMinor,
  );
  const remainder = scenario.totalMinor - protectedMinor - contingencyMinor;
  const shares =
    remainder > 0
      ? allocateBudget(plan.event.eventType, remainder, scenario.priorities, 0)
      : [];
  const allocations: Allocation[] = [
    ...categories.map((category) => ({
      id: category.id,
      label: category.label,
      amountMinor:
        (position.floors.get(category.id) ?? 0) +
        (shares.find((item) => item.id === category.id)?.amountMinor ?? 0),
    })),
    { id: "contingency", label: "Contingency", amountMinor: contingencyMinor },
  ];
  const comparison = allocations.map((item) => {
    const originalMinor =
      plan.budget.find((original) => original.id === item.id)?.amountMinor ?? 0;
    const differenceMinor = item.amountMinor - originalMinor;
    return {
      ...item,
      originalMinor,
      simulatedMinor: item.amountMinor,
      differenceMinor,
      percentDifference: originalMinor
        ? (differenceMinor / originalMinor) * 100
        : null,
    };
  });
  const warnings = [];
  if (shortfallMinor)
    warnings.push(
      "Known costs and the protected contingency exceed this budget. Commitments have not been reduced; this scenario cannot be applied.",
    );
  if (scenario.guests > plan.event.guests)
    warnings.push(
      "More guests share this budget. Confirm meal portions, capacity and supplier quotes; no market prices have been inferred.",
    );
  if (scenario.totalMinor < plan.event.budgetMinor)
    warnings.push(
      "A smaller budget reduces uncommitted allocations. Review existing AI ideas against the revised amounts.",
    );
  return {
    feasible: !shortfallMinor,
    shortfallMinor,
    contingencyMinor,
    protectedMinor,
    allocations,
    comparison,
    warnings,
  };
}
export function compareQuotes(
  plan: EventPlan,
  quotes: VendorQuote[],
  category: Priority,
) {
  const allocation =
    plan.budget.find((item) => item.id === category)?.amountMinor ?? 0;
  const group = quotes.filter((quote) => quote.category === category);
  const lowest = group.length
    ? Math.min(...group.map((quote) => quote.quotedMinor))
    : 0;
  return group.map((quote) => ({
    quote,
    allocationMinor: allocation,
    differenceFromLowestMinor: quote.quotedMinor - lowest,
    overAllocationMinor: Math.max(0, quote.quotedMinor - allocation),
  }));
}

export function recoveryOptions(
  plan: EventPlan,
  quotes: VendorQuote[],
  expenses: Expense[],
  contingencyPercent: number,
) {
  const position = financialPosition(plan, quotes, expenses);
  const denominator = BigInt(100 - contingencyPercent);
  const fundedBudget = Number(
    (BigInt(position.protectedMinor) * 100n + denominator - 1n) / denominator,
  );
  return [
    {
      name: "Protect commitments, rebalance optional spending",
      input: scenarioDefaults(plan, contingencyPercent),
    },
    {
      name: "Preview a zero-contingency recovery",
      input: { ...scenarioDefaults(plan), contingencyPercent: 0 },
    },
    {
      name: "Fund protected costs and the current reserve",
      input: {
        ...scenarioDefaults(plan, contingencyPercent),
        totalMinor: Math.min(
          100000000000,
          Math.max(plan.event.budgetMinor, fundedBudget),
        ),
      },
    },
  ];
}

/** Project a specific entered quote without booking it or counting a linked deposit twice. */
export function assessQuote(
  plan: EventPlan,
  quotes: VendorQuote[],
  expenses: Expense[],
  quoteId: string,
  contingencyPercent: number,
) {
  const quote = quotes.find((item) => item.id === quoteId);
  if (!quote) throw new Error("Select an existing vendor quote");
  const position = financialPosition(plan, quotes, expenses);
  const paid = expenses
    .filter((item) => item.vendorQuoteId === quote.id)
    .reduce((sum, item) => sum + item.amountMinor, 0);
  const currentProtected = Math.max(
    quote.booking === "booked" ? quote.commitmentMinor : 0,
    paid,
  );
  const categoryMinimum =
    (position.floors.get(quote.category) ?? 0) -
    currentProtected +
    Math.max(currentProtected, quote.quotedMinor);
  const input = {
    ...scenarioDefaults(plan, contingencyPercent),
    knownCosts: [{ category: quote.category, minimumMinor: categoryMinimum }],
  };
  const floors = new Map(position.floors);
  floors.set(quote.category, categoryMinimum);
  const projectedMinor = plan.budget.reduce(
    (sum, category) =>
      sum +
      Math.max(category.amountMinor, floors.get(category.id as Priority) ?? 0),
    0,
  );
  return {
    quote,
    input,
    projectedMinor,
    pressureMinor: Math.max(0, projectedMinor - plan.event.budgetMinor),
    result: simulateScenario(plan, input, quotes, expenses),
  };
}
