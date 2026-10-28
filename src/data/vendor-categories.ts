import { vendorTemplates } from "./templates";
import type { EventType, Priority } from "@/schemas/event";
const mapping: Record<EventType, readonly Priority[]> = {
  wedding: ["venue", "catering", "photography", "decor"],
  birthday: ["cake", "catering", "entertainment", "venue"],
  community: ["venue", "av", "catering", "safety"],
};
/** Labels and questions remain owned by the original Phase 1 templates. */
export function vendorCategories(type: EventType) {
  return vendorTemplates[type].map((template, index) => ({
    ...template,
    id: mapping[type][index],
  }));
}
