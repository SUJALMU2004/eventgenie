import { describe, it, expect } from "vitest";
import { cacheIntelligence, cachedIntelligence } from "./intelligence-cache";
import { buildIntelligenceRequest, offlineIntelligence } from "./intelligence";
import { emptyIntelligence } from "@/schemas/intelligence";
import { emptyEnhancements } from "@/schemas/enhancements";
import { plan, clock } from "@/test/fixtures";
const input = () =>
  buildIntelligenceRequest(
    { plan, enhancements: emptyEnhancements(plan.id) },
    { operation: "ask-plan", question: "Which tasks are urgent?" },
    clock,
  );
describe("owned bounded intelligence cache", () => {
  it("reuses only complete validated content within its TTL", () => {
    const request = input(),
      output = offlineIntelligence(request),
      data = cacheIntelligence(emptyIntelligence(), "fp", output, clock),
      now = clock().getTime();
    expect(cachedIntelligence(data, "fp", request, now)).toEqual(output);
    expect(cachedIntelligence(data, "missing", request, now)).toBeUndefined();
    expect(cachedIntelligence(undefined, "fp", request, now)).toBeUndefined();
    expect(
      cachedIntelligence(data, "fp", request, now + 86400000),
    ).toBeUndefined();
    expect(cachedIntelligence(data, "fp", request, now - 1)).toBeUndefined();
  });
  it("rejects a cached answer with references outside the current request", () => {
    const request = input(),
      output = offlineIntelligence(request);
    if (output.kind !== "answer") throw new Error("fixture");
    const data = cacheIntelligence(
      emptyIntelligence(),
      "fp",
      { ...output, references: ["task-99"] },
      clock,
    );
    expect(
      cachedIntelligence(data, "fp", request, clock().getTime()),
    ).toBeUndefined();
  });
  it("bounds at ten entries and replaces identical fingerprints", () => {
    const output = offlineIntelligence(input());
    let data = emptyIntelligence();
    for (let n = 0; n < 12; n++)
      data = cacheIntelligence(data, `fp-${n}`, output, clock);
    expect(data.cache).toHaveLength(10);
    expect(data.cache.some((entry) => entry.fingerprint === "fp-0")).toBe(
      false,
    );
    data = cacheIntelligence(data, "fp-11", output, clock);
    expect(data.cache).toHaveLength(10);
    expect(
      data.cache.filter((entry) => entry.fingerprint === "fp-11"),
    ).toHaveLength(1);
  });
  it("uses the normal clock without caching sample results automatically", () => {
    const request = input(),
      data = emptyIntelligence();
    offlineIntelligence(request);
    expect(data.cache).toEqual([]);
    const cached = cacheIntelligence(
      data,
      "current",
      offlineIntelligence(request),
    );
    expect(cachedIntelligence(cached, "current", request)).toBeDefined();
  });
});
