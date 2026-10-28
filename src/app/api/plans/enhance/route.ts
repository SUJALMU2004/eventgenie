import { createOperationHandler } from "@/lib/ai/operation-handler";
import { streamStructured } from "@/lib/ai/structured";
import {
  OPERATION_SYSTEM,
  operationPrompt,
  outputSchemaFor,
} from "@/lib/ai/operations";
export const runtime = "nodejs";
export const maxDuration = 120;
export const POST = createOperationHandler(
  (input, signal) =>
    streamStructured(
      outputSchemaFor(input),
      OPERATION_SYSTEM,
      operationPrompt(input),
      signal,
      4000,
    ),
  () =>
    Boolean(
      process.env.GOOGLE_GENERATIVE_AI_API_KEY &&
      process.env.GOOGLE_GENERATIVE_AI_API_KEY !== "YOUR_GEMINI_API_KEY",
    ),
);
