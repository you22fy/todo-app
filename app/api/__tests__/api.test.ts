import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import fs from 'fs';
import { resetDb } from '@/lib/db';

const TEST_DB_PATH = path.join(process.cwd(), 'data', 'test.db');

function createRequest(url: string, options: RequestInit = {}): Request {
  return new Request(`http://localhost:3000${url}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
}

beforeEach(() => {
  resetDb();
  const dir = path.dirname(TEST_DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  process.env.DATABASE_PATH = TEST_DB_PATH;
});

afterEach(() => {
  resetDb();
  try { if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH); } catch { /* */ }
});

describe('Projects API', () => {
  it('should create and list projects', async () => {
    const { POST, GET } = await import('../projects/route');
    const createRes = await POST(createRequest('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test Project', condition: 'All tasks done' }),
    }) as any);
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.title).toBe('Test Project');
    expect(created.status).toBe('yet');

    const listRes = await GET();
    const list = await listRes.json();
    expect(list).toHaveLength(1);
  });

  it('should update a project', async () => {
    const { POST } = await import('../projects/route');
    const { PATCH } = await import('../projects/[id]/route');

    const createRes = await POST(createRequest('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ title: 'Original' }),
    }) as any);
    const created = await createRes.json();

    const patchRes = await PATCH(
      createRequest(`/api/projects/${created.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: 'Updated', status: 'processing' }),
      }) as any,
      { params: Promise.resolve({ id: created.id }) }
    );
    const updated = await patchRes.json();
    expect(updated.title).toBe('Updated');
    expect(updated.status).toBe('processing');
  });

  it('should delete a project', async () => {
    const { POST, GET } = await import('../projects/route');
    const { DELETE } = await import('../projects/[id]/route');

    const createRes = await POST(createRequest('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ title: 'To Delete' }),
    }) as any);
    const created = await createRes.json();

    await DELETE(
      createRequest(`/api/projects/${created.id}`, { method: 'DELETE' }) as any,
      { params: Promise.resolve({ id: created.id }) }
    );

    const listRes = await GET();
    const list = await listRes.json();
    expect(list).toHaveLength(0);
  });
});

describe('Tasks API', () => {
  it('should create and list tasks', async () => {
    const { POST, GET } = await import('../tasks/route');
    const createRes = await POST(createRequest('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: 'Task 1', priority: 'must' }),
    }) as any);
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.title).toBe('Task 1');
    expect(created.priority).toBe('must');

    const listRes = await GET(createRequest('/api/tasks?parent_task_id=null') as any);
    const list = await listRes.json();
    expect(list).toHaveLength(1);
  });

  it('should create sub-task and auto-compute parent status', async () => {
    const { POST } = await import('../tasks/route');
    const { GET, PATCH } = await import('../tasks/[id]/route');

    const parentRes = await POST(createRequest('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: 'Parent Task' }),
    }) as any);
    const parent = await parentRes.json();

    await POST(createRequest('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: 'Sub Task 1', parent_task_id: parent.id }),
    }) as any);

    // Parent should be 'doing' (has yet sub-task)
    const getRes = await GET(
      createRequest(`/api/tasks/${parent.id}`) as any,
      { params: Promise.resolve({ id: parent.id }) }
    );
    const parentUpdated = await getRes.json();
    expect(parentUpdated.status).toBe('doing');
    expect(parentUpdated.sub_tasks).toHaveLength(1);

    // Mark sub-task done
    await PATCH(
      createRequest(`/api/tasks/${parentUpdated.sub_tasks[0].id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'done' }),
      }) as any,
      { params: Promise.resolve({ id: parentUpdated.sub_tasks[0].id }) }
    );

    const getRes2 = await GET(
      createRequest(`/api/tasks/${parent.id}`) as any,
      { params: Promise.resolve({ id: parent.id }) }
    );
    const parentDone = await getRes2.json();
    expect(parentDone.status).toBe('done');
  });

  it('should reject sub-sub-tasks', async () => {
    const { POST } = await import('../tasks/route');

    const parentRes = await POST(createRequest('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: 'Parent' }),
    }) as any);
    const parent = await parentRes.json();

    const subRes = await POST(createRequest('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: 'Sub', parent_task_id: parent.id }),
    }) as any);
    const sub = await subRes.json();

    const subSubRes = await POST(createRequest('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: 'Sub-Sub', parent_task_id: sub.id }),
    }) as any);
    expect(subSubRes.status).toBe(400);
  });

  it('should reject manual status change when sub-tasks exist', async () => {
    const { POST } = await import('../tasks/route');
    const { PATCH } = await import('../tasks/[id]/route');

    const parentRes = await POST(createRequest('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: 'Parent' }),
    }) as any);
    const parent = await parentRes.json();

    await POST(createRequest('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: 'Sub', parent_task_id: parent.id }),
    }) as any);

    const patchRes = await PATCH(
      createRequest(`/api/tasks/${parent.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'done' }),
      }) as any,
      { params: Promise.resolve({ id: parent.id }) }
    );
    expect(patchRes.status).toBe(400);
  });

  it('should handle blocked_by dependencies', async () => {
    const { POST } = await import('../tasks/route');

    const task1Res = await POST(createRequest('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: 'Task 1' }),
    }) as any);
    const task1 = await task1Res.json();

    const task2Res = await POST(createRequest('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: 'Task 2', blocked_by: [task1.id] }),
    }) as any);
    const task2 = await task2Res.json();

    expect(task2.status).toBe('pending');
    expect(task2.blocked_by).toContain(task1.id);
  });

  it('should enforce sibling-only blocked_by for sub-tasks', async () => {
    const { POST } = await import('../tasks/route');

    const parentRes = await POST(createRequest('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: 'Parent' }),
    }) as any);
    const parent = await parentRes.json();

    const sub1Res = await POST(createRequest('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: 'Sub 1', parent_task_id: parent.id }),
    }) as any);
    const sub1 = await sub1Res.json();

    const otherRes = await POST(createRequest('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: 'Other Task' }),
    }) as any);
    const other = await otherRes.json();

    // Sibling blocked_by: should succeed
    const sub2Res = await POST(createRequest('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: 'Sub 2', parent_task_id: parent.id, blocked_by: [sub1.id] }),
    }) as any);
    expect(sub2Res.status).toBe(201);

    // Non-sibling blocked_by: should fail
    const sub3Res = await POST(createRequest('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: 'Sub 3', parent_task_id: parent.id, blocked_by: [other.id] }),
    }) as any);
    expect(sub3Res.status).toBe(400);
  });

  it('should inherit project_id for sub-tasks', async () => {
    const projectRoute = await import('../projects/route');
    const { POST } = await import('../tasks/route');

    const projRes = await projectRoute.POST(createRequest('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ title: 'Project A' }),
    }) as any);
    const project = await projRes.json();

    const parentRes = await POST(createRequest('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: 'Parent', project_id: project.id }),
    }) as any);
    const parent = await parentRes.json();

    const subRes = await POST(createRequest('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: 'Sub', parent_task_id: parent.id }),
    }) as any);
    const sub = await subRes.json();

    expect(sub.project_id).toBe(project.id);
  });
});
