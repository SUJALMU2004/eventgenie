import { formatDate } from "@/lib/dates";
import type { EventPlan } from "@/schemas/plan";
export function VendorView({
  plan,
  updating,
  toggle,
}: {
  plan: EventPlan;
  updating: boolean;
  toggle: (id: string, checked: boolean) => void;
}) {
  return (
    <section className="panel" aria-labelledby="vendors-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">YOUR SUPPORTING CAST</p>
          <h2 id="vendors-title">The right people for the day.</h2>
        </div>
      </div>
      <p className="muted small-text">
        Supplier categories to explore, not verified businesses. Compare written
        quotes and confirm availability.
      </p>
      <ul className="vendor-list">
        {plan.vendors.map((vendor) => (
          <li key={vendor.id}>
            <div className="vendor-heading">
              <input
                type="checkbox"
                id={vendor.id}
                checked={vendor.completed}
                disabled={updating}
                onChange={(e) => toggle(vendor.id, e.target.checked)}
              />
              <div>
                <label htmlFor={vendor.id}>{vendor.category}</label>
                <span className="small-text muted">
                  {vendor.priority} priority · Target booking by{" "}
                  {formatDate(vendor.bookingDate)}
                </span>
              </div>
            </div>
            <p>{vendor.purpose}</p>
            <details>
              <summary>Questions worth asking</summary>
              <ul>
                {vendor.questions.map((question, index) => (
                  <li key={index}>{question}</li>
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
