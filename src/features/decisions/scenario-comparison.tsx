import type { Currency } from "@/schemas/event";
import type { ScenarioResult } from "@/lib/planning/finance";
import { formatMoney } from "@/features/budget/engine";
export function ScenarioComparison({
  result,
  currency,
}: {
  result: ScenarioResult;
  currency: Currency;
}) {
  return (
    <div
      className="table-scroll"
      tabIndex={0}
      role="region"
      aria-label="Scrollable allocation comparison"
    >
      <table className="decision-table">
        <caption>Original versus simulated allocations</caption>
        <thead>
          <tr>
            <th scope="col">Category</th>
            <th scope="col">Original</th>
            <th scope="col">Simulated</th>
            <th scope="col">Difference</th>
            <th scope="col">Change</th>
          </tr>
        </thead>
        <tbody>
          {result.comparison.map((row) => (
            <tr key={row.id}>
              <th scope="row">{row.label}</th>
              <td>{formatMoney(row.originalMinor, currency)}</td>
              <td>{formatMoney(row.simulatedMinor, currency)}</td>
              <td>{formatMoney(row.differenceMinor, currency)}</td>
              <td>
                {row.percentDifference === null
                  ? "New allocation"
                  : `${row.percentDifference.toFixed(1)}%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
