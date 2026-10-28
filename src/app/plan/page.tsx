import { EventWizard } from "@/features/event-setup/wizard";
import { eventTypeSchema } from "@/schemas/event";

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const initialType = eventTypeSchema.safeParse(query.type),
    sampleType = eventTypeSchema.safeParse(query.demo);
  return (
    <EventWizard
      initialType={initialType.success ? initialType.data : undefined}
      sampleType={sampleType.success ? sampleType.data : undefined}
    />
  );
}
