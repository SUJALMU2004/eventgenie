"use client";
import { useEffect, useRef, useState } from "react";
import {
  actionRegistry,
  minimalContext,
  offlineOperation,
} from "@/lib/ai/operations";
import {
  operationFingerprint,
  cachedOperation,
} from "@/lib/ai/operation-cache";
import { consumeStructuredStream } from "@/lib/ndjson-client";
import { applyRefinement } from "@/lib/planning/workspace";
import { validateSchedule } from "@/lib/planning/schedule";
import {
  operationStreamSchema,
  operationRequestSchema,
  type OperationOutput,
  type OperationRequest,
  type RefinementAction,
} from "@/schemas/operations";
import type { DayOfSchedule, ScheduleWindow } from "@/schemas/schedule";
import { safeError } from "@/lib/errors";
import { retryDeadline, retryWaitSeconds } from "@/lib/retry";
import type { DecisionProps } from "./types";
export type OperationPreview = {
  kind: "rescue" | "schedule" | "ideas" | "invitations";
  itemsReceived: number;
};
type Proposal = {
  output: OperationOutput;
  source: "ai" | "demo" | "cache";
  input: OperationRequest;
  original: string;
  originalContext: string;
};
export function usePlanOperation({
  operation,
  window,
  onScheduleAccepted,
  ...props
}: DecisionProps & {
  operation: OperationRequest["operation"];
  window?: ScheduleWindow;
  onScheduleAccepted?: (schedule: DayOfSchedule) => void;
}) {
  const { workspace, update, confirm } = props;
  const [action, setAction] = useState<RefinementAction>("saving-ideas"),
    [preferences, setPreferences] = useState(""),
    [proposal, setProposal] = useState<Proposal>(),
    [generating, setGenerating] = useState(false),
    [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    [retryAt, setRetryAt] = useState(0);
  const controller = useRef<AbortController | null>(null),
    locked = useRef(false);
  useEffect(() => () => controller.current?.abort(), []);
  const target =
    operation === "rescue-ideas"
      ? "rescue"
      : operation === "day-of-schedule"
        ? "schedule"
        : actionRegistry[action].target;
  function originalContent() {
    return target === "ideas"
      ? JSON.stringify(workspace.plan.ideas)
      : target === "invitations"
        ? JSON.stringify(workspace.plan.invitations)
        : target === "schedule"
          ? JSON.stringify(workspace.enhancements.schedule ?? null)
          : JSON.stringify(workspace.enhancements.adoptedRescue);
  }
  async function handleGenerate(demo: boolean) {
    if (locked.current) return;
    if (!demo && retryWaitSeconds(retryAt)) {
      setError(
        `Wait ${retryWaitSeconds(retryAt)} seconds before retrying AI. The sample is available now.`,
      );
      return;
    }
    const input: OperationRequest = {
      operation,
      ...(operation === "refine-section" ? { action } : {}),
      context: minimalContext(workspace),
      preferences,
      ...((operation === "day-of-schedule" || action === "children-schedule") &&
      window
        ? { window }
        : {}),
    };
    const validation = operationRequestSchema.safeParse(input);
    if (!validation.success) {
      setError(
        validation.error.issues[0]?.message ??
          "Check the requested section and preferences.",
      );
      return;
    }
    locked.current = true;
    setGenerating(true);
    setProposal(undefined);
    setError("");
    setStatus("Validating the requested section…");
    controller.current = new AbortController();
    const original = originalContent(),
      originalContext = JSON.stringify(input.context);
    try {
      // Both offline and online paths validate the same minimized request contract.
      const { validateOperationRequest } = await import("@/lib/ai/operations");
      validateOperationRequest(input);
      if (demo) {
        setProposal({
          output: offlineOperation(input),
          source: "demo",
          input,
          original,
          originalContext,
        });
        setStatus("Sample preview ready. Nothing has been applied.");
        return;
      }
      const fingerprint = await operationFingerprint(input);
      const cached = cachedOperation(workspace.enhancements.cache, fingerprint);
      if (cached) {
        setProposal({
          output: cached.result,
          source: "cache",
          input,
          original,
          originalContext,
        });
        setStatus(
          "Validated local AI preview reused. No provider request made.",
        );
        return;
      }
      setStatus("Generating the requested section…");
      const response = await fetch("/api/plans/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: controller.current.signal,
      });
      const output = await consumeStructuredStream<
        OperationPreview,
        OperationOutput
      >(
        response,
        (preview) =>
          setStatus(
            `${preview.itemsReceived} validated ${preview.kind} items received; awaiting final validation.`,
          ),
        operationStreamSchema,
      );
      controller.current.signal.throwIfAborted();
      setProposal({ output, source: "ai", input, original, originalContext });
      setStatus(
        "Validated preview ready. Review before accepting; nothing is applied yet.",
      );
      await update((current) => ({
        ...current,
        enhancements: {
          ...current.enhancements,
          cache: [
            {
              fingerprint,
              result: output,
              createdAt: new Date().toISOString(),
            },
            ...current.enhancements.cache.filter(
              (item) => item.fingerprint !== fingerprint,
            ),
          ].slice(0, 10),
        },
      }));
    } catch (error) {
      const safe = safeError(error);
      setError(safe.detail.message);
      if (safe.detail.retryAfter)
        setRetryAt(retryDeadline(safe.detail.retryAfter));
      setStatus("Nothing was applied. Your work is preserved.");
    } finally {
      locked.current = false;
      setGenerating(false);
    }
  }
  function accept(recommendationId?: string) {
    if (!proposal) return;
    const selected = proposal;
    confirm({
      title: "Accept this proposed change?",
      description:
        selected.output.kind === "rescue"
          ? "This adopts the selected qualitative idea only. It does not change allocations, booked costs or payments."
          : selected.output.kind === "schedule"
            ? "This replaces the event-day schedule, including any unsaved schedule edits. Existing preparation tasks, vendor decisions, money, dates and currency remain unchanged."
            : "Only the displayed ideas or invitation section will be replaced. Financial totals, event details, completed tasks and vendor decisions remain unchanged.",
      action: async () => {
        let acceptedSchedule: DayOfSchedule | undefined;
        const success = await update((current) => {
          if (
            JSON.stringify(minimalContext(current)) !== selected.originalContext
          )
            throw new Error(
              "Plan facts changed after generation. Generate a fresh preview before accepting.",
            );
          if (selected.output.kind === "rescue") {
            const item = selected.output.recommendations.find(
              (item) => item.recommendationId === recommendationId,
            );
            if (!item) throw new Error("Choose a recommendation to adopt");
            return {
              ...current,
              enhancements: {
                ...current.enhancements,
                adoptedRescue: [
                  ...current.enhancements.adoptedRescue.filter(
                    (existing) =>
                      existing.recommendationId !== item.recommendationId,
                  ),
                  item,
                ],
              },
            };
          }
          const currentTarget =
            selected.output.kind === "ideas"
              ? JSON.stringify(current.plan.ideas)
              : selected.output.kind === "invitations"
                ? JSON.stringify(current.plan.invitations)
                : JSON.stringify(current.enhancements.schedule ?? null);
          if (currentTarget !== selected.original)
            throw new Error(
              "This section changed while the preview was open. Review a fresh proposal before replacing it.",
            );
          if (selected.output.kind === "schedule") {
            if (!selected.input.window)
              throw new Error("Missing schedule window");
            acceptedSchedule = validateSchedule(current.plan, {
              ...selected.input.window,
              activities: selected.output.activities,
              source: selected.source === "demo" ? "demo" : "ai",
              updatedAt: new Date().toISOString(),
            });
            return {
              ...current,
              enhancements: {
                ...current.enhancements,
                schedule: acceptedSchedule,
              },
            };
          }
          return applyRefinement(
            current,
            selected.input.action!,
            selected.output,
          );
        });
        if (success) {
          setProposal(undefined);
          setStatus(
            "Selected change accepted and saved, or retained in this tab if storage is restricted.",
          );
          if (acceptedSchedule) onScheduleAccepted?.(acceptedSchedule);
        }
        return success;
      },
    });
  }

  return {
    workspace,
    action,
    setAction,
    preferences,
    setPreferences,
    proposal,
    setProposal,
    generating,
    status,
    setStatus,
    error,
    retryAt,
    handleGenerate,
    cancel: () => controller.current?.abort(),
    accept,
  };
}
