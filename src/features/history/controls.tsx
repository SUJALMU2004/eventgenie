"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation";
import type { Confirmation } from "@/features/decisions/types";
import type { WorkspaceState } from "@/features/decisions/use-workspace";
export function HistoryControls({ state }: { state: WorkspaceState }) {
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const review = (direction: "undo" | "redo") =>
    setConfirmation({
      title: `${direction === "undo" ? "Undo" : "Redo"} the last saved change?`,
      description:
        "This restores recorded local planning and financial decisions. It cannot reverse a real booking, payment or message. Review real-world commitments before confirming.",
      action: () => state.travel(direction),
    });
  return (
    <section
      className="panel history-controls no-print"
      aria-labelledby="history-title"
    >
      <h2 id="history-title">Your decisions, safely saved.</h2>
      <p>
        Current revision {state.workspace.enhancements.revision}. Up to 20
        reversible changes are retained locally.
      </p>
      {state.history.updatedAt ? (
        <p className="small-text">
          Last saved revision:{" "}
          <time dateTime={state.history.updatedAt}>
            {new Date(state.history.updatedAt).toLocaleString("en-IN", {
              timeZone: "Asia/Kolkata",
            })}{" "}
            IST
          </time>
        </p>
      ) : null}
      <div className="button-row">
        <Button
          disabled={
            state.loading ||
            state.busy ||
            state.dirty ||
            !state.history.undo.length
          }
          onClick={() => review("undo")}
        >
          Undo last change
        </Button>
        <Button
          variant="secondary"
          disabled={
            state.loading ||
            state.busy ||
            state.dirty ||
            !state.history.redo.length
          }
          onClick={() => review("redo")}
        >
          Redo last change
        </Button>
        <Button
          variant="ghost"
          disabled={state.busy || state.loading}
          onClick={() =>
            setConfirmation({
              title: "Reload the saved event?",
              description:
                "Unsaved decisions in this tab will be replaced with the latest saved revision. Open form drafts must be reviewed again.",
              action: state.reload,
            })
          }
        >
          Reload saved version
        </Button>
      </div>
      {state.dirty ? (
        <p className="notice">
          Save your in-tab changes before using persistent undo or redo.
        </p>
      ) : null}
      <details>
        <summary>Review revision history</summary>
        {state.history.undo.length ? (
          <ol>
            {state.history.undo
              .slice()
              .reverse()
              .map((entry) => (
                <li key={entry.id}>
                  {entry.description} ·{" "}
                  <time dateTime={entry.at}>
                    {new Date(entry.at).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                    })}{" "}
                    IST
                  </time>
                </li>
              ))}
          </ol>
        ) : (
          <p>
            No reversible changes yet. Streaming previews are never revisions.
          </p>
        )}
      </details>
      <ConfirmationDialog
        value={confirmation}
        busy={state.busy}
        close={() => setConfirmation(null)}
      />
    </section>
  );
}
