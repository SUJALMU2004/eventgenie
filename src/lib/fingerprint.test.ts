import { describe, expect, it } from "vitest";
import { inputFingerprint, generationVersion } from "./fingerprint";
import { event } from "@/test/fixtures";
describe("private local reuse", () => {
  it("creates a stable versioned SHA-256 fingerprint", async () => {
    const a = await inputFingerprint(event),
      b = await inputFingerprint({ ...event });
    expect(a).toBe(b);
    expect(a).toMatch(new RegExp(`^${generationVersion}:[a-f0-9]{64}$`));
    expect(a).not.toContain(event.city);
  });
  it("treats priority ordering as a set but detects other changes", async () => {
    expect(
      await inputFingerprint({ ...event, priorities: ["venue", "catering"] }),
    ).toBe(
      await inputFingerprint({ ...event, priorities: ["catering", "venue"] }),
    );
    expect(await inputFingerprint(event)).not.toBe(
      await inputFingerprint({ ...event, guests: event.guests + 1 }),
    );
  });
});
