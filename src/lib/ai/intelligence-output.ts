import { z } from "zod";
import {
  intelligenceOutputSchema,
  proposedTaskSchema,
  type IntelligenceRequest,
  type IntelligenceOutput,
} from "@/schemas/intelligence";
import { failure } from "@/lib/errors";
import { numericalClaim, kindFor } from "./intelligence-contracts";
export function intelligenceSchemaFor(input: IntelligenceRequest) {
  return intelligenceOutputSchema.options.find(
    (schema) => schema.shape.kind.value === kindFor[input.operation],
  )!;
}
export function normalizeIntelligence(
  input: IntelligenceRequest,
  raw: unknown,
): IntelligenceOutput {
  const value = intelligenceOutputSchema.parse(raw);
  if (value.kind !== kindFor[input.operation])
    throw failure(
      "INVALID_AI_OUTPUT",
      "The AI proposed an unsupported operation. Nothing was applied.",
      502,
      true,
    );
  const references =
    value.kind === "tasks"
      ? value.tasks.flatMap((task) => task.relatedReferences)
      : "references" in value
        ? value.references
        : [];
  if (references.some((ref) => !input.context.references.includes(ref)))
    throw failure(
      "INVALID_AI_OUTPUT",
      "The AI referenced information outside this plan. Nothing was applied.",
      502,
      true,
    );
  if (
    value.kind === "tasks" &&
    value.tasks.some(
      (task) =>
        !input.context.categories.includes(task.category) ||
        task.relatedReferences.some(
          (ref) => !input.context.tasks.some((task) => task.ref === ref),
        ),
    )
  )
    throw failure(
      "INVALID_AI_OUTPUT",
      "The proposed tasks used unsupported categories or references.",
      502,
      true,
    );
  const prose =
    value.kind === "answer"
      ? [
          value.answer,
          ...value.ideas,
          ...value.assumptions,
          ...value.limitations,
        ]
      : value.kind === "playbook"
        ? [
            value.summary,
            ...value.immediateActions,
            ...value.alternatives,
            ...value.assumptions,
            ...value.limitations,
          ]
        : value.kind === "tasks"
          ? value.tasks.flatMap((task) => [
              task.title,
              task.reason,
              ...task.assumptions,
            ])
          : [value.opening, value.closing];
  if (prose.some((text) => numericalClaim.test(text)))
    throw failure(
      "INVALID_AI_OUTPUT",
      "AI prose included numerical or financial claims. Use the calculated plan facts instead.",
      502,
      true,
    );
  return value;
}
export function intelligencePreview(input: IntelligenceRequest, raw: unknown) {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>,
    kind = kindFor[input.operation];
  if (kind === "tasks" && Array.isArray(record.tasks)) {
    const count = record.tasks.filter(
      (task) => proposedTaskSchema.safeParse(task).success,
    ).length;
    return count ? { section: kind, received: Math.min(5, count) } : null;
  }
  const field =
    kind === "answer"
      ? record.answer
      : kind === "playbook"
        ? record.summary
        : record.opening;
  return z
    .string()
    .trim()
    .min(1)
    .max(kind === "answer" ? 1200 : kind === "invitation" ? 220 : 500)
    .safeParse(field).success && !numericalClaim.test(String(field))
    ? { section: kind, received: 1, text: String(field) }
    : null;
}
