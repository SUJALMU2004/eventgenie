"use client";
import { useState } from "react";
import dynamic from "next/dynamic";

import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation";
import type { WorkspaceState } from "./use-workspace";
import { ScenarioPanel } from "./scenario-panel";
import { VendorPanel } from "./vendor-panel";
import { RescuePanel } from "./rescue-panel";
import { ReadinessPanel } from "./readiness-panel";
import { SchedulePanel } from "./schedule-panel";
import { AIWorkbench } from "./ai-workbench";
import { ExportPanel } from "./export-panel";
import type { Confirmation } from "./types";
import { addDecisionExamples } from "@/data/decision-examples";
const IntelligenceHub = dynamic(() => import("@/features/intelligence/hub"), {
  loading: () => <p role="status">Opening advanced planning…</p>,
});
export function DecisionStudio({ state }: { state: WorkspaceState }) {
  const plan = state.workspace.plan;
  const [advanced, setAdvanced] = useState(false);
  const [opened, setOpened] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  if (state.loading)
    return (
      <section className="panel">
        <h2>Decision Studio</h2>
        <p role="status">Opening local decisions…</p>
      </section>
    );
  const props = {
    workspace: state.workspace,
    update: state.update,
    busy: state.busy,
    confirm: setConfirmation,
  };
  return (
    <section className="decision-studio" aria-labelledby="studio-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">A LITTLE MORE CLARITY FOR THE BIG DECISIONS</p>
          <h2 id="studio-title">Your Decision Studio.</h2>
        </div>
        <span className="badge">Phases 2 & 3 · Local-first</span>
      </div>
      <nav
        className="studio-navigation no-print"
        aria-label="Event decision sections"
      >
        {[
          ["what-if", "What-If"],
          ["budget-rescue", "Budget Rescue"],
          ["vendor-desk", "Vendors"],
          ["readiness", "Readiness"],
          ["day-of", "Day-of"],
          ["refinement", "Refine"],
          ["export", "Export"],
        ].map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            onClick={() =>
              document.getElementById(id)?.setAttribute("open", "")
            }
          >
            {label}
          </a>
        ))}
      </nav>
      {state.notice ? (
        <p role="status" className={state.dirty ? "error-notice" : "notice"}>
          {state.notice}
        </p>
      ) : null}
      {state.dirty ? (
        <Button
          disabled={state.busy}
          onClick={() =>
            void state.update((current) => {
              if (
                current.enhancements.revision !==
                state.workspace.enhancements.revision
              )
                throw new Error(
                  "Another tab changed this event. Reopen the latest plan before replacing its decisions.",
                );
              return {
                plan: current.plan,
                enhancements: state.workspace.enhancements,
              };
            })
          }
        >
          Retry saving decisions
        </Button>
      ) : null}
      <div className="sample-tools no-print">
        <p className="small-text muted">
          Want to explore? Fictional examples are available for this{" "}
          {plan.event.eventType}. They never represent verified businesses or
          prices.
        </p>
        <Button
          variant="ghost"
          size="small"
          disabled={
            state.busy ||
            state.workspace.enhancements.quotes.length > 0 ||
            state.workspace.enhancements.expenses.length > 0 ||
            Boolean(state.workspace.enhancements.schedule)
          }
          onClick={() =>
            setConfirmation({
              title: "Add fictional example decisions?",
              description:
                "Adds two clearly fictional vendor options, a sample deposit linked to a booked option, a scenario preview and a sample running order. Existing tasks, allocations and checklist statuses remain unchanged.",
              action: () =>
                state.update((current) => addDecisionExamples(current)),
            })
          }
        >
          Load fictional Phase 2 examples
        </Button>
      </div>
      <section id="advanced-planning" className="advanced-entry no-print">
        <h3>Make confident decisions, one step at a time.</h3>
        <p>
          Compare strategies, prepare for disruptions, ask plan-specific
          questions and personalise invitations. No account required.
        </p>
        <Button
          id="open-advanced"
          aria-expanded={advanced}
          onClick={() => {
            setOpened(true);
            setAdvanced((value) => !value);
          }}
        >
          {advanced ? "Close advanced planning" : "Open advanced planning"}
        </Button>
      </section>
      {opened ? (
        <div hidden={!advanced}>
          <IntelligenceHub {...props} />
        </div>
      ) : null}
      <ScenarioPanel {...props} />
      <RescuePanel {...props} />
      <VendorPanel {...props} />
      <ReadinessPanel {...props} />
      <SchedulePanel {...props} />
      <AIWorkbench
        {...props}
        operation="refine-section"
        window={
          state.workspace.enhancements.schedule
            ? {
                startMinute: state.workspace.enhancements.schedule.startMinute,
                endMinute: state.workspace.enhancements.schedule.endMinute,
                timeZone: state.workspace.enhancements.schedule.timeZone,
              }
            : { startMinute: 540, endMinute: 1020, timeZone: "Asia/Kolkata" }
        }
      />
      <ExportPanel {...props} />
      <ConfirmationDialog
        value={confirmation}
        busy={state.busy}
        close={() => setConfirmation(null)}
      />
    </section>
  );
}
