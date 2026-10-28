import { budgetCategories } from "@/data/templates";
import type { Currency, EventType, Priority } from "@/schemas/event";

export type Allocation = { id: string; label: string; amountMinor: number };
export function currencyDigits(currency: Currency): number {
  return currency === "JPY" ? 0 : 2;
}

/** Parse decimal text directly; floating-point multiplication never touches money. */
export function parseMoney(value: string, currency: Currency): number | null {
  const digits = currencyDigits(currency);
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!match || (match[2]?.length ?? 0) > digits) return null;
  const result = Number(match[1] + (match[2] ?? "").padEnd(digits, "0"));
  return Number.isSafeInteger(result) && result > 0 && result <= 100000000000
    ? result
    : null;
}
export function moneyInput(amountMinor: number, currency: Currency): string {
  return (amountMinor / 10 ** currencyDigits(currency)).toFixed(
    currencyDigits(currency),
  );
}
export function formatMoney(amountMinor: number, currency: Currency): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: currencyDigits(currency),
  }).format(amountMinor / 10 ** currencyDigits(currency));
}

export function allocateBudget(
  eventType: EventType,
  total: number,
  priorities: readonly Priority[] = [],
  contingencyPercent = 10,
): Allocation[] {
  if (!Number.isSafeInteger(total) || total < 1 || total > 100000000000)
    throw new Error("Invalid budget");
  if (
    !Number.isInteger(contingencyPercent) ||
    contingencyPercent < 0 ||
    contingencyPercent > 50
  )
    throw new Error("Invalid contingency");
  const contingency = Math.floor((total * contingencyPercent + 50) / 100);
  const available = total - contingency;
  const categories = budgetCategories[eventType];
  const weighted = categories.map((category) => ({
    ...category,
    weight: category.weight * (priorities.includes(category.id) ? 2 : 1),
  }));
  const weightSum = weighted.reduce((sum, item) => sum + item.weight, 0);
  const shares = weighted.map((category, index) => ({
    ...category,
    index,
    amountMinor: Math.floor((available * category.weight) / weightSum),
    remainder: (available * category.weight) % weightSum,
  }));
  const remainder =
    available - shares.reduce((sum, item) => sum + item.amountMinor, 0);
  // Stable index tie-breaks make largest-remainder allocation reproducible.
  const ranked = [...shares].sort(
    (a, b) => b.remainder - a.remainder || a.index - b.index,
  );
  for (const item of ranked.slice(0, remainder)) item.amountMinor += 1;
  return [
    ...shares.map(({ id, label, amountMinor }) => ({ id, label, amountMinor })),
    { id: "contingency", label: "Contingency", amountMinor: contingency },
  ];
}
