import { fingerprintData } from "@/lib/fingerprint";
import {
  operationRequestSchema,
  type OperationRequest,
} from "@/schemas/operations";
import type { PlanEnhancements } from "@/schemas/enhancements";
export const OPERATION_CACHE_VERSION = "operations-v2-prompt1";
export function operationFingerprint(input: OperationRequest) {
  return fingerprintData(
    OPERATION_CACHE_VERSION,
    operationRequestSchema.parse(input),
  );
}
export function cachedOperation(
  cache: PlanEnhancements["cache"],
  fingerprint: string,
  now = Date.now(),
) {
  return cache.find(
    (entry) =>
      entry.fingerprint === fingerprint &&
      now - Date.parse(entry.createdAt) < 24 * 60 * 60 * 1000 &&
      now >= Date.parse(entry.createdAt),
  );
}
