'use client';

import useSWR from 'swr';
import { fetcher, generateId } from '@/lib/client-utils';
import type { TaskWithRelations, TaskStatus, TaskPriority } from '@/lib/types';
import { toast } from 'sonner';

export interface TaskFilters {
  status?: string;
  priority?: string;
  project_id?: string;
  parent_task_id?: string;
}

function buildKey(filters: TaskFilters): string {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.priority) params.set('priority', filters.priority);
  if (filters.project_id) params.set('project_id', filters.project_id);
  if (filters.parent_task_id) params.set('parent_task_id', filters.parent_task_id);
  const qs = params.toString();
  return `/api/tasks${qs ? `?${qs}` : ''}`;
}

export function useTasks(filters: TaskFilters = {}) {
  const key = buildKey(filters);
  const { data, error, isLoading, mutate } = useSWR<TaskWithRelations[]>(key, fetcher);

  async function createTask(taskData: {
    title: string;
    condition?: string;
    due_date?: string | null;
    priority?: TaskPriority;
    status?: TaskStatus;
    project_id?: string | null;
    parent_task_id?: string | null;
    blocked_by?: string[];
  }) {
    const id = generateId();
    const optimisticTask: TaskWithRelations = {
      id,
      title: taskData.title,
      condition: taskData.condition || '',
      due_date: taskData.due_date || null,
      priority: taskData.priority || 'should',
      status: taskData.blocked_by?.length ? 'pending' : (taskData.status || 'yet'),
      project_id: taskData.project_id || null,
      parent_task_id: taskData.parent_task_id || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      blocked_by: taskData.blocked_by || [],
      sub_tasks: [],
    };

    await mutate(
      async (current) => {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...taskData, id }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: '作成に失敗しました' }));
          throw new Error(err.error);
        }
        const created = await res.json();
        if (!current) return [created];
        return [...current, created];
      },
      {
        optimisticData: (current) => current ? [...current, optimisticTask] : [optimisticTask],
        rollbackOnError: true,
        revalidate: true,
      }
    );
  }

  async function updateTask(id: string, patch: Partial<{
    title: string;
    condition: string;
    due_date: string | null;
    priority: TaskPriority;
    status: TaskStatus;
    project_id: string | null;
    blocked_by: string[];
  }>) {
    await mutate(
      async (current) => {
        const res = await fetch(`/api/tasks/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: '更新に失敗しました' }));
          throw new Error(err.error);
        }
        const updated = await res.json();
        if (!current) return [updated];
        return current.map(t => t.id === id ? updated : t);
      },
      {
        optimisticData: (current) => {
          if (!current) return [];
          return current.map(t =>
            t.id === id ? { ...t, ...patch, updated_at: new Date().toISOString() } : t
          );
        },
        rollbackOnError: true,
        revalidate: true,
      }
    ).catch((err: Error) => {
      toast.error(err.message);
    });
  }

  async function deleteTask(id: string) {
    await mutate(
      async (current) => {
        const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: '削除に失敗しました' }));
          throw new Error(err.error);
        }
        if (!current) return [];
        return current.filter(t => t.id !== id);
      },
      {
        optimisticData: (current) => current ? current.filter(t => t.id !== id) : [],
        rollbackOnError: true,
        revalidate: true,
      }
    ).catch((err: Error) => {
      toast.error(err.message);
    });
  }

  return {
    tasks: data || [],
    error,
    isLoading,
    mutate,
    createTask,
    updateTask,
    deleteTask,
  };
}
