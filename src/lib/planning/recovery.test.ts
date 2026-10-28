import { expect, it } from "vitest";
import { assessQuote, recoveryOptions, simulateScenario } from "./finance";
import { plan } from "@/test/fixtures";
import type { VendorQuote } from "@/schemas/finance";
const quote: VendorQuote = {
  id: crypto.randomUUID(),
  planId: plan.id,
  category: "venue",
  displayName: "Recorded supplier",
  quotedMinor: 1200000,
  commitmentMinor: 1000000,
  booking: "booked",
  quoteStatus: "written",
  availability: "unknown",
  notes: "",
  inclusions: [],
  source: "user",
};
it("assesses a changed quote without double-counting its deposit or booking it again", () => {
  const paid = [
    {
      id: crypto.randomUUID(),
      planId: plan.id,
      category: "venue" as const,
      label: "Deposit",
      amountMinor: 200000,
      vendorQuoteId: quote.id,
    },
  ];
  const result = assessQuote(plan, [quote], paid, quote.id, 10);
  expect(result.input.knownCosts[0].minimumMinor).toBe(1200000);
  expect(result.result.protectedMinor).toBe(1200000);
  expect(quote.commitmentMinor).toBe(1000000);
  expect(
    result.result.allocations.reduce((sum, row) => sum + row.amountMinor, 0),
  ).toBe(plan.event.budgetMinor);
});
it("shows deterministic quote pressure and infeasibility rather than fabricated savings", () => {
  const higher = { ...quote, quotedMinor: plan.event.budgetMinor * 2 };
  const result = assessQuote(plan, [higher], [], higher.id, 10);
  expect(result.pressureMinor).toBeGreaterThan(0);
  expect(result.projectedMinor).toBe(
    plan.event.budgetMinor + result.pressureMinor,
  );
  expect(result.result.feasible).toBe(false);
  expect(() => assessQuote(plan, [], [], "missing", 10)).toThrow(
    "existing vendor",
  );
});
it("keeps paid amounts protected when the new quote is lower", () => {
  const paid = [
    {
      id: crypto.randomUUID(),
      planId: plan.id,
      category: "venue" as const,
      label: "Paid",
      amountMinor: 1500000,
      vendorQuoteId: quote.id,
    },
  ];
  expect(
    assessQuote(plan, [quote], paid, quote.id, 0).input.knownCosts[0]
      .minimumMinor,
  ).toBe(1500000);
});
it("builds bounded recovery options with exactly calculated funding", () => {
  const high = { ...quote, commitmentMinor: 60000000 };
  const options = recoveryOptions(plan, [high], [], 10);
  expect(options[1].input.contingencyPercent).toBe(0);
  expect(simulateScenario(plan, options[2].input, [high]).feasible).toBe(true);
  expect(recoveryOptions(plan, [], [], 0)[2].input.totalMinor).toBe(
    plan.event.budgetMinor,
  );
});
