'use client';

import { useTasks } from '@/hooks/use-tasks';
import { useProjects } from '@/hooks/use-projects';
import { useStatusFilter } from '@/hooks/use-status-filter';
import { TaskTable } from '@/components/task-table';
import { TaskForm } from '@/components/task-form';
import { FilterControls } from '@/components/filter-controls';

export default function AllTasksPage() {
  const { activeStatuses, toggle, statusFilter } = useStatusFilter();
  const { tasks, isLoading, createTask, updateTask, deleteTask } = useTasks({
    parent_task_id: 'null',
    status: statusFilter || undefined,
  });
  const { projects } = useProjects();

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-xl font-bold">All Tasks</h1>
        <div className="flex items-center gap-3">
          <FilterControls activeStatuses={activeStatuses} onToggle={toggle} />
          <TaskForm onSubmit={createTask} projects={projects} />
        </div>
      </div>

      <TaskTable
        tasks={tasks}
        projects={projects}
        onUpdate={updateTask}
        onDelete={deleteTask}
        onCreate={createTask}
      />
    </div>
  );
}
