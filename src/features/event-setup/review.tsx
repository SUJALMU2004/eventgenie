import { formatDate } from "@/lib/dates";
import { eventLabels } from "@/data/templates";
import { formatMoney } from "@/features/budget/engine";
import type { EventInput } from "@/schemas/event";
import { Button } from "@/components/ui/button";

export function EventReview({
  event,
  edit,
}: {
  event: EventInput;
  edit: (step: number) => void;
}) {
  return (
    <div className="review-sections">
      {[
        {
          title: "The occasion",
          step: 0,
          rows: [
            ["Event", eventLabels[event.eventType]],
            ["Title", event.title],
            ["Subtype", event.subtype || "Not specified"],
          ],
        },
        {
          title: "The essentials",
          step: 1,
          rows: [
            ["Date", formatDate(event.date)],
            ["Location", event.city],
            ["Guests", String(event.guests)],
            ["Budget", formatMoney(event.budgetMinor, event.currency)],
          ],
        },
        {
          title: "Your personal touches",
          step: 2,
          rows: [
            ["Style", event.style || "Open to ideas"],
            ["Setting", event.setting],
            ["Food", event.food || "Not specified"],
            ["Traditions", event.culture || "Not specified"],
            ["Priorities", event.priorities.join(", ") || "Balanced spending"],
            ["Requirements", event.requirements || "None added"],
            ["Notes", event.notes || "None added"],
          ],
        },
      ].map((section) => (
        <section key={section.title}>
          <div className="review-heading">
            <h3>{section.title}</h3>
            <Button
              variant="ghost"
              size="small"
              onClick={() => edit(section.step)}
              aria-label={`Edit ${section.title.toLowerCase()}`}
            >
              Edit
            </Button>
          </div>
          <dl className="review-list">
            {section.rows.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
