import { describe, expect, it } from "vitest";
import {
  allocateBudget,
  currencyDigits,
  formatMoney,
  moneyInput,
  parseMoney,
} from "./engine";
import { eventTypes } from "@/schemas/event";

describe("deterministic financial allocation", () => {
  it.each(eventTypes)(
    "balances %s budgets across rounding boundaries",
    (type) => {
      for (const total of [
        1, 2, 7, 99, 100, 101, 999, 50000000, 99999999999, 100000000000,
      ])
        for (const percent of [0, 10, 50]) {
          const budget = allocateBudget(
            type,
            total,
            ["catering", "photography"],
            percent,
          );
          expect(budget.reduce((sum, item) => sum + item.amountMinor, 0)).toBe(
            total,
          );
          expect(
            budget.every(
              (item) =>
                Number.isSafeInteger(item.amountMinor) && item.amountMinor >= 0,
            ),
          ).toBe(true);
          expect(new Set(budget.map((item) => item.id)).size).toBe(
            budget.length,
          );
          expect(
            allocateBudget(type, total, ["catering", "photography"], percent),
          ).toEqual(budget);
        }
    },
  );
  it("reserves contingency and gives selected categories extra weight", () => {
    const initial = allocateBudget("wedding", 100000);
    const prioritised = allocateBudget("wedding", 100000, ["catering"]);
    expect(initial.at(-1)?.amountMinor).toBe(10000);
    expect(
      prioritised.find((item) => item.id === "catering")!.amountMinor,
    ).toBeGreaterThan(
      initial.find((item) => item.id === "catering")!.amountMinor,
    );
  });
  it.each([0, -1, 1.1, NaN, Infinity, 100000000001])(
    "rejects invalid total %s",
    (value) => {
      expect(() => allocateBudget("wedding", value)).toThrow("Invalid budget");
    },
  );
  it.each([-1, 51, 1.5])("rejects invalid contingency %s", (value) => {
    expect(() => allocateBudget("birthday", 100, [], value)).toThrow(
      "Invalid contingency",
    );
  });
});
describe("currency-safe input and display", () => {
  it.each([
    ["0.29", "INR", 29],
    ["100", "USD", 10000],
    ["001.1", "EUR", 110],
    ["100", "JPY", 100],
    [" 42.50 ", "GBP", 4250],
  ] as const)("parses %s %s", (text, currency, expected) => {
    expect(parseMoney(text, currency)).toBe(expected);
  });
  it.each([
    "",
    "-1",
    "1e3",
    "1,000",
    "0",
    "0.001",
    "NaN",
    "1000000001",
    "90071992547409999",
  ])("rejects invalid decimal %s", (value) => {
    expect(parseMoney(value, "INR")).toBeNull();
  });
  it("rejects fractional JPY without converting anything", () => {
    expect(parseMoney("1.1", "JPY")).toBeNull();
    expect(currencyDigits("JPY")).toBe(0);
    expect(currencyDigits("INR")).toBe(2);
    expect(moneyInput(129, "INR")).toBe("1.29");
    expect(moneyInput(129, "JPY")).toBe("129");
    expect(formatMoney(129, "INR")).toContain("1.29");
    expect(formatMoney(129, "JPY")).toContain("129");
  });
});
