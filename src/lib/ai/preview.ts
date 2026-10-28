import {
  aiTaskSchema,
  aiVendorSchema,
  ideaSchema,
  overviewSchema,
  type PlanPreview,
} from "@/schemas/plan";

export function validPreview(value: unknown): PlanPreview {
  if (typeof value !== "object" || value === null) return {};
  const preview: PlanPreview = {};
  if ("overview" in value) {
    const parsed = overviewSchema.safeParse(value.overview);
    if (parsed.success) preview.overview = parsed.data;
  }
  if ("tasks" in value && Array.isArray(value.tasks))
    preview.tasks = value.tasks.slice(0, 20).flatMap((item) => {
      const parsed = aiTaskSchema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    });
  if ("vendors" in value && Array.isArray(value.vendors))
    preview.vendors = value.vendors.slice(0, 10).flatMap((item) => {
      const parsed = aiVendorSchema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    });
  if ("ideas" in value && Array.isArray(value.ideas))
    preview.ideas = value.ideas.slice(0, 6).flatMap((item) => {
      const parsed = ideaSchema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    });
  return preview;
}
