import type { IntelligenceRequest } from "@/schemas/intelligence";
import type { Workspace } from "@/lib/planning/workspace";
import { fingerprintData } from "@/lib/fingerprint";
export const intelligenceFingerprint = (
  workspace: Workspace,
  input: IntelligenceRequest,
) =>
  fingerprintData("intelligence-v3-prompt1", {
    planId: workspace.plan.id,
    input,
  });
export const requestIdentity = (
  workspace: Workspace,
  input: IntelligenceRequest,
) =>
  JSON.stringify({
    planId: workspace.plan.id,
    input,
    taskIds: input.context.tasks.map(
      (task) => workspace.plan.tasks[Number(task.ref.slice(5)) - 1]?.id,
    ),
  });
