"use client";
import type { DecisionProps } from "@/features/decisions/types";
import { ComparisonPanel } from "@/features/scenarios/comparison-panel";
import { ContingencyPanel } from "@/features/contingency/panel";
import { AssistantPanel } from "@/features/assistant/panel";
import { ActionCenter } from "@/features/tasks/action-center";
import { InvitationStudio } from "@/features/invitations/studio";
export default function IntelligenceHub(props: DecisionProps) {
  return (
    <section className="intelligence-hub" aria-label="Advanced event planning">
      <p className="notice">
        Plan-specific intelligence · exact calculations stay local. Every
        proposed plan edit needs review and creates an undoable revision.
      </p>
      <nav
        className="studio-navigation no-print"
        aria-label="Advanced planning sections"
      >
        {[
          ["next-actions", "Next steps"],
          ["compare-strategies", "Compare strategies"],
          ["contingency-planner", "Plan B"],
          ["ask-eventgenie", "Ask EventGenie"],
          ["invitation-studio", "Invitation Studio"],
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
      <ActionCenter {...props} />
      <ComparisonPanel {...props} />
      <ContingencyPanel {...props} />
      <AssistantPanel {...props} />
      <InvitationStudio {...props} />
    </section>
  );
}
