import { formatMoney } from "./engine";
import type { EventPlan } from "@/schemas/plan";

const colours = [
  "#276451",
  "#aa7243",
  "#63897a",
  "#9a5947",
  "#b6a574",
  "#506a7c",
  "#b9c7bb",
];
export function BudgetView({ plan }: { plan: EventPlan }) {
  let offset = 0;
  const segments: string[] = [];
  for (const [index, item] of plan.budget.entries()) {
    const start = offset;
    offset += (item.amountMinor / plan.event.budgetMinor) * 100;
    segments.push(`${colours[index % colours.length]} ${start}% ${offset}%`);
  }
  return (
    <section className="panel budget-panel" aria-labelledby="budget-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">EVERY RUPEE, A PURPOSE</p>
          <h2 id="budget-title">Your budget, beautifully balanced.</h2>
        </div>
        <span className="badge">Planned allocations</span>
      </div>
      <div className="budget-content">
        <div
          className="budget-chart"
          role="img"
          aria-label={`Budget allocation chart. Total ${formatMoney(plan.event.budgetMinor, plan.event.currency)}. Category amounts are listed alongside.`}
          style={{ background: `conic-gradient(${segments.join(",")})` }}
        >
          <div>
            <span>Total budget</span>
            <strong>
              {formatMoney(plan.event.budgetMinor, plan.event.currency)}
            </strong>
            <small>including contingency</small>
          </div>
        </div>
        <div className="budget-table-wrap">
          <table className="budget-table">
            <caption className="sr-only">
              Planned budget allocations, including contingency
            </caption>
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col">Allocation</th>
              </tr>
            </thead>
            <tbody>
              {plan.budget.map((item, index) => (
                <tr key={item.id}>
                  <th scope="row">
                    <span
                      className="budget-dot"
                      style={{ background: colours[index % colours.length] }}
                      aria-hidden="true"
                    />
                    {item.label}
                  </th>
                  <td>{formatMoney(item.amountMinor, plan.event.currency)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Total planned</th>
                <td>
                  {formatMoney(plan.event.budgetMinor, plan.event.currency)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      <p className="small-text muted">
        Planning estimates, not verified supplier prices or actual expenses.
        Currency amounts are never converted.
      </p>
      <details className="budget-notes">
        <summary>Why these allocations?</summary>
        <ul>
          {plan.budgetNotes.map((note, index) => (
            <li key={`${note.category}-${index}`}>{note.explanation}</li>
          ))}
        </ul>
        <p>
          The displayed contingency is reserved first. Spending priorities and
          any approved scenario commitments guide the remaining allocations,
          balanced exactly in the smallest currency unit. Quotes and actual
          payments remain separate in Budget Rescue.
        </p>
      </details>
    </section>
  );
}
