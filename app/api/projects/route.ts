import { NextRequest, NextResponse } from 'next/server';
import { getDb, generateId } from '@/lib/db';
import { createProjectSchema } from '@/lib/schema';
import type { ProjectWithCounts } from '@/lib/types';

export function GET() {
  const db = getDb();
  const projects = db.prepare(`
    SELECT p.*,
      COUNT(t.id) as task_count,
      SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as done_count
    FROM projects p
    LEFT JOIN tasks t ON t.project_id = p.id AND t.parent_task_id IS NULL
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `).all() as ProjectWithCounts[];

  return NextResponse.json(projects);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createProjectSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  const db = getDb();
  const id = body.id || generateId();
  const { title, status = 'yet', condition = '' } = parsed.data;

  db.prepare(
    'INSERT INTO projects (id, title, status, condition) VALUES (?, ?, ?, ?)'
  ).run(id, title, status, condition);

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  return NextResponse.json(project, { status: 201 });
}
