'use client';

import { useState, useCallback } from 'react';
import type { TaskStatus } from '@/lib/types';

const DEFAULT_ACTIVE: TaskStatus[] = ['yet', 'doing', 'pending'];

export function useStatusFilter(initial: TaskStatus[] = DEFAULT_ACTIVE) {
  const [activeStatuses, setActiveStatuses] = useState<Set<TaskStatus>>(new Set(initial));

  const toggle = useCallback((status: TaskStatus) => {
    setActiveStatuses(prev => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  }, []);

  const statusFilter = Array.from(activeStatuses).join(',');

  return { activeStatuses, toggle, statusFilter };
}
