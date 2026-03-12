'use client';

import { Badge } from '@/components/ui/badge';
import type { TaskPriority } from '@/lib/types';

const priorityConfig: Record<TaskPriority, { label: string; className: string }> = {
  must: { label: 'Must', className: 'bg-red-100 text-red-800 border-red-200' },
  should: { label: 'Should', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  want: { label: 'Want', className: 'bg-blue-100 text-blue-800 border-blue-200' },
};

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const config = priorityConfig[priority];
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
