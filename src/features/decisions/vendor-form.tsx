"use client";
import { useState } from "react";
import { vendorCategories } from "@/data/vendor-categories";
import { moneyInput, parseMoney } from "@/features/budget/engine";
import { vendorQuoteSchema, type VendorQuote } from "@/schemas/finance";
import type { EventPlan } from "@/schemas/plan";
import { Button } from "@/components/ui/button";
export function VendorForm({
  plan,
  existing,
  save,
  cancel,
  busy,
}: {
  plan: EventPlan;
  existing?: VendorQuote;
  save: (quote: VendorQuote) => void;
  cancel: () => void;
  busy: boolean;
}) {
  const [draft, setDraft] = useState<VendorQuote>(
    () =>
      existing ?? {
        id: crypto.randomUUID(),
        planId: plan.id,
        category: vendorCategories(plan.event.eventType)[0].id,
        displayName: "",
        quotedMinor: 0,
        quoteStatus: "estimate",
        availability: "unknown",
        booking: "considering",
        commitmentMinor: 0,
        notes: "",
        inclusions: [],
        source: "user",
      },
  );
  const [price, setPrice] = useState(
      existing ? moneyInput(existing.quotedMinor, plan.event.currency) : "",
    ),
    [commitment, setCommitment] = useState(
      existing ? moneyInput(existing.commitmentMinor, plan.event.currency) : "",
    ),
    [error, setError] = useState("");
  return (
    <form
      className="vendor-form no-print"
      onSubmit={(event) => {
        event.preventDefault();
        const quotedMinor =
          price === "0" ? 0 : parseMoney(price, plan.event.currency);
        const commitmentMinor =
          draft.booking === "booked"
            ? parseMoney(commitment, plan.event.currency)
            : 0;
        if (quotedMinor === null || commitmentMinor === null) {
          setError(
            "Enter valid currency amounts; a booked commitment must be positive.",
          );
          return;
        }
        const parsed = vendorQuoteSchema.safeParse({
          ...draft,
          quotedMinor,
          commitmentMinor,
        });
        if (!parsed.success) {
          setError(
            parsed.error.issues[0]?.message ?? "Check the vendor details",
          );
          return;
        }
        save(parsed.data);
      }}
    >
      <h3>{existing ? "Edit vendor quote" : "Add a vendor option"}</h3>
      <p className="small-text muted">
        Only enter options you are considering. Contact details and notes stay
        local and are excluded from AI requests.
      </p>
      <div className="form-grid">
        <label>
          Vendor category
          <select
            value={draft.category}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                category: vendorCategories(plan.event.eventType).find(
                  (item) => item.id === event.target.value,
                )!.id,
              }))
            }
          >
            {vendorCategories(plan.event.eventType).map((category) => (
              <option key={category.id} value={category.id}>
                {category.category}
              </option>
            ))}
          </select>
        </label>
        <label>
          Vendor display name
          <input
            maxLength={100}
            required
            value={draft.displayName}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                displayName: event.target.value,
              }))
            }
          />
        </label>
        <label>
          Quoted price ({plan.event.currency})
          <input
            inputMode="decimal"
            required
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
        </label>
        <label>
          Quote status
          <select
            value={draft.quoteStatus}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                quoteStatus: event.target.value as VendorQuote["quoteStatus"],
              }))
            }
          >
            <option value="estimate">Estimate</option>
            <option value="written">Written quote</option>
            <option value="confirmed">Confirmed quote</option>
          </select>
        </label>
        <label>
          Availability
          <select
            value={draft.availability}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                availability: event.target.value as VendorQuote["availability"],
              }))
            }
          >
            <option value="unknown">Unknown</option>
            <option value="available">Available (user reported)</option>
            <option value="unavailable">Unavailable (user reported)</option>
          </select>
        </label>
        <label>
          Booking status
          <select
            value={draft.booking}
            onChange={(event) => {
              const booking = event.target.value as VendorQuote["booking"];
              setDraft((current) => ({ ...current, booking }));
              if (booking === "booked" && !commitment) setCommitment(price);
            }}
          >
            <option value="considering">Considering</option>
            <option value="shortlisted">Shortlisted</option>
            <option value="booked">Booked</option>
          </select>
        </label>
        {draft.booking === "booked" ? (
          <label>
            Contractually committed amount
            <input
              inputMode="decimal"
              value={commitment}
              required
              onChange={(event) => setCommitment(event.target.value)}
            />
          </label>
        ) : null}
        <label>
          Quote date (optional)
          <input
            type="date"
            value={draft.quoteDate ?? ""}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                quoteDate: event.target.value || undefined,
              }))
            }
          />
        </label>
        <label>
          Local contact details (optional)
          <input
            maxLength={120}
            value={draft.contact ?? ""}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                contact: event.target.value,
              }))
            }
          />
        </label>
        <label className="field-wide">
          Service inclusions (one per line, up to 8)
          <textarea
            rows={3}
            value={draft.inclusions.join("\n")}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                inclusions: event.target.value.split("\n"),
              }))
            }
          />
        </label>
        <label className="field-wide">
          Local vendor notes
          <textarea
            rows={2}
            maxLength={500}
            value={draft.notes}
            onChange={(event) =>
              setDraft((current) => ({ ...current, notes: event.target.value }))
            }
          />
        </label>
      </div>
      {error ? (
        <p role="alert" className="error-notice">
          {error}
        </p>
      ) : null}
      <div className="action-row">
        <Button disabled={busy} type="submit">
          Save vendor quote
        </Button>
        <Button type="button" variant="secondary" onClick={cancel}>
          Cancel vendor edit
        </Button>
      </div>
    </form>
  );
}
