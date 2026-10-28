"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { vendorCategories } from "@/data/vendor-categories";
import { compareQuotes } from "@/lib/planning/finance";
import { saveVendor, deleteVendor } from "@/lib/planning/vendors";
import { formatMoney } from "@/features/budget/engine";
import type { VendorQuote } from "@/schemas/finance";
import { DecisionPanel, type DecisionProps } from "./types";
import { VendorForm } from "./vendor-form";
export function VendorPanel({
  workspace,
  update,
  confirm,
  busy,
}: DecisionProps) {
  const { plan, enhancements } = workspace;
  const [editing, setEditing] = useState<VendorQuote | "new">();
  const [category, setCategory] = useState(
    () => vendorCategories(plan.event.eventType)[0].id,
  );
  function save(quote: VendorQuote) {
    const action = async () => {
      const success = await update((current) => saveVendor(current, quote));
      if (success) setEditing(undefined);
      return success;
    };
    const previous = enhancements.quotes.find((item) => item.id === quote.id);
    if (quote.booking === "booked" || previous?.booking === "booked")
      confirm({
        title: "Save this vendor decision?",
        description: `This records a ${quote.booking} status and ${formatMoney(quote.commitmentMinor, plan.event.currency)} contractual commitment. Existing paid amounts remain recorded and will not be counted twice.`,
        action,
      });
    else void action();
  }
  const rows = compareQuotes(plan, enhancements.quotes, category);
  return (
    <DecisionPanel
      id="vendor-desk"
      title="Vendor Decision Desk"
      description="Compare your own quotes. No marketplace, invented ratings or inferred availability."
    >
      <Button
        variant="secondary"
        onClick={() => setEditing("new")}
        disabled={busy}
      >
        Add vendor
      </Button>
      {editing ? (
        <VendorForm
          key={typeof editing === "string" ? "new" : editing.id}
          plan={plan}
          existing={typeof editing === "string" ? undefined : editing}
          save={save}
          cancel={() => setEditing(undefined)}
          busy={busy}
        />
      ) : null}
      <label className="standalone-label no-print">
        Compare vendor category
        <select
          value={category}
          onChange={(event) =>
            setCategory(
              vendorCategories(plan.event.eventType).find(
                (item) => item.id === event.target.value,
              )!.id,
            )
          }
        >
          {vendorCategories(plan.event.eventType).map((item) => (
            <option key={item.id} value={item.id}>
              {item.category}
            </option>
          ))}
        </select>
      </label>
      {!enhancements.quotes.length ? (
        <p className="notice">
          No vendor quotes yet. Add actual options you are considering.
        </p>
      ) : null}
      {rows.length ? (
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Scrollable vendor comparison"
        >
          <table className="decision-table">
            <caption>
              User-entered vendor comparison ·{" "}
              {formatMoney(rows[0].allocationMinor, plan.event.currency)}{" "}
              allocated to this category
            </caption>
            <thead>
              <tr>
                <th scope="col">Option</th>
                <th scope="col">Quote & difference</th>
                <th scope="col">Availability</th>
                <th scope="col">Booking & commitment</th>
                <th scope="col">Inclusions / notes</th>
                <th scope="col" className="no-print">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(
                ({ quote, differenceFromLowestMinor, overAllocationMinor }) => (
                  <tr key={quote.id}>
                    <th scope="row">
                      {quote.displayName}
                      <small>
                        {quote.source === "demo"
                          ? "Fictional sample"
                          : "User entered"}{" "}
                        · {quote.quoteStatus}
                      </small>
                    </th>
                    <td>
                      {formatMoney(quote.quotedMinor, plan.event.currency)}
                      <small>
                        {formatMoney(
                          differenceFromLowestMinor,
                          plan.event.currency,
                        )}{" "}
                        above lowest entered quote
                      </small>
                      {overAllocationMinor ? (
                        <small>
                          {formatMoney(
                            overAllocationMinor,
                            plan.event.currency,
                          )}{" "}
                          above allocation
                        </small>
                      ) : null}
                    </td>
                    <td>
                      {quote.availability === "unknown"
                        ? "Unknown"
                        : `${quote.availability} (user reported)`}
                    </td>
                    <td>
                      {quote.booking}
                      <small>
                        {formatMoney(
                          quote.commitmentMinor,
                          plan.event.currency,
                        )}{" "}
                        committed
                      </small>
                    </td>
                    <td>
                      {quote.inclusions.length
                        ? quote.inclusions.join("; ")
                        : "Inclusions unknown"}
                      {quote.notes ? <small>{quote.notes}</small> : null}
                      {quote.contact ? (
                        <small>Local contact: {quote.contact}</small>
                      ) : null}
                    </td>
                    <td className="no-print">
                      <Button
                        size="small"
                        variant="ghost"
                        onClick={() => setEditing(quote)}
                      >
                        Edit {quote.displayName}
                      </Button>
                      <Button
                        size="small"
                        variant="ghost"
                        onClick={() =>
                          confirm({
                            title: "Delete this vendor option?",
                            description:
                              "Booked commitments and linked payments must be released or detached through explicit edits before deletion.",
                            action: () =>
                              update((current) =>
                                deleteVendor(current, quote.id),
                              ),
                          })
                        }
                      >
                        Delete {quote.displayName}
                      </Button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted small-text">No quotes in this category.</p>
      )}
      <p className="small-text muted">
        Price differences compare entered figures only. Unknown information
        stays unknown; these are not verified vendor recommendations.
      </p>
    </DecisionPanel>
  );
}
