"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  MapPin,
  UsersRound,
  Check,
  Copy,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import type { EventPlan } from "@/schemas/plan";
import { eventLabels } from "@/data/templates";
import { formatDate, daysBetween, today } from "@/lib/dates";
import { formatMoney } from "@/features/budget/engine";
import { BudgetView } from "@/features/budget/budget-view";
import { TimelineView } from "@/features/timeline/timeline-view";
import { VendorView } from "@/features/vendors/vendor-view";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/features/decisions/use-workspace";
import { HistoryControls } from "@/features/history/controls";
import { DecisionSummary } from "./decision-summary";
const DecisionStudio = dynamic(
  () =>
    import("@/features/decisions/studio").then(
      (module) => module.DecisionStudio,
    ),
  { loading: () => <p role="status">Opening the Decision Studio…</p> },
);

export function PlanDashboard({
  initialPlan,
  initiallySaved = true,
  initialNotice = "",
}: {
  initialPlan: EventPlan;
  initiallySaved?: boolean;
  initialNotice?: string;
}) {
  const [plan, setPlan] = useState(initialPlan),
    [everSaved, setEverSaved] = useState(initiallySaved),
    [notice, setNotice] = useState(initialNotice),
    [copyStatus, setCopyStatus] = useState("");
  const state = useWorkspace(plan, setPlan, initiallySaved);
  const [pendingToggle, setPendingToggle] = useState<{
    field: "tasks" | "vendors";
    id: string;
    completed: boolean;
  }>();
  const checklistPlan = pendingToggle
    ? {
        ...plan,
        [pendingToggle.field]: plan[pendingToggle.field].map((item) =>
          item.id === pendingToggle.id
            ? { ...item, completed: pendingToggle.completed }
            : item,
        ),
      }
    : plan;
  const saved = everSaved && !state.dirty && !state.missing,
    updating = state.busy || state.loading;
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  async function save() {
    if (
      await state.update((current) => current, "Save pending event changes")
    ) {
      setEverSaved(true);
      setNotice("");
    }
  }
  async function toggle(
    field: "tasks" | "vendors",
    id: string,
    completed: boolean,
  ) {
    if (state.busy || state.loading) return;
    setPendingToggle({ field, id, completed });
    const ok = await state.update(
      (current) => {
        if (!current.plan[field].some((item) => item.id === id))
          throw new Error("Checklist item not found.");
        return {
          ...current,
          plan: {
            ...current.plan,
            [field]: current.plan[field].map((item) =>
              item.id === id ? { ...item, completed } : item,
            ),
          },
        };
      },
      field === "tasks"
        ? "Update task completion"
        : "Update supplier checklist",
    );
    if (ok) {
      setEverSaved(true);
      setNotice("");
    }
    setPendingToggle(undefined);
  }
  async function copy(text: string, index: number) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus(`Invitation ${index + 1} copied. Nothing has been sent.`);
    } catch {
      setCopyStatus(
        "Clipboard is unavailable. Select the invitation text and copy it with your keyboard.",
      );
    }
  }
  const remaining = daysBetween(today(), plan.event.date);
  return (
    <main id="main" className="page-width dashboard-page">
      <div className="dashboard-toolbar">
        <Link href="/plans" className="back-link">
          <ArrowLeft size={15} aria-hidden="true" /> My plans
        </Link>
        <div className="save-indicator" role="status">
          <ShieldCheck size={15} aria-hidden="true" />
          {updating
            ? "Saving…"
            : saved
              ? "Saved in this browser"
              : "Not saved — keep this tab open"}
        </div>
      </div>
      {plan.source === "demo" ? (
        <div className="demo-banner">
          <Sparkles size={18} aria-hidden="true" />
          <strong>Sample plan · deterministic demo data</strong>
          <span>
            The initial blueprint is sample data. Later AI previews are labelled
            separately.
          </span>
        </div>
      ) : null}
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">
            {eventLabels[plan.event.eventType].toUpperCase()} · YOUR CELEBRATION
            BLUEPRINT
          </p>
          <h1 tabIndex={-1} ref={heading}>
            {plan.event.title}
          </h1>
          <div className="event-facts">
            <span>
              <CalendarDays size={16} aria-hidden="true" />
              {formatDate(plan.event.date)}
            </span>
            <span>
              <MapPin size={16} aria-hidden="true" />
              {plan.event.city}
            </span>
            <span>
              <UsersRound size={16} aria-hidden="true" />
              {plan.event.guests} guests
            </span>
          </div>
        </div>
        <Button asChild variant="secondary">
          <Link href="/plan">
            Plan another event <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </Button>
      </header>
      {notice ? (
        <p role="status" className={saved ? "notice" : "error-notice"}>
          {notice}
        </p>
      ) : null}
      {state.missing ? null : !saved ? (
        <Button onClick={() => void save()} disabled={updating}>
          Retry saving this plan
        </Button>
      ) : (
        <Link href={`/plans/${plan.id}`} className="saved-link">
          Open saved copy
        </Link>
      )}
      {plan.fingerprint.startsWith("scenario-applied:") ? (
        <p className="notice">
          Your budget or guest count changed. Existing descriptions, ideas and
          preparation tasks were retained; review them against the updated
          figures. The Decision Studio recalculates financial and readiness
          findings from the current plan.
        </p>
      ) : null}
      <div className="stats-grid">
        <div>
          <span>Your planning envelope</span>
          <strong>
            {formatMoney(plan.event.budgetMinor, plan.event.currency)}
          </strong>
          <small>Planned, including contingency</small>
        </div>
        <div>
          <span>The little details</span>
          <strong>
            {plan.tasks.filter((task) => task.completed).length}
            <small> / {plan.tasks.length}</small>
          </strong>
          <small>Planning tasks completed</small>
        </div>
        <div>
          <span>
            {remaining >= 0 ? "The countdown" : "A moment to remember"}
          </span>
          <strong>
            {Math.abs(remaining)}{" "}
            <small>days {remaining < 0 ? "ago" : "to go"}</small>
          </strong>
          <small>One step closer to something special</small>
        </div>
      </div>
      <section className="overview-panel" aria-labelledby="overview-title">
        <span className="overview-star" aria-hidden="true">
          ✳
        </span>
        <div>
          <p className="eyebrow">THE BIG PICTURE</p>
          <h2 id="overview-title">A celebration with your signature.</h2>
          <p>{plan.overview.description}</p>
          <p>{plan.overview.approach}</p>
          <ul className="priority-tags">
            {plan.overview.priorities.map((priority, index) => (
              <li key={index}>
                <Check size={13} aria-hidden="true" />
                {priority}
              </li>
            ))}
          </ul>
          {plan.overview.considerations.length ? (
            <details>
              <summary>A few practical considerations</summary>
              <ul>
                {plan.overview.considerations.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      </section>
      <HistoryControls state={state} />
      <DecisionSummary workspace={state.workspace} loading={state.loading} />
      <BudgetView plan={plan} />
      <div className="dashboard-columns">
        <TimelineView
          plan={checklistPlan}
          updating={updating}
          toggle={(id, checked) => void toggle("tasks", id, checked)}
        />
        <VendorView
          plan={checklistPlan}
          updating={updating}
          toggle={(id, checked) => void toggle("vendors", id, checked)}
        />
      </div>
      <section className="panel ideas-panel" aria-labelledby="ideas-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">THE LITTLE THINGS THEY’LL REMEMBER</p>
            <h2 id="ideas-title">A few ideas, just for you.</h2>
          </div>
          <Sparkles size={25} aria-hidden="true" />
        </div>
        <div className="ideas-grid">
          {plan.ideas.map((idea, index) => (
            <article className={`idea-card idea-${index % 3}`} key={index}>
              <p className="eyebrow">{idea.category}</p>
              <h3>{idea.title}</h3>
              <p>{idea.description}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="panel" aria-labelledby="invitations-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">START WITH A WARM WELCOME</p>
            <h2 id="invitations-title">Words to bring everyone together.</h2>
          </div>
        </div>
        <p className="muted small-text">
          Drafts to personalise and copy. EventGenie does not send invitations.
        </p>
        <div className="invitation-grid">
          {plan.invitations.map((invitation, index) => (
            <article className="invitation-card" key={index}>
              <h3>Invitation {index + 1}</h3>
              <p>{invitation}</p>
              <Button
                variant="secondary"
                size="small"
                onClick={() => void copy(invitation, index)}
              >
                <Copy size={15} aria-hidden="true" /> Copy invitation{" "}
                {index + 1}
              </Button>
            </article>
          ))}
        </div>
        <p role="status" className="small-text">
          {copyStatus}
        </p>
      </section>
      {plan.warnings.length ? (
        <section className="warnings-panel" aria-labelledby="warnings-title">
          <h2 id="warnings-title">A little heads-up.</h2>
          <p>Planning suggestions to check, not verified predictions.</p>
          <ul>
            {plan.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </section>
      ) : null}
      <DecisionStudio key={plan.id} state={state} />
      <p className="privacy-footnote">
        <ShieldCheck size={16} aria-hidden="true" /> Your plans stay in this
        browser. Clearing browser data may remove them.{" "}
        <Link href="/privacy">Learn about privacy</Link>
      </p>
    </main>
  );
}
