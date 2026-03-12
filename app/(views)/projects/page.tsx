'use client';

import { useState } from 'react';
import { useTasks } from '@/hooks/use-tasks';
import { useProjects } from '@/hooks/use-projects';
import { useStatusFilter } from '@/hooks/use-status-filter';
import { TaskTable } from '@/components/task-table';
import { TaskForm } from '@/components/task-form';
import { ProjectForm } from '@/components/project-form';
import { FilterControls } from '@/components/filter-controls';
import { ProjectStatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { ProjectWithCounts } from '@/lib/types';

export default function ProjectsPage() {
  const { activeStatuses, toggle, statusFilter } = useStatusFilter();
  const { tasks, isLoading: tasksLoading, createTask, updateTask, deleteTask } = useTasks({
    parent_task_id: 'null',
    status: statusFilter || undefined,
  });
  const { projects, isLoading: projectsLoading, createProject, updateProject, deleteProject } = useProjects();

  if (tasksLoading || projectsLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  }

  const standaloneTasks = tasks.filter(t => !t.project_id);

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-xl font-bold">Projects</h1>
        <div className="flex items-center gap-3">
          <FilterControls activeStatuses={activeStatuses} onToggle={toggle} />
          <ProjectForm onSubmit={createProject} />
        </div>
      </div>

      {projects.map(project => (
        <ProjectSection
          key={project.id}
          project={project}
          tasks={tasks.filter(t => t.project_id === project.id)}
          projects={projects}
          createTask={createTask}
          updateTask={updateTask}
          deleteTask={deleteTask}
          updateProject={updateProject}
          deleteProject={deleteProject}
        />
      ))}

      {standaloneTasks.length > 0 && (
        <section className="border rounded-lg p-4 border-dashed">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-muted-foreground">No Project</h2>
            <TaskForm onSubmit={createTask} projects={projects} />
          </div>
          <TaskTable
            tasks={standaloneTasks}
            projects={projects}
            onUpdate={updateTask}
            onDelete={deleteTask}
            onCreate={createTask}
            showProject={false}
          />
        </section>
      )}
    </div>
  );
}

function ProjectSection({
  project,
  tasks,
  projects,
  createTask,
  updateTask,
  deleteTask,
  updateProject,
  deleteProject,
}: {
  project: ProjectWithCounts;
  tasks: import('@/lib/types').TaskWithRelations[];
  projects: ProjectWithCounts[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createTask: (data: any) => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateTask: (id: string, patch: any) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateProject: (id: string, patch: any) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
}) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <section className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="text-lg font-semibold truncate">{project.title}</h2>
          <ProjectStatusBadge status={project.status} />
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {project.done_count}/{project.task_count}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <TaskForm
            onSubmit={createTask}
            projects={projects}
            defaultProjectId={project.id}
            triggerLabel="+ Task"
          />
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="h-8 w-8 p-0" />}>
              ...
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditOpen(true)}>Edit</DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => deleteProject(project.id)}
                variant="destructive"
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ProjectForm
            onSubmit={async (data) => updateProject(project.id, data)}
            editProject={project}
            open={editOpen}
            onOpenChange={setEditOpen}
          />
        </div>
      </div>
      {project.condition && (
        <p className="text-sm text-muted-foreground mb-3">Goal: {project.condition}</p>
      )}
      <TaskTable
        tasks={tasks}
        projects={projects}
        onUpdate={updateTask}
        onDelete={deleteTask}
        onCreate={createTask}
        showProject={false}
      />
    </section>
  );
}
