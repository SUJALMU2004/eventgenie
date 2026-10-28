import { createGenerateHandler } from "@/lib/ai/handler";
import { generateWithGemini } from "@/lib/ai/provider";

export const runtime = "nodejs";
export const maxDuration = 120;
export const POST = createGenerateHandler(generateWithGemini, () =>
  Boolean(
    process.env.GOOGLE_GENERATIVE_AI_API_KEY &&
    process.env.GOOGLE_GENERATIVE_AI_API_KEY !== "YOUR_GEMINI_API_KEY",
  ),
);
