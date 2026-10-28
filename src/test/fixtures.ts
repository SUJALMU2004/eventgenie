import { demoEvent, demoRecommendations } from "@/data/demo";
import { normalizePlan } from "@/lib/normalize";
export const clock = () => new Date("2026-10-26T12:00:00.000Z");
export const event = demoEvent("wedding", clock);
export const recommendations = demoRecommendations(event);
export const plan = normalizePlan(
  event,
  recommendations,
  "test-fingerprint",
  "ai",
  clock,
  "aca1ae1f-118f-413a-bb00-f7f1759efb61",
);
