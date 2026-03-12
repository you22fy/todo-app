'use client';

import useSWR from 'swr';
import { fetcher, generateId } from '@/lib/client-utils';
import type { ProjectWithCounts, ProjectStatus } from '@/lib/types';
import { toast } from 'sonner';

export function useProjects() {
  const { data, error, isLoading, mutate } = useSWR<ProjectWithCounts[]>('/api/projects', fetcher);

  async function createProject(projectData: {
    title: string;
    condition?: string;
    status?: ProjectStatus;
  }) {
    const id = generateId();
    const optimistic: ProjectWithCounts = {
      id,
      title: projectData.title,
      condition: projectData.condition || '',
      status: projectData.status || 'yet',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      task_count: 0,
      done_count: 0,
    };

    await mutate(
      async (current) => {
        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...projectData, id }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: '作成に失敗しました' }));
          throw new Error(err.error);
        }
        const created = await res.json();
        const withCounts = { ...created, task_count: 0, done_count: 0 };
        if (!current) return [withCounts];
        return [withCounts, ...current];
      },
      {
        optimisticData: (current) => current ? [optimistic, ...current] : [optimistic],
        rollbackOnError: true,
        revalidate: true,
      }
    );
  }

  async function updateProject(id: string, patch: Partial<{
    title: string;
    condition: string;
    status: ProjectStatus;
  }>) {
    await mutate(
      async (current) => {
        const res = await fetch(`/api/projects/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: '更新に失敗しました' }));
          throw new Error(err.error);
        }
        const updated = await res.json();
        if (!current) return [];
        return current.map(p => p.id === id ? { ...p, ...updated } : p);
      },
      {
        optimisticData: (current) => {
          if (!current) return [];
          return current.map(p => p.id === id ? { ...p, ...patch } : p);
        },
        rollbackOnError: true,
        revalidate: true,
      }
    ).catch((err: Error) => {
      toast.error(err.message);
    });
  }

  async function deleteProject(id: string) {
    await mutate(
      async (current) => {
        const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('削除に失敗しました');
        if (!current) return [];
        return current.filter(p => p.id !== id);
      },
      {
        optimisticData: (current) => current ? current.filter(p => p.id !== id) : [],
        rollbackOnError: true,
        revalidate: true,
      }
    ).catch((err: Error) => {
      toast.error(err.message);
    });
  }

  return {
    projects: data || [],
    error,
    isLoading,
    mutate,
    createProject,
    updateProject,
    deleteProject,
  };
}
