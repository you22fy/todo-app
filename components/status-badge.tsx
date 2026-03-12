'use client';

import { Badge } from '@/components/ui/badge';
import type { TaskStatus, ProjectStatus } from '@/lib/types';

const taskStatusConfig: Record<TaskStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  yet: { label: 'Yet', variant: 'outline' },
  doing: { label: 'Doing', variant: 'default' },
  pending: { label: 'Pending', variant: 'secondary' },
  done: { label: 'Done', variant: 'secondary' },
  canceled: { label: 'Canceled', variant: 'destructive' },
};

const projectStatusConfig: Record<ProjectStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  yet: { label: 'Yet', variant: 'outline' },
  processing: { label: 'Processing', variant: 'default' },
  finished: { label: 'Finished', variant: 'secondary' },
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const config = taskStatusConfig[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const config = projectStatusConfig[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
