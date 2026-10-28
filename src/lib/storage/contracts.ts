import type { EventInput } from "@/schemas/event";
import type { EventPlan } from "@/schemas/plan";
import type { Workspace } from "@/lib/planning/workspace";
import type { PlanEnhancements } from "@/schemas/enhancements";
import type { PlanHistory } from "@/lib/history";
export type MutationOptions = {
  expectedRevision?: number;
  description?: string;
};
export interface PlanRepository {
  loadWorkspace(id: string): Promise<Workspace | undefined>;
  loadHistory(id: string): Promise<PlanHistory | undefined>;
  restoreHistory(
    id: string,
    direction: "undo" | "redo",
    expectedRevision: number,
  ): Promise<Workspace>;
  importWorkspace(workspace: Workspace): Promise<void>;
  loadEnhancements(id: string): Promise<PlanEnhancements | undefined>;
  mutateWorkspace(
    id: string,
    mutation: (current: Workspace) => Workspace,
    fallback?: EventPlan,
    options?: MutationOptions,
  ): Promise<Workspace>;
  saveEvent(id: string, event: EventInput): Promise<void>;
  savePlan(plan: EventPlan): Promise<void>;
  loadPlan(id: string): Promise<EventPlan | undefined>;
  listPlans(): Promise<{ plans: EventPlan[]; issues: string[] }>;
  updateTask(
    id: string,
    taskId: string,
    completed: boolean,
  ): Promise<EventPlan>;
  updateVendor(
    id: string,
    vendorId: string,
    completed: boolean,
  ): Promise<EventPlan>;
  deletePlan(id: string): Promise<void>;
  saveDraft(event: EventInput): Promise<void>;
  loadDraft(): Promise<EventInput | undefined>;
  clearDraft(): Promise<void>;
  findReusable(fingerprint: string): Promise<EventPlan | undefined>;
}
