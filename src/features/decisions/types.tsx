import type { ReactNode } from "react";
import type { Workspace } from "@/lib/planning/workspace";
export type Mutation = (current: Workspace) => Workspace;
export type Confirmation = {
  title: string;
  description: string;
  action: () => Promise<boolean>;
};
export type DecisionProps = {
  workspace: Workspace;
  update: (mutation: Mutation, description?: string) => Promise<boolean>;
  confirm: (value: Confirmation) => void;
  busy: boolean;
};
export function DecisionPanel({
  id,
  title,
  description,
  children,
  open = false,
  printable = true,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
  open?: boolean;
  printable?: boolean;
}) {
  return (
    <details
      className="panel studio-section"
      id={id}
      open={open}
      data-print={printable ? "show" : "hide"}
    >
      <summary>
        <span className="eyebrow">DECISION STUDIO</span>
        <h2>{title}</h2>
        <span className="muted small-text">{description}</span>
      </summary>
      <div className="studio-content">{children}</div>
    </details>
  );
}
