import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { updateTaskSchema } from '@/lib/schema';
import type { Task, TaskStatus, TaskWithRelations } from '@/lib/types';
import {
  canManuallyChangeStatus,
  computeParentStatus,
  validateSubTaskDependencies,
  shouldBePending,
  computeEffectiveStatus,
} from '@/lib/logic/task-logic';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const db = getDb();
  const task = db.prepare('SELECT t.*, p.title as project_title FROM tasks t LEFT JOIN projects p ON t.project_id = p.id WHERE t.id = ?').get(id) as (Task & { project_title: string | null }) | undefined;

  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  const blockedBy = db.prepare(
    'SELECT blocked_by_task_id FROM task_dependencies WHERE task_id = ?'
  ).all(id) as { blocked_by_task_id: string }[];

  const subTasks = db.prepare(
    'SELECT * FROM tasks WHERE parent_task_id = ? ORDER BY created_at ASC'
  ).all(id) as Task[];

  const subTasksWithRelations: TaskWithRelations[] = subTasks.map(st => {
    const stBlockedBy = db.prepare(
      'SELECT blocked_by_task_id FROM task_dependencies WHERE task_id = ?'
    ).all(st.id) as { blocked_by_task_id: string }[];
    return {
      ...st,
      blocked_by: stBlockedBy.map(b => b.blocked_by_task_id),
      sub_tasks: [],
    };
  });

  return NextResponse.json({
    ...task,
    project_title: task.project_title ?? undefined,
    blocked_by: blockedBy.map(b => b.blocked_by_task_id),
    sub_tasks: subTasksWithRelations,
  });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const body = await request.json();
  const parsed = updateTaskSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  const db = getDb();
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task | undefined;
  if (!existing) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  const fields = parsed.data;

  // sub-taskがある場合、ステータス手動変更は不可
  if (fields.status !== undefined) {
    const subTaskCount = db.prepare(
      'SELECT COUNT(*) as count FROM tasks WHERE parent_task_id = ?'
    ).get(id) as { count: number };
    const hasSubTasks = Number(subTaskCount.count) > 0;
    if (!canManuallyChangeStatus(hasSubTasks)) {
      return NextResponse.json(
        { error: 'sub-taskが存在するため、ステータスは自動計算されます' },
        { status: 400 }
      );
    }
  }

  // blocked_by更新
  if (fields.blocked_by !== undefined) {
    const blockedBy = fields.blocked_by;

    // sub-taskの場合、兄弟チェック
    if (existing.parent_task_id) {
      const siblings = db.prepare(
        'SELECT id, parent_task_id FROM tasks WHERE parent_task_id = ? AND id != ?'
      ).all(existing.parent_task_id, id) as { id: string; parent_task_id: string | null }[];
      const validation = validateSubTaskDependencies(existing.parent_task_id, blockedBy, siblings);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
    }

    // 存在チェック
    for (const blockerId of blockedBy) {
      const blocker = db.prepare('SELECT id FROM tasks WHERE id = ?').get(blockerId);
      if (!blocker) {
        return NextResponse.json({ error: `ブロッカータスク ${blockerId} が見つかりません` }, { status: 400 });
      }
    }

    // 依存関係を更新
    db.prepare('DELETE FROM task_dependencies WHERE task_id = ?').run(id);
    for (const blockerId of blockedBy) {
      db.prepare('INSERT INTO task_dependencies (task_id, blocked_by_task_id) VALUES (?, ?)').run(id, blockerId);
    }

    // ステータスをblocked_byに基づいて再計算
    if (blockedBy.length > 0) {
      const blockerStatuses = db.prepare(
        `SELECT status FROM tasks WHERE id IN (${blockedBy.map(() => '?').join(',')})`
      ).all(...blockedBy) as { status: TaskStatus }[];
      const effectiveStatus = computeEffectiveStatus(
        existing.status,
        blockerStatuses.map(b => b.status)
      );
      if (effectiveStatus !== existing.status && fields.status === undefined) {
        fields.status = effectiveStatus;
      }
    } else if (existing.status === 'pending') {
      // blockerが全て解除されたらyetに戻す
      fields.status = fields.status ?? 'yet';
    }

    delete fields.blocked_by;
  }

  // project_id変更不可（sub-taskの場合）
  if (fields.project_id !== undefined && existing.parent_task_id) {
    return NextResponse.json(
      { error: 'sub-taskのプロジェクトは親タスクに従います' },
      { status: 400 }
    );
  }

  const sets: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      sets.push(`${key} = ?`);
      values.push(value);
    }
  }

  const updateAndRecompute = db.transaction(() => {
    if (sets.length > 0) {
      sets.push("updated_at = datetime('now')");
      values.push(id);
      db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    }

    // 親タスクのステータス再計算
    if (existing.parent_task_id) {
      recomputeParentStatus(db, existing.parent_task_id);
    }

    // このタスクがブロッカーになっているタスクのステータスを再計算
    if (fields.status !== undefined) {
      const dependents = db.prepare(
        'SELECT task_id FROM task_dependencies WHERE blocked_by_task_id = ?'
      ).all(id) as { task_id: string }[];

      for (const dep of dependents) {
        recomputeDependentStatus(db, dep.task_id);
      }
    }
  });

  updateAndRecompute();

  // 更新後のタスクを返す
  const updated = db.prepare('SELECT t.*, p.title as project_title FROM tasks t LEFT JOIN projects p ON t.project_id = p.id WHERE t.id = ?').get(id) as Task & { project_title: string | null };
  const blockedBy = db.prepare(
    'SELECT blocked_by_task_id FROM task_dependencies WHERE task_id = ?'
  ).all(id) as { blocked_by_task_id: string }[];
  const subTasks = db.prepare(
    'SELECT * FROM tasks WHERE parent_task_id = ?'
  ).all(id) as Task[];

  return NextResponse.json({
    ...updated,
    project_title: updated.project_title ?? undefined,
    blocked_by: blockedBy.map(b => b.blocked_by_task_id),
    sub_tasks: subTasks.map(st => ({
      ...st,
      blocked_by: (db.prepare('SELECT blocked_by_task_id FROM task_dependencies WHERE task_id = ?').all(st.id) as { blocked_by_task_id: string }[]).map(b => b.blocked_by_task_id),
      sub_tasks: [],
    })),
  });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const db = getDb();

  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task | undefined;
  if (!existing) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  const parentTaskId = existing.parent_task_id;

  const deleteAndRecompute = db.transaction(() => {
    // 依存関係の削除 (このタスクをblocked_byしているもの)
    db.prepare('DELETE FROM task_dependencies WHERE blocked_by_task_id = ?').run(id);
    db.prepare('DELETE FROM task_dependencies WHERE task_id = ?').run(id);
    // sub-tasksはCASCADEで削除される
    db.prepare('DELETE FROM tasks WHERE id = ?').run(id);

    // 親タスクのステータス再計算
    if (parentTaskId) {
      const subTasks = db.prepare(
        'SELECT status FROM tasks WHERE parent_task_id = ?'
      ).all(parentTaskId) as { status: string }[];
      if (subTasks.length > 0) {
        const newStatus = computeParentStatus(subTasks as { status: TaskStatus }[]);
        db.prepare("UPDATE tasks SET status = ?, updated_at = datetime('now') WHERE id = ?").run(newStatus, parentTaskId);
      }
    }

    // このタスクをブロッカーにしているタスクのステータス再計算
    // (依存関係は既に削除済みなので、pending→yetに戻る可能性)
  });

  deleteAndRecompute();

  return NextResponse.json({ success: true });
}

function recomputeParentStatus(db: ReturnType<typeof getDb>, parentTaskId: string) {
  const subTasks = db.prepare(
    'SELECT status FROM tasks WHERE parent_task_id = ?'
  ).all(parentTaskId) as { status: TaskStatus }[];

  if (subTasks.length > 0) {
    const newStatus = computeParentStatus(subTasks);
    db.prepare("UPDATE tasks SET status = ?, updated_at = datetime('now') WHERE id = ?").run(newStatus, parentTaskId);
  }
}

function recomputeDependentStatus(db: ReturnType<typeof getDb>, taskId: string) {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as Task | undefined;
  if (!task) return;

  const blockers = db.prepare(
    'SELECT t.status FROM task_dependencies td JOIN tasks t ON td.blocked_by_task_id = t.id WHERE td.task_id = ?'
  ).all(taskId) as { status: TaskStatus }[];

  const effectiveStatus = computeEffectiveStatus(task.status, blockers.map(b => b.status));
  if (effectiveStatus !== task.status) {
    db.prepare("UPDATE tasks SET status = ?, updated_at = datetime('now') WHERE id = ?").run(effectiveStatus, taskId);
  }
}
