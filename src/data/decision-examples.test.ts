import { expect, it } from "vitest";
import { eventTypes } from "@/schemas/event";
import { emptyEnhancements } from "@/schemas/enhancements";
import { createDemoPlan, demoEvent } from "./demo";
import { addDecisionExamples } from "./decision-examples";
import { validateWorkspace } from "@/lib/planning/workspace";
import { clock } from "@/test/fixtures";
it.each(eventTypes)(
  "adds explicit fictional %s records without changing the active plan",
  async (type) => {
    const plan = await createDemoPlan(demoEvent(type, clock), clock),
      workspace = { plan, enhancements: emptyEnhancements(plan.id) };
    const examples = addDecisionExamples(workspace, clock);
    expect(validateWorkspace(examples.plan, examples.enhancements)).toEqual(
      examples,
    );
    expect(examples.plan).toEqual(plan);
    expect(
      examples.enhancements.quotes.every((quote) => quote.source === "demo"),
    ).toBe(true);
    expect(examples.enhancements.scenarios).toHaveLength(1);
    expect(examples.enhancements.schedule?.source).toBe("demo");
    expect(() => addDecisionExamples(examples, clock)).toThrow("empty");
  },
);
