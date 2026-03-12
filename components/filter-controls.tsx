'use client';

import { TASK_STATUSES, type TaskStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

interface FilterControlsProps {
  activeStatuses: Set<TaskStatus>;
  onToggle: (status: TaskStatus) => void;
}

const statusLabels: Record<TaskStatus, string> = {
  yet: 'Yet',
  doing: 'Doing',
  pending: 'Pending',
  done: 'Done',
  canceled: 'Canceled',
};

export function FilterControls({ activeStatuses, onToggle }: FilterControlsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {TASK_STATUSES.map(status => (
        <button
          key={status}
          onClick={() => onToggle(status)}
          className={cn(
            'px-3 py-1 text-xs rounded-full border transition-colors',
            activeStatuses.has(status)
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background text-muted-foreground border-border hover:bg-accent'
          )}
        >
          {statusLabels[status]}
        </button>
      ))}
    </div>
  );
}
