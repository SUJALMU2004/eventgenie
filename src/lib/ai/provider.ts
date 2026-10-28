import "server-only";
import { recommendationsSchema } from "@/schemas/plan";
import type { EventInput } from "@/schemas/event";
import { SYSTEM_PROMPT, eventPrompt } from "./prompt";
import { streamStructured, type ProviderChunk } from "./structured";
export type GenerateProvider = (
  event: EventInput,
  signal: AbortSignal,
) => AsyncIterable<ProviderChunk>;
export const generateWithGemini: GenerateProvider = (event, signal) =>
  streamStructured(
    recommendationsSchema,
    SYSTEM_PROMPT,
    eventPrompt(event),
    signal,
    8000,
  );
