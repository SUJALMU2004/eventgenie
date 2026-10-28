import { notFound } from "next/navigation";
import { z } from "zod";
import { SavedPlan } from "@/features/event-plan/saved-plan";
export default async function SavedPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  return <SavedPlan id={id} />;
}
