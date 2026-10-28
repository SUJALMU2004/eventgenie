import { Button } from "@/components/ui/button";
import type { usePlanOperation } from "./use-plan-operation";
type OperationState = ReturnType<typeof usePlanOperation>;
export function OperationProposal({
  proposal,
  busy,
  accept,
  reject,
}: {
  proposal: NonNullable<OperationState["proposal"]>;
  busy: boolean;
  accept: OperationState["accept"];
  reject: () => void;
}) {
  return (
    <div className="ai-proposal">
      <p className="badge">
        {proposal.source === "demo"
          ? "Deterministic sample preview"
          : proposal.source === "cache"
            ? "Cached AI preview · this browser"
            : "AI preview"}{" "}
        · not applied
      </p>
      <h3>Review original and proposed content</h3>
      {proposal.output.kind !== "rescue" ? (
        <details>
          <summary>Original content (kept local)</summary>
          <pre className="content-preview">{proposal.original}</pre>
        </details>
      ) : null}
      {proposal.output.kind === "rescue" ? (
        proposal.output.recommendations.map((item) => (
          <article className="recommendation" key={item.recommendationId}>
            <h4>{item.title}</h4>
            <p>{item.explanation}</p>
            <p>
              Category: {item.affectedCategories.join(", ")} ·{" "}
              {item.estimatedImpactType.replaceAll("-", " ")}
            </p>
            <p>Conditions: {item.feasibilityConditions.join(" ")}</p>
            <p>Tradeoffs: {item.tradeoffs.join(" ")}</p>
            <p className="muted">Limitations: {item.confidenceLimitations}</p>
            <Button
              size="small"
              disabled={busy}
              onClick={() => accept(item.recommendationId)}
            >
              Adopt {item.title}
            </Button>
          </article>
        ))
      ) : (
        <>
          <pre className="content-preview">
            {JSON.stringify(proposal.output, null, 2)}
          </pre>
          <Button disabled={busy} onClick={() => accept()}>
            Accept proposed {proposal.output.kind}
          </Button>
        </>
      )}
      <Button
        variant="ghost"
        onClick={() => {
          reject();
        }}
      >
        Reject preview
      </Button>
    </div>
  );
}
