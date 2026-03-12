import { z } from 'zod/v4';
import { PROJECT_STATUSES, TASK_STATUSES, TASK_PRIORITIES } from './types';

export const createProjectSchema = z.object({
  title: z.string().min(1, 'タイトルは必須です'),
  status: z.enum(PROJECT_STATUSES).optional(),
  condition: z.string().optional(),
});

export const updateProjectSchema = z.object({
  title: z.string().min(1).optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  condition: z.string().optional(),
});

export const createTaskSchema = z.object({
  title: z.string().min(1, 'タイトルは必須です'),
  condition: z.string().optional(),
  due_date: z.string().nullable().optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  project_id: z.string().nullable().optional(),
  parent_task_id: z.string().nullable().optional(),
  blocked_by: z.array(z.string()).optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  condition: z.string().optional(),
  due_date: z.string().nullable().optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  project_id: z.string().nullable().optional(),
  blocked_by: z.array(z.string()).optional(),
});
