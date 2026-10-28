import { describe, expect, it } from "vitest";
import { validPreview } from "./preview";
import { recommendations } from "@/test/fixtures";
describe("partial preview safety", () => {
  it.each([undefined, null, "unfinished", 4])("ignores non-objects", (value) =>
    expect(validPreview(value)).toEqual({}),
  );
  it("discards incomplete sections and list items", () => {
    expect(
      validPreview({
        overview: { description: "partial" },
        tasks: [{ title: "incomplete" }],
        vendors: [null],
        ideas: [{}],
      }),
    ).toEqual({ tasks: [], vendors: [], ideas: [] });
  });
  it("emits only validated bounded sections", () => {
    const value = validPreview({
      ...recommendations,
      tasks: [...recommendations.tasks, ...recommendations.tasks],
      vendors: Array(15).fill(recommendations.vendors[0]),
      ideas: Array(9).fill(recommendations.ideas[0]),
    });
    expect(value.overview).toEqual(recommendations.overview);
    expect(value.tasks).toHaveLength(20);
    expect(value.vendors).toHaveLength(10);
    expect(value.ideas).toHaveLength(6);
  });
});
