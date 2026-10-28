"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { budgetCategories } from "@/data/templates";
import { expenseSchema } from "@/schemas/finance";
import { formatMoney, parseMoney } from "@/features/budget/engine";
import type { Priority } from "@/schemas/event";
import type { DecisionProps } from "./types";
export function PaymentRecords({
  workspace,
  update,
  busy,
  confirm,
}: DecisionProps) {
  const { plan, enhancements } = workspace;
  const [label, setLabel] = useState(""),
    [amount, setAmount] = useState(""),
    [vendorId, setVendorId] = useState(""),
    [category, setCategory] = useState<Priority>(
      budgetCategories[plan.event.eventType][0].id,
    ),
    [error, setError] = useState("");
  return (
    <div className="payment-records">
      <h3>Amounts actually paid</h3>
      <p className="small-text muted">
        Manual records only; no payment is sent. Link a deposit to its quote so
        it is included in, rather than added to, that vendor’s commitment.
      </p>
      <form
        className="no-print"
        onSubmit={(event) => {
          event.preventDefault();
          const amountMinor = parseMoney(amount, plan.event.currency);
          const parsed = expenseSchema.safeParse({
            id: crypto.randomUUID(),
            planId: plan.id,
            category,
            label,
            amountMinor,
            ...(vendorId ? { vendorQuoteId: vendorId } : {}),
          });
          if (!parsed.success) {
            setError(
              "Enter a label, valid positive amount and matching category/vendor.",
            );
            return;
          }
          void update((current) => ({
            ...current,
            enhancements: {
              ...current.enhancements,
              expenses: [...current.enhancements.expenses, parsed.data],
              cache: [],
            },
          })).then((success) => {
            if (success) {
              setLabel("");
              setAmount("");
              setError("");
            }
          });
        }}
      >
        <div className="form-grid">
          <label>
            Payment label
            <input
              value={label}
              maxLength={100}
              required
              onChange={(event) => setLabel(event.target.value)}
            />
          </label>
          <label>
            Amount actually paid ({plan.event.currency})
            <input
              value={amount}
              inputMode="decimal"
              required
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>
          <label>
            Payment category
            <select
              value={category}
              onChange={(event) =>
                setCategory(
                  budgetCategories[plan.event.eventType].find(
                    (item) => item.id === event.target.value,
                  )!.id,
                )
              }
            >
              {budgetCategories[plan.event.eventType].map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Link payment to vendor
            <select
              value={vendorId}
              onChange={(event) => {
                setVendorId(event.target.value);
                const vendor = enhancements.quotes.find(
                  (item) => item.id === event.target.value,
                );
                if (vendor) setCategory(vendor.category);
              }}
            >
              <option value="">Unlinked payment</option>
              {enhancements.quotes.map((quote) => (
                <option value={quote.id} key={quote.id}>
                  {quote.displayName}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error ? (
          <p role="alert" className="error-notice">
            {error}
          </p>
        ) : null}
        <Button disabled={busy} size="small" type="submit">
          Record payment
        </Button>
      </form>
      {enhancements.expenses.length ? (
        <ul className="payment-list">
          {enhancements.expenses.map((expense) => (
            <li key={expense.id}>
              <span>
                {expense.label} · {expense.category} ·{" "}
                {formatMoney(expense.amountMinor, plan.event.currency)}
                {expense.vendorQuoteId ? " · linked to vendor" : " · unlinked"}
              </span>
              {expense.vendorQuoteId ? (
                <Button
                  variant="ghost"
                  size="small"
                  onClick={() =>
                    confirm({
                      title: "Detach this payment from its vendor?",
                      description:
                        "The amount remains recorded as an independent expense in the same category. Review the remaining contractual commitment to avoid counting separate obligations incorrectly.",
                      action: () =>
                        update((current) => ({
                          ...current,
                          enhancements: {
                            ...current.enhancements,
                            expenses: current.enhancements.expenses.map(
                              (item) => {
                                if (item.id !== expense.id) return item;
                                const { vendorQuoteId, ...detached } = item;
                                void vendorQuoteId;
                                return detached;
                              },
                            ),
                            cache: [],
                          },
                        })),
                    })
                  }
                >
                  Detach {expense.label}
                </Button>
              ) : null}
              <Button
                size="small"
                variant="ghost"
                onClick={() =>
                  confirm({
                    title: "Remove this payment record?",
                    description:
                      "This removes only the manually entered paid amount. It does not cancel a vendor commitment or reverse a real-world payment.",
                    action: () =>
                      update((current) => ({
                        ...current,
                        enhancements: {
                          ...current.enhancements,
                          expenses: current.enhancements.expenses.filter(
                            (item) => item.id !== expense.id,
                          ),
                          cache: [],
                        },
                      })),
                  })
                }
              >
                Remove {expense.label}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small-text">No payments recorded.</p>
      )}
    </div>
  );
}
