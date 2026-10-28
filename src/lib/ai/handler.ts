import { generationInputSchema } from "@/schemas/event";
import { inputFingerprint } from "@/lib/fingerprint";
import { normalizePlan } from "@/lib/normalize";
import { failure } from "@/lib/errors";
import { validPreview } from "./preview";
import { createStructuredHandler } from "./http-stream";
import type { GenerateProvider } from "./provider";
export function createGenerateHandler(
  provider: GenerateProvider,
  configured: () => boolean,
  clock: () => Date = () => new Date(),
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>,
) {
  return createStructuredHandler({
    provider,
    configured,
    sleep,
    parseInput(raw) {
      const validation = generationInputSchema(clock).safeParse(raw);
      if (!validation.success)
        throw failure(
          "INVALID_INPUT",
          validation.error.issues[0]?.message ?? "Check your event details.",
          400,
        );
      return validation.data;
    },
    async normalize(event, raw) {
      return normalizePlan(
        event,
        raw,
        await inputFingerprint(event),
        "ai",
        clock,
      );
    },
    preview(raw) {
      const value = validPreview(raw);
      return value.overview ||
        value.tasks?.length ||
        value.vendors?.length ||
        value.ideas?.length
        ? value
        : null;
    },
    frames: {
      preview: (data) => ({ type: "preview", data }),
      complete: (data) => ({ type: "complete", data }),
      error: (error) => ({ type: "error", error }),
    },
  });
}
