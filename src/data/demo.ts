import {
  budgetCategories,
  eventLabels,
  taskTemplates,
  vendorTemplates,
} from "./templates";
import { addDays, today } from "@/lib/dates";
import { inputFingerprint } from "@/lib/fingerprint";
import { normalizePlan } from "@/lib/normalize";
import { emptyEvent, type EventInput, type EventType } from "@/schemas/event";
import type { Recommendations } from "@/schemas/plan";

export function demoEvent(
  type: EventType,
  clock: () => Date = () => new Date(),
): EventInput {
  return {
    ...emptyEvent(type),
    title: {
      wedding: "Ananya & Aarav's wedding",
      birthday: "Meera's birthday celebration",
      community: "Our neighbourhood cultural day",
    }[type],
    city: "Hubballi",
    date: addDays(today(clock), 120),
    guests: type === "wedding" ? 250 : type === "birthday" ? 40 : 150,
    budgetMinor:
      type === "wedding" ? 50000000 : type === "birthday" ? 4000000 : 15000000,
    food: "Vegetarian",
    style: "Warm, welcoming and thoughtful",
    priorities: ["catering", "venue"],
  };
}
export function demoRecommendations(event: EventInput): Recommendations {
  const type = event.eventType;
  return {
    overview: {
      description: `A ${event.style || "thoughtful"} ${eventLabels[type].toLowerCase()} for ${event.guests} guests in ${event.city}. This is a deterministic sample blueprint, not a live AI result.`,
      approach:
        "Book the essentials first, choose a small number of meaningful details, and leave room for the unexpected.",
      priorities: [
        "Guest comfort",
        "A clear budget",
        "A relaxed running order",
      ],
      considerations: [
        "Ask suppliers for written estimates; allocations are planning estimates, not verified market prices.",
        "Confirm dietary needs and step-free access.",
      ],
    },
    budgetNotes: budgetCategories[type].map((category) => ({
      category: category.id,
      explanation: `Use the ${category.label.toLowerCase()} allocation as a starting estimate and compare written quotes before committing.`,
    })),
    tasks: taskTemplates[type].map((task) => ({
      ...task,
      priority: task.daysBefore >= 60 ? "high" : "medium",
    })),
    vendors: vendorTemplates[type].map((vendor, index) => ({
      ...vendor,
      questions: [...vendor.questions],
      priority: index < 2 ? "high" : "medium",
      daysBefore: index < 2 ? 70 : 35,
    })),
    ideas: [
      {
        category: "Theme",
        title:
          type === "wedding"
            ? "A marigold welcome"
            : type === "birthday"
              ? "A wall of favourite memories"
              : "A neighbourhood story corner",
        description: `Create one welcoming focal point that reflects ${event.title}. Borrow or reuse elements where possible.`,
      },
      {
        category: "Food",
        title: "A thoughtful shared table",
        description: `Offer ${event.food || "clearly labelled"} options, drinking water and smaller serving batches to reduce waste.`,
      },
      {
        category: "Guest experience",
        title:
          type === "community"
            ? "A volunteer welcome team"
            : "A little room to pause",
        description:
          "Provide clear directions, comfortable seating and a quiet corner away from speakers.",
      },
      {
        category: "Budget-friendly",
        title:
          type === "birthday"
            ? "A favourite-song game"
            : type === "wedding"
              ? "Messages for the couple"
              : "A shared community playlist",
        description:
          "Invite guests to contribute a favourite song or short message. Keep participation optional and accessible.",
      },
    ],
    invitations: [
      `You're warmly invited to ${event.title} on ${event.date} in ${event.city}. Join us for good company and a memorable celebration. Please let the host know about dietary or accessibility needs.`,
      `Let's celebrate together! Save ${event.date} for ${event.title} in ${event.city}. More details from your host soon.`,
    ],
    warnings: [
      "Sample data: verify all timings, permissions and supplier arrangements yourself. No suppliers or prices have been verified.",
    ],
  };
}
export async function createDemoPlan(
  event: EventInput,
  clock: () => Date = () => new Date(),
) {
  return normalizePlan(
    event,
    demoRecommendations(event),
    await inputFingerprint(event),
    "demo",
    clock,
  );
}
