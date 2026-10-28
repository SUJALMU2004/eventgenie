import {
  streamMessageSchema,
  type PlanPreview,
  type EventPlan,
} from "@/schemas/plan";
import { consumeStructuredStream } from "./ndjson-client";
export function consumePlanStream(
  response: Response,
  preview: (value: PlanPreview) => void,
): Promise<EventPlan> {
  return consumeStructuredStream<PlanPreview, EventPlan>(
    response,
    preview,
    streamMessageSchema,
  );
}
