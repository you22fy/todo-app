import { NextRequest, NextResponse } from 'next/server';
import { getDb, generateId } from '@/lib/db';
import { createTaskSchema } from '@/lib/schema';
import type { Task, TaskWithRelations } from '@/lib/types';
import { canBeSubTask, validateSubTaskDependencies, computeParentStatus, shouldBePending } from '@/lib/logic/task-logic';

export function GET(request: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(request.url);

  const conditions: string[] = [];
  const values: unknown[] = [];

  // フィルタ: parent_task_id
  const parentTaskId = searchParams.get('parent_task_id');
  if (parentTaskId === 'null') {
    conditions.push('t.parent_task_id IS NULL');
  } else if (parentTaskId) {
    conditions.push('t.parent_task_id = ?');
    values.push(parentTaskId);
  }

  // フィルタ: project_id
  const projectId = searchParams.get('project_id');
  if (projectId === 'null') {
    conditions.push('t.project_id IS NULL');
  } else if (projectId) {
    conditions.push('t.project_id = ?');
    values.push(projectId);
  }

  // フィルタ: status (カンマ区切り)
  const statusFilter = searchParams.get('status');
  if (statusFilter) {
    const statuses = statusFilter.split(',');
    conditions.push(`t.status IN (${statuses.map(() => '?').join(',')})`);
    values.push(...statuses);
  }

  // フィルタ: priority
  const priorityFilter = searchParams.get('priority');
  if (priorityFilter) {
    const priorities = priorityFilter.split(',');
    conditions.push(`t.priority IN (${priorities.map(() => '?').join(',')})`);
    values.push(...priorities);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const tasks = db.prepare(`
    SELECT t.*, p.title as project_title
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    ${where}
    ORDER BY
      CASE t.priority WHEN 'must' THEN 0 WHEN 'should' THEN 1 WHEN 'want' THEN 2 END,
      CASE t.status WHEN 'doing' THEN 0 WHEN 'yet' THEN 1 WHEN 'pending' THEN 2 WHEN 'done' THEN 3 WHEN 'canceled' THEN 4 END,
      t.due_date ASC NULLS LAST,
      t.created_at DESC
  `).all(...values) as (Task & { project_title: string | null })[];

  // blocked_byとsub_tasksを追加
  const result: TaskWithRelations[] = tasks.map(task => {
    const blockedBy = db.prepare(
      'SELECT blocked_by_task_id FROM task_dependencies WHERE task_id = ?'
    ).all(task.id) as { blocked_by_task_id: string }[];

    const subTasks = db.prepare(
      'SELECT * FROM tasks WHERE parent_task_id = ? ORDER BY created_at ASC'
    ).all(task.id) as Task[];

    const subTasksWithRelations: TaskWithRelations[] = subTasks.map(st => {
      const stBlockedBy = db.prepare(
        'SELECT blocked_by_task_id FROM task_dependencies WHERE task_id = ?'
      ).all(st.id) as { blocked_by_task_id: string }[];
      return {
        ...st,
        blocked_by: stBlockedBy.map(b => b.blocked_by_task_id),
        sub_tasks: [],
        project_title: task.project_title ?? undefined,
      };
    });

    return {
      ...task,
      project_title: task.project_title ?? undefined,
      blocked_by: blockedBy.map(b => b.blocked_by_task_id),
      sub_tasks: subTasksWithRelations,
    };
  });

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createTaskSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  const db = getDb();
  const id = body.id || generateId();
  const {
    title,
    condition = '',
    due_date = null,
    priority = 'should',
    status = 'yet',
    project_id = null,
    parent_task_id = null,
    blocked_by = [],
  } = parsed.data;

  let effectiveProjectId = project_id;

  // sub-taskバリデーション
  if (parent_task_id) {
    const parentTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(parent_task_id) as Task | undefined;
    if (!parentTask) {
      return NextResponse.json({ error: '親タスクが見つかりません' }, { status: 400 });
    }
    if (!canBeSubTask(parentTask)) {
      return NextResponse.json({ error: 'sub-taskのsub-taskは作成できません' }, { status: 400 });
    }
    // sub-taskは親のproject_idを継承
    effectiveProjectId = parentTask.project_id;

    // blocked_byは兄弟のみ
    if (blocked_by.length > 0) {
      const siblings = db.prepare(
        'SELECT id, parent_task_id FROM tasks WHERE parent_task_id = ?'
      ).all(parent_task_id) as { id: string; parent_task_id: string | null }[];
      const validation = validateSubTaskDependencies(parent_task_id, blocked_by, siblings);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
    }
  }

  // blocked_byのタスク存在確認
  for (const blockerId of blocked_by) {
    const blocker = db.prepare('SELECT id FROM tasks WHERE id = ?').get(blockerId);
    if (!blocker) {
      return NextResponse.json({ error: `ブロッカータスク ${blockerId} が見つかりません` }, { status: 400 });
    }
  }

  // ステータス計算: blocked_byがある場合はpending
  const effectiveStatus = blocked_by.length > 0 ? 'pending' : status;

  const insertTask = db.transaction(() => {
    db.prepare(
      'INSERT INTO tasks (id, title, condition, due_date, priority, status, project_id, parent_task_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, title, condition, due_date, priority, effectiveStatus, effectiveProjectId, parent_task_id);

    for (const blockerId of blocked_by) {
      db.prepare(
        'INSERT INTO task_dependencies (task_id, blocked_by_task_id) VALUES (?, ?)'
      ).run(id, blockerId);
    }

    // 親タスクのステータスを再計算
    if (parent_task_id) {
      recomputeParentStatus(db, parent_task_id);
    }
  });

  insertTask();

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task;
  return NextResponse.json({
    ...task,
    blocked_by,
    sub_tasks: [],
  }, { status: 201 });
}

function recomputeParentStatus(db: ReturnType<typeof getDb>, parentTaskId: string) {
  const subTasks = db.prepare(
    'SELECT status FROM tasks WHERE parent_task_id = ?'
  ).all(parentTaskId) as { status: string }[];

  if (subTasks.length > 0) {
    const newStatus = computeParentStatus(subTasks as { status: import('@/lib/types').TaskStatus }[]);
    db.prepare(
      "UPDATE tasks SET status = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(newStatus, parentTaskId);
  }
}
