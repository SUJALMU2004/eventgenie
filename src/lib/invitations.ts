import type { invitationToneSchema } from "@/schemas/intelligence";
import {
  invitationFactsSchema,
  type PlanIntelligence,
} from "@/schemas/intelligence";
import { formatDate } from "./dates";
import type { EventPlan } from "@/schemas/plan";
export function invitationBody(text: string) {
  return text.split("\n\n— Event details —\n")[0];
}
export function invitationTemplate(
  tone: ReturnType<typeof invitationToneSchema.parse>,
  length: "short" | "detailed",
  eventType: EventPlan["event"]["eventType"],
) {
  const openings = {
    formal: "You are cordially invited to our celebration.",
    friendly: "We would love to celebrate with you!",
    elegant:
      "Please join us for a beautiful moment shared with the people we cherish.",
    minimal: "Please join our celebration.",
    playful:
      eventType === "birthday"
        ? "Bring your favourite smile—it's time for a birthday celebration!"
        : "Good company, happy moments and a celebration to remember!",
  };
  return (
    openings[tone] +
    (length === "detailed"
      ? "\n\nYour presence would mean a great deal. Please let the organiser know about dietary or accessibility needs."
      : "")
  );
}
export function composeInvitation(
  plan: EventPlan,
  body: string,
  raw: PlanIntelligence["invitationFacts"],
): string {
  const facts = invitationFactsSchema.parse(raw);
  if (!body.trim() || body.length > 1000)
    throw new Error(
      "Keep the invitation message between 1 and 1,000 characters.",
    );
  return `${body.trim()}\n\n— Event details —\n${plan.event.title}\nDate: ${formatDate(plan.event.date)}\nTime: ${facts.time || "[Time to confirm]"}\nVenue: ${facts.venue || "[Venue to confirm]"}\nCity / area: ${plan.event.city}\nRSVP: ${facts.rsvp || "[RSVP details to confirm]"}`;
}
export async function copyInvitation(
  text: string,
  clipboard?: Pick<Clipboard, "writeText">,
): Promise<"copied" | "manual"> {
  try {
    if (!clipboard) return "manual";
    await clipboard.writeText(text);
    return "copied";
  } catch {
    return "manual";
  }
}
export async function shareInvitation(
  text: string,
  share?: Navigator["share"],
): Promise<"shared" | "cancelled" | "fallback"> {
  if (!share) return "fallback";
  try {
    await share({ text });
    return "shared";
  } catch (error) {
    return typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "AbortError"
      ? "cancelled"
      : "fallback";
  }
}
export function downloadText(
  text: string,
  filename: string,
  mime = "text/plain;charset=utf-8",
) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
