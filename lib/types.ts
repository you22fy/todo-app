export const PROJECT_STATUSES = ['yet', 'processing', 'finished'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const TASK_STATUSES = ['canceled', 'yet', 'doing', 'pending', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['must', 'should', 'want'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export interface Project {
  id: string;
  title: string;
  status: ProjectStatus;
  condition: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectWithCounts extends Project {
  task_count: number;
  done_count: number;
}

export interface Task {
  id: string;
  title: string;
  condition: string;
  due_date: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  project_id: string | null;
  parent_task_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskWithRelations extends Task {
  blocked_by: string[];
  sub_tasks: TaskWithRelations[];
  project_title?: string;
}
