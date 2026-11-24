import { describe, expect, it } from "vitest";
import { filterTasks, groupByStatus, moveSelection, nextStatus, prevStatus, type Task } from "@/lib/tasks";

const t = (id: string, over: Partial<Task> = {}): Task => ({
  id, title: `Task ${id}`, description: null, project_id: "p1", project_name: "Project one", status: "todo",
  priority: "medium", assignee_kind: "owner", assignee_agent_id: null, assignee_name: null, due_date: null,
  is_demo: false, requires_approval: false, ...over,
});

describe("task helpers", () => {
  it("groups by status and sorts by priority", () => {
    const g = groupByStatus([t("a", { priority: "low" }), t("b", { priority: "critical" }), t("c", { status: "done" })]);
    expect(g.todo.map((x) => x.id)).toEqual(["b", "a"]);
    expect(g.done).toHaveLength(1);
    expect(g.backlog).toEqual([]);
  });
  it("filters by text, project and priority", () => {
    const list = [t("a"), t("b", { project_id: "p2", project_name: "Other" }), t("c", { priority: "high" })];
    expect(filterTasks(list, { q: "other" }).map((x) => x.id)).toEqual(["b"]);
    expect(filterTasks(list, { projectId: "p1" })).toHaveLength(2);
    expect(filterTasks(list, { priority: "high" }).map((x) => x.id)).toEqual(["c"]);
  });
  it("moves status forward and back, clamped", () => {
    expect(nextStatus("todo")).toBe("in_progress");
    expect(nextStatus("done")).toBe("done");
    expect(prevStatus("backlog")).toBe("backlog");
    expect(nextStatus("blocked")).toBe("todo");
  });
  it("moves keyboard selection within bounds", () => {
    expect(moveSelection([], null, 1)).toBeNull();
    expect(moveSelection(["a", "b"], null, 1)).toBe("a");
    expect(moveSelection(["a", "b"], null, -1)).toBe("b");
    expect(moveSelection(["a", "b"], "b", 1)).toBe("b");
    expect(moveSelection(["a", "b"], "b", -1)).toBe("a");
  });
});
