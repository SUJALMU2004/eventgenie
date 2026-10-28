"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { planRepository } from "@/lib/storage/repository";
import type { EventPlan } from "@/schemas/plan";
import { PlanDashboard } from "./dashboard";
export function SavedPlan({ id }: { id: string }) {
  const [plan, setPlan] = useState<EventPlan>(),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void planRepository
      .loadPlan(id)
      .then((value) => {
        if (active) {
          setPlan(value);
          if (!value)
            setError(
              "This plan is not saved in this browser. It may have been deleted, or created on another device.",
            );
        }
      })
      .catch((error) => {
        if (active)
          setError(
            error instanceof Error
              ? error.message
              : "Could not load this plan.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);
  if (plan) return <PlanDashboard initialPlan={plan} />;
  return (
    <main id="main" className="page-width empty-state">
      {loading ? (
        <p role="status">Opening your event blueprint…</p>
      ) : (
        <>
          <h1>We couldn’t open this celebration.</h1>
          <p role="alert">{error}</p>
          <Link className="button" href="/plans">
            Back to My plans
          </Link>
        </>
      )}
    </main>
  );
}
