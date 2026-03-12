'use client';

import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { TaskStatusBadge } from '@/components/status-badge';
import { PriorityBadge } from '@/components/priority-badge';
import { TaskForm } from '@/components/task-form';
import type { TaskWithRelations, TaskStatus, ProjectWithCounts } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTaskData = any;

interface TaskTableProps {
  tasks: TaskWithRelations[];
  projects: ProjectWithCounts[];
  onUpdate: (id: string, patch: AnyTaskData) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onCreate: (data: AnyTaskData) => Promise<void>;
  showProject?: boolean;
  showPriority?: boolean;
}

const STATUS_CYCLE: TaskStatus[] = ['yet', 'doing', 'done'];

export function TaskTable({
  tasks,
  projects,
  onUpdate,
  onDelete,
  onCreate,
  showProject = true,
  showPriority = true,
}: TaskTableProps) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Status</TableHead>
            {showPriority && <TableHead className="w-[80px]">Priority</TableHead>}
            <TableHead>Title</TableHead>
            {showProject && <TableHead className="hidden sm:table-cell">Project</TableHead>}
            <TableHead className="hidden sm:table-cell w-[110px]">Due</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map(task => (
            <TaskRowGroup
              key={task.id}
              task={task}
              projects={projects}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onCreate={onCreate}
              showProject={showProject}
              showPriority={showPriority}
            />
          ))}
          {tasks.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                No tasks
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function TaskRowGroup({
  task,
  projects,
  onUpdate,
  onDelete,
  onCreate,
  showProject,
  showPriority,
}: {
  task: TaskWithRelations;
  projects: ProjectWithCounts[];
  onUpdate: (id: string, patch: AnyTaskData) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onCreate: (data: AnyTaskData) => Promise<void>;
  showProject: boolean;
  showPriority: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [addSubOpen, setAddSubOpen] = useState(false);
  const hasSubTasks = task.sub_tasks.length > 0;
  const canChangeStatus = !hasSubTasks;

  function cycleStatus() {
    if (!canChangeStatus) return;
    const currentIdx = STATUS_CYCLE.indexOf(task.status);
    const nextStatus = STATUS_CYCLE[(currentIdx + 1) % STATUS_CYCLE.length];
    onUpdate(task.id, { status: nextStatus });
  }

  return (
    <>
      <TableRow className="group">
        <TableCell>
          <button
            onClick={cycleStatus}
            disabled={!canChangeStatus}
            className="cursor-pointer disabled:cursor-default"
            title={canChangeStatus ? 'Click to cycle status' : 'Status auto-computed from sub-tasks'}
          >
            <TaskStatusBadge status={task.status} />
          </button>
        </TableCell>
        {showPriority && (
          <TableCell>
            <PriorityBadge priority={task.priority} />
          </TableCell>
        )}
        <TableCell>
          <div className="flex items-center gap-2">
            {hasSubTasks && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-muted-foreground hover:text-foreground text-sm w-5 shrink-0"
              >
                {expanded ? '▼' : '▶'}
              </button>
            )}
            <div className="min-w-0">
              <div className="font-medium truncate">{task.title}</div>
              {task.condition && (
                <div className="text-xs text-muted-foreground truncate">{task.condition}</div>
              )}
              {task.blocked_by.length > 0 && (
                <div className="text-xs text-orange-600">Blocked</div>
              )}
            </div>
          </div>
        </TableCell>
        {showProject && (
          <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
            {task.project_title || '-'}
          </TableCell>
        )}
        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
          {task.due_date || '-'}
        </TableCell>
        <TableCell>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="h-8 w-8 p-0" />}>
              ...
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditOpen(true)}>Edit</DropdownMenuItem>
              {!task.parent_task_id && (
                <DropdownMenuItem onClick={() => setAddSubOpen(true)}>Add Sub-task</DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => onDelete(task.id)}
                variant="destructive"
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <TaskForm
            onSubmit={async (data) => onUpdate(task.id, data)}
            projects={projects}
            editTask={task}
            open={editOpen}
            onOpenChange={setEditOpen}
          />
          {!task.parent_task_id && (
            <TaskForm
              onSubmit={async (data) => onCreate(data)}
              projects={projects}
              parentTaskId={task.id}
              siblingTasks={task.sub_tasks}
              open={addSubOpen}
              onOpenChange={setAddSubOpen}
            />
          )}
        </TableCell>
      </TableRow>
      {expanded && task.sub_tasks.map(sub => (
        <SubTaskRow
          key={sub.id}
          sub={sub}
          parentTask={task}
          projects={projects}
          onUpdate={onUpdate}
          onDelete={onDelete}
          showProject={showProject}
          showPriority={showPriority}
        />
      ))}
    </>
  );
}

function SubTaskRow({
  sub,
  parentTask,
  projects,
  onUpdate,
  onDelete,
  showProject,
  showPriority,
}: {
  sub: TaskWithRelations;
  parentTask: TaskWithRelations;
  projects: ProjectWithCounts[];
  onUpdate: (id: string, patch: AnyTaskData) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  showProject: boolean;
  showPriority: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);

  function cycleStatus() {
    const currentIdx = STATUS_CYCLE.indexOf(sub.status);
    const nextStatus = STATUS_CYCLE[(currentIdx + 1) % STATUS_CYCLE.length];
    onUpdate(sub.id, { status: nextStatus });
  }

  return (
    <TableRow className="bg-muted/30">
      <TableCell>
        <div className="pl-4">
          <button onClick={cycleStatus} className="cursor-pointer">
            <TaskStatusBadge status={sub.status} />
          </button>
        </div>
      </TableCell>
      {showPriority && (
        <TableCell>
          <PriorityBadge priority={sub.priority} />
        </TableCell>
      )}
      <TableCell>
        <div className="pl-6 min-w-0">
          <div className="text-sm truncate">{sub.title}</div>
          {sub.condition && (
            <div className="text-xs text-muted-foreground truncate">{sub.condition}</div>
          )}
          {sub.blocked_by.length > 0 && (
            <div className="text-xs text-orange-600">Blocked</div>
          )}
        </div>
      </TableCell>
      {showProject && <TableCell className="hidden sm:table-cell" />}
      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
        {sub.due_date || '-'}
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="h-8 w-8 p-0" />}>
            ...
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditOpen(true)}>Edit</DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(sub.id)}
              variant="destructive"
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <TaskForm
          onSubmit={async (data) => onUpdate(sub.id, data)}
          projects={projects}
          editTask={sub}
          parentTaskId={parentTask.id}
          siblingTasks={parentTask.sub_tasks}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      </TableCell>
    </TableRow>
  );
}
