import type { EventPlan } from "@/schemas/plan";
import { dependencySchema, type TaskDependency } from "@/schemas/schedule";
/** One Kahn traversal validates the graph in O(tasks + edges); no per-row graph searches. */
export function inspectDependencies(
  plan: EventPlan,
  dependencies: TaskDependency[],
) {
  const tasks = new Map(plan.tasks.map((task) => [task.id, task]));
  const indegree = new Map(plan.tasks.map((task) => [task.id, 0]));
  const successors = new Map<string, string[]>();
  const requirements = new Map<string, string[]>();
  for (const raw of dependencies) {
    const edge = dependencySchema.parse(raw);
    if (!tasks.has(edge.taskId) || requirements.has(edge.taskId))
      throw new Error("Missing or duplicate dependency task");
    requirements.set(edge.taskId, edge.dependsOn);
    for (const id of edge.dependsOn) {
      if (id === edge.taskId) throw new Error("A task cannot depend on itself");
      if (!tasks.has(id))
        throw new Error("Dependency references a missing task");
      indegree.set(edge.taskId, (indegree.get(edge.taskId) ?? 0) + 1);
      const outgoing = successors.get(id) ?? [];
      outgoing.push(edge.taskId);
      successors.set(id, outgoing);
    }
  }
  const queue = [...indegree]
    .filter(([, degree]) => degree === 0)
    .map(([id]) => id);
  for (let index = 0; index < queue.length; index++)
    for (const next of successors.get(queue[index]) ?? []) {
      const remaining = indegree.get(next)! - 1;
      indegree.set(next, remaining);
      if (!remaining) queue.push(next);
    }
  if (queue.length !== tasks.size)
    throw new Error("Task dependencies contain a cycle");
  const blocked = plan.tasks.filter(
    (task) =>
      !task.completed &&
      (requirements.get(task.id) ?? []).some((id) => !tasks.get(id)!.completed),
  );
  return { order: queue, blocked, requirements, tasks };
}
