"use client";
import { useEffect, useRef, useState } from "react";
import {
  emptyEvent,
  generationInputSchema,
  type EventInput,
  type EventType,
} from "@/schemas/event";
import type { EventPlan, PlanPreview } from "@/schemas/plan";
import { budgetCategories } from "@/data/templates";
import { demoEvent, createDemoPlan } from "@/data/demo";
import { moneyInput } from "@/features/budget/engine";
import { planRepository } from "@/lib/storage/repository";
import { consumePlanStream } from "@/lib/stream-client";
import { inputFingerprint } from "@/lib/fingerprint";
import { AppFailure, safeError } from "@/lib/errors";
import { retryWaitSeconds, retryDeadline } from "@/lib/retry";
export type WizardOptions = { initialType?: EventType; sampleType?: EventType };
const stepFields: (keyof EventInput)[][] = [
  ["eventType", "title", "subtype"],
  ["date", "city", "guests", "budgetMinor", "currency"],
  [
    "style",
    "setting",
    "food",
    "culture",
    "priorities",
    "requirements",
    "notes",
  ],
];
type Errors = Partial<Record<keyof EventInput, string>>;

export function useEventWizard({ initialType, sampleType }: WizardOptions) {
  const [event, setEvent] = useState<EventInput>(() =>
    sampleType ? demoEvent(sampleType) : emptyEvent(initialType),
  );
  const [budgetText, setBudgetText] = useState(() =>
    moneyInput(event.budgetMinor, event.currency),
  );
  const [step, setStep] = useState(0),
    [errors, setErrors] = useState<Errors>({});
  const [initialized, setInitialized] = useState(false),
    [storageNotice, setStorageNotice] = useState("");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState<PlanPreview>({});
  const [status, setStatus] = useState("Validating requirements"),
    [result, setResult] = useState<EventPlan>();
  const [saved, setSaved] = useState(false),
    [resultNotice, setResultNotice] = useState("");
  const [retryAt, setRetryAt] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null),
    abort = useRef<AbortController | null>(null),
    generating = useRef(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        if (!sampleType) {
          const draft = await planRepository.loadDraft();
          if (draft && active) {
            const restored = {
              ...draft,
              eventType: initialType ?? draft.eventType,
            };
            restored.priorities = restored.priorities.filter((priority) =>
              budgetCategories[restored.eventType].some(
                (category) => category.id === priority,
              ),
            );
            setEvent(restored);
            setBudgetText(moneyInput(restored.budgetMinor, restored.currency));
          }
        }
      } catch (error) {
        if (active)
          setStorageNotice(
            error instanceof Error
              ? error.message
              : "Draft storage is unavailable.",
          );
      } finally {
        if (active) setInitialized(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [initialType, sampleType]);
  useEffect(() => {
    if (!initialized || result || busy) return;
    const timer = setTimeout(() => {
      void planRepository
        .saveDraft(event)
        .catch((error) =>
          setStorageNotice(
            error instanceof Error
              ? error.message
              : "Draft could not be saved.",
          ),
        );
    }, 400);
    return () => clearTimeout(timer);
  }, [event, initialized, result, busy]);
  useEffect(() => () => abort.current?.abort(), []);

  function update<K extends keyof EventInput>(key: K, value: EventInput[K]) {
    setEvent((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }
  function validate(fields?: (keyof EventInput)[]): boolean {
    const checked = generationInputSchema().safeParse(event);
    const next: Errors = {};
    if (!checked.success)
      for (const issue of checked.error.issues) {
        const field = issue.path[0] as keyof EventInput;
        if ((!fields || fields.includes(field)) && !next[field])
          next[field] = issue.message;
      }
    setErrors(next);
    return Object.keys(next).length === 0;
  }
  function goTo(next: number) {
    setStep(next);
    setErrors({});
    setError("");
    requestAnimationFrame(() => heading.current?.focus());
  }
  function nextStep() {
    if (validate(stepFields[step])) goTo(step + 1);
    else
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus(),
      );
  }
  const inputProps = (name: keyof EventInput, hint = false) => ({
    id: name,
    name,
    "aria-invalid": Boolean(errors[name]),
    "aria-describedby":
      [hint ? `${name}-hint` : "", errors[name] ? `${name}-error` : ""]
        .filter(Boolean)
        .join(" ") || undefined,
  });

  async function finish(plan: EventPlan) {
    let persisted = false;
    try {
      await planRepository.savePlan(plan);
      persisted = true;
      await planRepository.clearDraft();
    } catch (error) {
      setResultNotice(
        error instanceof Error
          ? error.message
          : "Could not save this plan. Keep this tab open.",
      );
    }
    setSaved(persisted);
    setResult(plan);
    window.scrollTo({ top: 0 });
  }
  async function generate(demo = false) {
    if (generating.current) return;
    if (!validate()) {
      setStep(1);
      requestAnimationFrame(() => heading.current?.focus());
      return;
    }
    const waitSeconds = retryWaitSeconds(retryAt);
    if (!demo && waitSeconds > 0) {
      setError(
        `Please wait ${waitSeconds} seconds before retrying AI generation. You can use a sample now.`,
      );
      return;
    }
    generating.current = true;
    setBusy(true);
    setError("");
    setPreview({});
    setStatus("Validating requirements");
    abort.current = new AbortController();
    try {
      if (demo) {
        await finish(await createDemoPlan(event));
        return;
      }
      try {
        const cached = await planRepository.findReusable(
          await inputFingerprint(event),
        );
        if (cached) {
          setSaved(true);
          setResultNotice(
            "Reopened your existing AI plan. No new AI request was made.",
          );
          setResult(cached);
          return;
        }
      } catch (error) {
        setStorageNotice(
          error instanceof Error
            ? error.message
            : "Local cache is unavailable.",
        );
      }
      setStatus("Generating your event blueprint");
      const response = await fetch("/api/plans/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
        signal: abort.current.signal,
      });
      const plan = await consumePlanStream(response, (value) => {
        setPreview(value);
        setStatus(
          value.ideas?.length
            ? "Celebration ideas received; waiting for final validation"
            : value.vendors?.length
              ? "Vendor preview received; continuing the plan"
              : value.tasks?.length
                ? "Timeline preview received; continuing the plan"
                : "Event overview received; continuing the plan",
        );
      });
      setStatus("Final plan validated. Saving in this browser.");
      await finish(plan);
    } catch (error) {
      const detail =
        error instanceof AppFailure ? error.detail : safeError(error).detail;
      setError(detail.message);
      if (detail.retryAfter) setRetryAt(retryDeadline(detail.retryAfter));
    } finally {
      generating.current = false;
      setBusy(false);
    }
  }

  return {
    event,
    budgetText,
    setBudgetText,
    step,
    errors,
    initialized,
    storageNotice,
    error,
    busy,
    preview,
    status,
    result,
    saved,
    resultNotice,
    heading,
    abort,
    update,
    goTo,
    nextStep,
    inputProps,
    generate,
  };
}
