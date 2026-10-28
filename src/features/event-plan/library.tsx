"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  Trash2,
  FolderHeart,
  Plus,
} from "lucide-react";
import { planRepository } from "@/lib/storage/repository";
import type { EventPlan } from "@/schemas/plan";
import { Button } from "@/components/ui/button";
import { eventLabels } from "@/data/templates";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/features/budget/engine";

export function PlanLibrary() {
  const [plans, setPlans] = useState<EventPlan[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [pending, setPending] = useState<EventPlan>(),
    [deleting, setDeleting] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null),
    heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    let active = true;
    void planRepository
      .listPlans()
      .then((result) => {
        if (active) {
          setPlans(result.plans);
          setError(result.issues.join(" "));
        }
      })
      .catch((error) => {
        if (active)
          setError(
            error instanceof Error
              ? error.message
              : "Could not open browser storage.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  async function remove() {
    if (!pending) return;
    setDeleting(true);
    try {
      await planRepository.deletePlan(pending.id);
      setPlans((current) => current.filter((plan) => plan.id !== pending.id));
      dialog.current?.close();
      setPending(undefined);
      heading.current?.focus();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not delete this plan.",
      );
    } finally {
      setDeleting(false);
    }
  }
  return (
    <main id="main" className="page-width library-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">ALL YOUR GOOD THINGS, IN ONE PLACE</p>
          <h1 ref={heading} tabIndex={-1}>
            Your celebrations.
          </h1>
          <p>Little plans for the moments that matter.</p>
        </div>
        <Button asChild>
          <Link href="/plan">
            <Plus size={17} aria-hidden="true" /> Plan an event
          </Link>
        </Button>
      </div>
      <p className="notice">
        Saved only in this browser. Plans do not sync across devices, and
        clearing browser data can remove them.
      </p>
      {error ? (
        <p className="error-notice" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p role="status">Opening your saved celebrations…</p>
      ) : plans.length ? (
        <div className="library-grid">
          {plans.map((plan) => (
            <article className="saved-plan-card" key={plan.id}>
              <div className="saved-card-top">
                <span className="badge">
                  {eventLabels[plan.event.eventType]}
                  {plan.source === "demo" ? " · Sample" : " · AI plan"}
                </span>
                <Button
                  variant="ghost"
                  size="small"
                  aria-label={`Delete ${plan.event.title}`}
                  onClick={() => {
                    setPending(plan);
                    dialog.current?.showModal();
                  }}
                >
                  <Trash2 size={17} aria-hidden="true" />
                </Button>
              </div>
              <h2>
                <Link href={`/plans/${plan.id}`}>{plan.event.title}</Link>
              </h2>
              <p>
                <CalendarDays size={15} aria-hidden="true" />
                {formatDate(plan.event.date)} · {plan.event.city}
              </p>
              <strong>
                {formatMoney(plan.event.budgetMinor, plan.event.currency)}
              </strong>
              <p>
                {plan.tasks.filter((task) => task.completed).length} of{" "}
                {plan.tasks.length} tasks complete
              </p>
              <Link className="text-link" href={`/plans/${plan.id}`}>
                Open event blueprint{" "}
                <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <FolderHeart size={46} strokeWidth={1.3} aria-hidden="true" />
          <h2>Your next happy moment belongs here.</h2>
          <p>Start with an occasion. We’ll help with the little details.</p>
          <Button asChild>
            <Link href="/plan">
              Create your first plan{" "}
              <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </Button>
          <Link className="text-link" href="/plan?demo=birthday">
            Or try a sample birthday
          </Link>
        </div>
      )}
      <dialog
        ref={dialog}
        aria-labelledby="delete-title"
        onCancel={() => setPending(undefined)}
      >
        <h2 id="delete-title">Delete this local plan?</h2>
        <p>
          {pending?.event.title} will be removed from this browser. This cannot
          be undone.
        </p>
        <div className="dialog-actions">
          <Button
            variant="secondary"
            onClick={() => {
              dialog.current?.close();
              setPending(undefined);
            }}
          >
            Keep this plan
          </Button>
          <Button
            variant="danger"
            disabled={deleting}
            onClick={() => void remove()}
          >
            {deleting ? "Deleting…" : "Delete permanently"}
          </Button>
        </div>
      </dialog>
    </main>
  );
}
