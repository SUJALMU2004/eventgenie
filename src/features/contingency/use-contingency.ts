"use client";
import { useState } from "react";
import type { ContingencyInput } from "@/schemas/intelligence";
import { analyzeContingency } from "@/lib/planning/contingency";
import { historySnapshot } from "@/lib/history";
import { budgetCategories } from "@/data/templates";
import { moneyInput, parseMoney } from "@/features/budget/engine";
import type { TaskProposal } from "@/lib/planning/task-workflows";
import type { Workspace } from "@/lib/planning/workspace";
export function useContingency(workspace: Workspace) {
  const { plan } = workspace;
  const [kind, setKind] = useState<ContingencyInput["kind"]>("rain"),
    [amount, setAmount] = useState(
      moneyInput(
        Number(BigInt(plan.event.budgetMinor) / 10n),
        plan.event.currency,
      ),
    ),
    [guests, setGuests] = useState(String(plan.event.guests + 10)),
    [category, setCategory] = useState<
      NonNullable<ContingencyInput["category"]>
    >(budgetCategories[plan.event.eventType][0].id),
    [taskId, setTaskId] = useState(
      plan.tasks.find((task) => !task.completed)?.id ?? "",
    ),
    [date, setDate] = useState(plan.event.date),
    [error, setError] = useState("");
  const [preview, setPreview] = useState<{
      analysis: ReturnType<typeof analyzeContingency>;
      baseline: string;
    }>(),
    [selection, setSelection] = useState({
      financial: false,
      task: false,
      deadline: false,
    }),
    [draft, setDraft] = useState<TaskProposal>();
  function analyze() {
    try {
      const input: ContingencyInput = {
        kind,
        ...(["budget-reduction", "cost-increase"].includes(kind)
          ? { amountMinor: parseMoney(amount, plan.event.currency) ?? 0 }
          : {}),
        ...(["guest-increase", "attendance-drop"].includes(kind)
          ? { guests: Number(guests) }
          : {}),
        ...(["vendor-cancellation", "cost-increase"].includes(kind)
          ? { category }
          : {}),
        ...(kind === "task-delay" ? { taskId, newDueDate: date } : {}),
      };
      setPreview({
        analysis: analyzeContingency(workspace, input),
        baseline: JSON.stringify(historySnapshot(workspace)),
      });
      setSelection({ financial: false, task: false, deadline: false });
      setError("");
    } catch (value) {
      setPreview(undefined);
      setError(
        value instanceof Error ? value.message : "Check contingency inputs.",
      );
    }
  }
  function edit(action: () => void) {
    action();
    setPreview(undefined);
  }

  return {
    kind,
    setKind,
    amount,
    setAmount,
    guests,
    setGuests,
    category,
    setCategory,
    taskId,
    setTaskId,
    date,
    setDate,
    error,
    setError,
    preview,
    selection,
    setSelection,
    draft,
    setDraft,
    analyze,
    edit,
  };
}
