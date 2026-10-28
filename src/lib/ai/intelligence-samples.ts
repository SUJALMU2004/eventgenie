import type {
  IntelligenceRequest,
  IntelligenceOutput,
} from "@/schemas/intelligence";
import { normalizeIntelligence } from "./intelligence-output";
export function offlineIntelligence(
  input: IntelligenceRequest,
): IntelligenceOutput {
  const type = input.context.eventType,
    category =
      type === "wedding" ? "venue" : type === "birthday" ? "cake" : "logistics";
  const limitations = [
    "This is a deterministic sample, not a live AI result. Confirm feasibility with the organiser.",
  ];
  const value: IntelligenceOutput =
    input.operation === "ask-plan"
      ? {
          kind: "answer",
          answer: `For this ${type}, finish the essential recorded decisions before adding optional details. Use the calculated facts shown alongside this advice.`,
          references: input.context.references.slice(0, 2),
          ideas: [
            "Ask the organiser to confirm responsibility for the next unfinished decision.",
          ],
          assumptions: [
            "The saved checklist reflects the organiser's latest knowledge.",
          ],
          limitations,
        }
      : input.operation === "contingency-playbook"
        ? {
            kind: "playbook",
            summary: `Review this hypothetical ${type} disruption with the organiser.`,
            immediateActions: [
              type === "wedding"
                ? "Confirm a practical backup ceremony arrangement."
                : type === "birthday"
                  ? "Protect the cake moment and choose a simple alternative activity."
                  : "Brief volunteers on accessible backup arrangements.",
            ],
            alternatives: [
              "Simplify optional elements while protecting guest comfort.",
            ],
            references: input.context.references.slice(0, 2),
            assumptions: [
              "Recorded contracts remain binding until the organiser verifies otherwise.",
            ],
            limitations,
          }
        : input.operation === "task-suggestions"
          ? {
              kind: "tasks",
              tasks: [
                {
                  title: `Confirm the ${type} fallback briefing`,
                  reason:
                    "Agree responsibilities and a practical backup arrangement.",
                  category,
                  daysBefore: 3,
                  priority: "high",
                  relatedReferences: [],
                  assumptions: ["The organiser will confirm availability."],
                },
              ],
            }
          : {
              kind: "invitation",
              opening:
                input.tone === "formal"
                  ? "You are cordially invited to join our celebration."
                  : input.tone === "playful"
                    ? "Bring your favourite smile and join the celebration!"
                    : input.tone === "elegant"
                      ? "We would be delighted to share a beautiful celebration with you."
                      : input.tone === "minimal"
                        ? "Please join our celebration."
                        : "We would love to celebrate with you.",
              closing:
                input.length === "short"
                  ? "We hope you can join us."
                  : "Your presence would mean a great deal. Please let the organiser know about dietary or accessibility needs.",
            };
  return normalizeIntelligence(input, value);
}
