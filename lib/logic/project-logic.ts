import type { TaskStatus, ProjectStatus } from '../types';

/**
 * プロジェクトのタスク状態からプロジェクトステータスの推奨値を導出
 */
export function suggestProjectStatus(
  tasks: { status: TaskStatus }[]
): ProjectStatus {
  if (tasks.length === 0) return 'yet';

  const allDoneOrCanceled = tasks.every(
    t => t.status === 'done' || t.status === 'canceled'
  );
  if (allDoneOrCanceled) return 'finished';

  const hasActive = tasks.some(
    t => t.status === 'doing' || t.status === 'pending'
  );
  if (hasActive) return 'processing';

  return 'yet';
}
