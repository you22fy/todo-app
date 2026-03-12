import type { TaskStatus } from '../types';

/**
 * sub-taskの状態から親タスクのステータスを計算する
 * - 全てdone/canceled → done
 * - 1つでもdoing → doing
 * - それ以外 → doing (sub-taskが存在する場合のデフォルト)
 */
export function computeParentStatus(subTasks: { status: TaskStatus }[]): TaskStatus {
  if (subTasks.length === 0) {
    throw new Error('Cannot compute parent status without sub-tasks');
  }

  const allDoneOrCanceled = subTasks.every(
    t => t.status === 'done' || t.status === 'canceled'
  );
  if (allDoneOrCanceled) return 'done';

  // sub-taskが存在する限り、親はdoing
  return 'doing';
}

/**
 * blocked_byのタスクの状態から、このタスクがpendingであるべきか判定する
 * blockerが1つでもdone/canceled以外 → pending
 */
export function shouldBePending(blockerStatuses: TaskStatus[]): boolean {
  if (blockerStatuses.length === 0) return false;
  return blockerStatuses.some(s => s !== 'done' && s !== 'canceled');
}

/**
 * sub-taskのblocked_byが同じ親の兄弟タスクのみかバリデーション
 */
export function validateSubTaskDependencies(
  taskParentId: string | null,
  blockedByIds: string[],
  siblingTasks: { id: string; parent_task_id: string | null }[]
): { valid: boolean; error?: string } {
  if (blockedByIds.length === 0) return { valid: true };

  if (!taskParentId) {
    return { valid: false, error: 'sub-task以外ではblocked_byの兄弟制約はありません' };
  }

  const siblingIds = new Set(
    siblingTasks
      .filter(t => t.parent_task_id === taskParentId)
      .map(t => t.id)
  );

  for (const id of blockedByIds) {
    if (!siblingIds.has(id)) {
      return { valid: false, error: `タスク ${id} は同じ親タスクの兄弟ではありません` };
    }
  }

  return { valid: true };
}

/**
 * 親タスクがsub-taskでないことを確認（sub-sub-task禁止）
 */
export function canBeSubTask(parentTask: { parent_task_id: string | null }): boolean {
  return parentTask.parent_task_id === null;
}

/**
 * sub-taskが存在する場合、親タスクのステータス手動変更は不可
 */
export function canManuallyChangeStatus(hasSubTasks: boolean): boolean {
  return !hasSubTasks;
}

/**
 * タスクの実効ステータスを計算する
 * blocked_byの状態を考慮してpendingを自動判定
 */
export function computeEffectiveStatus(
  currentStatus: TaskStatus,
  blockerStatuses: TaskStatus[]
): TaskStatus {
  if (blockerStatuses.length > 0 && shouldBePending(blockerStatuses)) {
    return 'pending';
  }
  // blockerが全て解消されてpendingだった場合はyetに戻す
  if (currentStatus === 'pending' && blockerStatuses.length > 0 && !shouldBePending(blockerStatuses)) {
    return 'yet';
  }
  return currentStatus;
}
