import { describe, it, expect } from "vitest";
import {
  invitationTemplate,
  composeInvitation,
  invitationBody,
  copyInvitation,
  shareInvitation,
} from "./invitations";
import {
  invitationToneSchema,
  emptyIntelligence,
} from "@/schemas/intelligence";
import { plan } from "@/test/fixtures";
import { eventTypes } from "@/schemas/event";
describe("private invitation variants and sharing fallbacks", () => {
  for (const type of eventTypes)
    it.each(invitationToneSchema.options)(
      `${type}: preserves recorded facts for %s tone`,
      (tone) => {
        const short = invitationTemplate(tone, "short", type),
          detailed = invitationTemplate(tone, "detailed", type);
        expect(detailed.length).toBeGreaterThan(short.length);
        const facts = {
            time: "18:00",
            venue: "A user-confirmed venue",
            rsvp: "Reply to the organiser",
          },
          text = composeInvitation(plan, short, facts);
        expect(text).toContain(plan.event.title);
        expect(text).toContain(plan.event.city);
        expect(text).toContain(facts.time);
        expect(text).toContain(facts.venue);
        expect(text).toContain(facts.rsvp);
        expect(invitationBody(text)).toBe(short);
      },
    );
  it("uses placeholders for unknown details and rejects invalid content", () => {
    const facts = emptyIntelligence().invitationFacts;
    expect(composeInvitation(plan, "Please join us", facts)).toContain(
      "[Venue to confirm]",
    );
    expect(() => composeInvitation(plan, "", facts)).toThrow();
    expect(() => composeInvitation(plan, "x".repeat(1001), facts)).toThrow();
    expect(invitationBody("Original draft")).toBe("Original draft");
  });
  it("copies only on an explicit caller action and offers a manual fallback", async () => {
    const writes: string[] = [];
    expect(
      await copyInvitation("Private draft", {
        writeText: async (text) => {
          writes.push(text);
        },
      }),
    ).toBe("copied");
    expect(writes).toEqual(["Private draft"]);
    expect(await copyInvitation("text")).toBe("manual");
    expect(
      await copyInvitation("text", {
        writeText: async () => {
          throw new Error("denied");
        },
      }),
    ).toBe("manual");
  });
  it("handles native share success, cancellation, absence and rejection", async () => {
    expect(await shareInvitation("Draft")).toBe("fallback");
    expect(
      await shareInvitation("Draft", async (data) => {
        expect(data?.text).toBe("Draft");
      }),
    ).toBe("shared");
    expect(
      await shareInvitation("Draft", async () => {
        throw new DOMException("User cancelled", "AbortError");
      }),
    ).toBe("cancelled");
    expect(
      await shareInvitation("Draft", async () => {
        throw new Error("unsupported");
      }),
    ).toBe("fallback");
  });
});
