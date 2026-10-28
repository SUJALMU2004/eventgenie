import { createIntelligenceHandler } from "@/lib/ai/intelligence-handler";
import {
  intelligenceSchemaFor,
  INTELLIGENCE_SYSTEM,
  intelligencePrompt,
} from "@/lib/ai/intelligence";
import { streamStructured } from "@/lib/ai/structured";
export const runtime = "nodejs";
export const maxDuration = 120;
export const POST = createIntelligenceHandler(
  (input, signal) =>
    streamStructured(
      intelligenceSchemaFor(input),
      INTELLIGENCE_SYSTEM,
      intelligencePrompt(input),
      signal,
      3000,
    ),
  () =>
    Boolean(
      process.env.GOOGLE_GENERATIVE_AI_API_KEY &&
      process.env.GOOGLE_GENERATIVE_AI_API_KEY !== "YOUR_GEMINI_API_KEY",
    ),
);
