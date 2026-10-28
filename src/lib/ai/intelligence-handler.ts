import { createStructuredHandler } from "./http-stream";
import { failure } from "@/lib/errors";
import {
  validateIntelligenceRequest,
  normalizeIntelligence,
  intelligencePreview,
} from "./intelligence";
import type { IntelligenceRequest } from "@/schemas/intelligence";
import type { ProviderChunk } from "./structured";
export type IntelligenceProvider = (
  input: IntelligenceRequest,
  signal: AbortSignal,
) => AsyncIterable<ProviderChunk>;
export function createIntelligenceHandler(
  provider: IntelligenceProvider,
  configured: () => boolean,
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>,
) {
  return createStructuredHandler({
    configured,
    sleep,
    parseInput(raw) {
      try {
        return validateIntelligenceRequest(raw);
      } catch {
        throw failure(
          "INVALID_INPUT",
          "Check the bounded question, preferences and relevant plan context. Do not include contact details.",
          400,
        );
      }
    },
    provider: async function* (input, signal) {
      for await (const chunk of provider(input, signal)) {
        if (chunk.type === "partial") {
          const data = intelligencePreview(input, chunk.data);
          if (data) yield { type: "partial", data };
        } else yield chunk;
      }
    },
    normalize: normalizeIntelligence,
    preview: (raw) => raw,
    frames: {
      preview: (data) => ({ version: 3, type: "preview", data }),
      complete: (data) => ({ version: 3, type: "complete", data }),
      error: (error) => ({ version: 3, type: "error", error }),
    },
  });
}
