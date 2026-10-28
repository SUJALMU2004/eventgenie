import { Button } from "@/components/ui/button";
import type { useIntelligence } from "./use-intelligence";
export function AIControls({
  state,
  label,
}: {
  state: ReturnType<typeof useIntelligence>;
  label: string;
}) {
  return (
    <div className="ai-review no-print">
      <div className="button-row">
        <Button
          disabled={state.generating || state.retryAt > 0}
          onClick={() => void state.generate()}
        >
          Generate {label} with AI
        </Button>
        <Button
          variant="secondary"
          disabled={state.generating}
          onClick={() => void state.generate(true)}
        >
          Preview sample {label}
        </Button>
        {state.generating ? (
          <Button variant="ghost" onClick={state.cancel}>
            Cancel {label}
          </Button>
        ) : null}
        {state.proposal ? (
          <Button variant="ghost" onClick={state.reject}>
            Reject {label} preview
          </Button>
        ) : null}
      </div>
      <p role="status" className="small-text">
        {state.status}
      </p>
      {state.generating && state.partial?.text ? (
        <div aria-live="off" className="notice">
          <strong>Unfinished AI preview — not applied</strong>
          <p>{state.partial.text}</p>
        </div>
      ) : null}
      {state.error ? (
        <p role="alert" className="error-notice">
          {state.error}
        </p>
      ) : null}
      {state.retryAt > 0 ? (
        <p>Wait for the provider retry window, or use a labelled sample.</p>
      ) : null}
      {state.proposal ? (
        <p className="badge">
          {state.proposal.source === "demo"
            ? "Deterministic sample"
            : state.proposal.source === "cache"
              ? "Cached AI"
              : "AI"}{" "}
          preview · not applied
        </p>
      ) : null}
      {state.stale ? (
        <p className="error-notice">
          The plan or request changed. Generate a fresh preview before applying
          advice.
        </p>
      ) : null}
    </div>
  );
}
