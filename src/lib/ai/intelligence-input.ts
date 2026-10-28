import {
  intelligenceRequestSchema,
  type IntelligenceRequest,
} from "@/schemas/intelligence";
import { exactFinancialQuestion } from "./intelligence-contracts";
type Context = IntelligenceRequest["context"];

function validateContextPrivacy(input: IntelligenceRequest) {
  const context = input.context;
  if (input.operation === "invitation-refinement") {
    const privateFacts = [
      context.eventDate,
      context.today,
      context.guests,
      context.currency,
      context.finances,
    ];
    const privateCollections = [
      context.tasks,
      context.categories,
      context.vendors,
      context.priorities,
    ];
    if (
      privateFacts.some((value) => value !== undefined) ||
      privateCollections.some((items) => items.length > 0)
    )
      throw new Error(
        "Invitation AI accepts generic event type, tone and length only.",
      );
  } else if (
    [context.eventDate, context.today, context.guests, context.currency].some(
      (value) => value === undefined,
    )
  ) {
    throw new Error("Required event context is missing.");
  }
}
function validateOperationFields(input: IntelligenceRequest) {
  if (
    (input.operation !== "contingency-playbook" && input.contingency) ||
    (input.operation !== "invitation-refinement" &&
      (input.tone || input.length)) ||
    (input.operation !== "ask-plan" && input.question)
  )
    throw new Error("Unsupported fields for this planning operation.");
}
function validateRequiredDetails(input: IntelligenceRequest) {
  if (input.operation === "ask-plan" && exactFinancialQuestion(input.question))
    throw new Error(
      "Exact financial questions are answered by local calculations, without AI.",
    );
  if (input.operation === "contingency-playbook" && !input.contingency)
    throw new Error("Choose a contingency.");
  if (input.operation === "ask-plan" && !input.question.trim())
    throw new Error("Ask a bounded plan-specific question.");
  if (
    input.operation === "invitation-refinement" &&
    (!input.tone || !input.length)
  )
    throw new Error("Choose invitation tone and length.");
}
function validateTaskReferences(context: Context) {
  const references = new Set(context.references);
  const taskReferences = new Set(context.tasks.map((task) => task.ref));
  if (
    references.size !== context.references.length ||
    taskReferences.size !== context.tasks.length
  )
    throw new Error("Duplicate plan references.");
  const unknownReferences = context.references.some(
    (ref) => ref.startsWith("task-") && !taskReferences.has(ref),
  );
  const invalidTasks = context.tasks.some(
    (task) =>
      !references.has(task.ref) ||
      !/^task-(?:[1-9]|[1-5]\d|60)$/.test(task.ref) ||
      !context.categories.includes(task.category),
  );
  if (unknownReferences || invalidTasks)
    throw new Error("Invalid task references or categories.");
}
/** Operation-specific constraints supplement the shared bounded wire schema. */
export function validateIntelligenceRequest(raw: unknown): IntelligenceRequest {
  const input = intelligenceRequestSchema.parse(raw);
  validateContextPrivacy(input);
  validateOperationFields(input);
  validateRequiredDetails(input);
  validateTaskReferences(input.context);
  const contingencyTask = input.contingency?.taskRef;
  if (
    contingencyTask &&
    !input.context.tasks.some((task) => task.ref === contingencyTask)
  )
    throw new Error("Unknown contingency task reference.");
  return input;
}
