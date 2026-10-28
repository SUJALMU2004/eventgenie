import { createStructuredHandler } from "./http-stream";
import {
  normalizeOperation,
  operationPreview,
  validateOperationRequest,
} from "./operations";
import type { ProviderChunk } from "./structured";
import type { OperationRequest } from "@/schemas/operations";
import { failure, AppFailure } from "@/lib/errors";
export type OperationProvider = (
  input: OperationRequest,
  signal: AbortSignal,
) => AsyncIterable<ProviderChunk>;
export function createOperationHandler(
  provider: OperationProvider,
  configured: () => boolean,
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>,
) {
  return createStructuredHandler({
    provider: operationPreviewProvider(provider),
    configured,
    sleep,
    parseInput(raw) {
      try {
        return validateOperationRequest(raw);
      } catch (error) {
        if (error instanceof AppFailure) throw error;
        throw failure(
          "INVALID_INPUT",
          "Check the operation, category, time window and bounded preferences. Contact details are not permitted.",
          400,
        );
      }
    },
    normalize: normalizeOperation,
    preview: (raw) => raw,
    frames: {
      preview: (data) => ({ version: 2, type: "preview", data }),
      complete: (data) => ({ version: 2, type: "complete", data }),
      error: (error) => ({ version: 2, type: "error", error }),
    },
  });
}
/** Bind the request-specific item schema without adding any provider calls. */
export function operationPreviewProvider(
  provider: OperationProvider,
): OperationProvider {
  return async function* (input, signal) {
    for await (const chunk of provider(input, signal)) {
      if (chunk.type === "partial") {
        const value = operationPreview(input, chunk.data);
        if (value) yield { type: "partial", data: value };
      } else yield chunk;
    }
  };
}
