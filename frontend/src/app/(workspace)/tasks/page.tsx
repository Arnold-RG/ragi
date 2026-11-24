import { TaskWorkspace } from "@/components/tasks/TaskWorkspace";
import { PageHeader } from "@/components/ui/primitives";

export default function TasksPage() {
  return (
    <>
      <PageHeader eyebrow="Operate" title="Tasks" subtitle="Every task across the studio. Keyboard first: C to create, J/K to move, [ and ] to change status." />
      <TaskWorkspace />
    </>
  );
}
