import {
  planIntelligenceSchema,
  type PlanIntelligence,
  type IntelligenceOutput,
  type IntelligenceRequest,
} from "@/schemas/intelligence";
import { normalizeIntelligence } from "./intelligence";
export function cachedIntelligence(
  intelligence: PlanIntelligence | undefined,
  fingerprint: string,
  input: IntelligenceRequest,
  now = Date.now(),
): IntelligenceOutput | undefined {
  const entry = intelligence?.cache.find(
    (item) =>
      item.fingerprint === fingerprint &&
      now >= Date.parse(item.createdAt) &&
      now - Date.parse(item.createdAt) < 86400000,
  );
  if (!entry) return undefined;
  try {
    return normalizeIntelligence(input, entry.result);
  } catch {
    return undefined;
  }
}
export function cacheIntelligence(
  intelligence: PlanIntelligence,
  fingerprint: string,
  result: IntelligenceOutput,
  clock: () => Date = () => new Date(),
): PlanIntelligence {
  return planIntelligenceSchema.parse({
    ...intelligence,
    cache: [
      { fingerprint, result, createdAt: clock().toISOString() },
      ...intelligence.cache.filter((item) => item.fingerprint !== fingerprint),
    ].slice(0, 10),
  });
}
