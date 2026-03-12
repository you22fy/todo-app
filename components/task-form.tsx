'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { TaskPriority, TaskStatus, ProjectWithCounts, TaskWithRelations } from '@/lib/types';

interface TaskFormProps {
  onSubmit: (data: {
    title: string;
    condition?: string;
    due_date?: string | null;
    priority?: TaskPriority;
    status?: TaskStatus;
    project_id?: string | null;
    parent_task_id?: string | null;
    blocked_by?: string[];
  }) => Promise<void>;
  projects?: ProjectWithCounts[];
  defaultProjectId?: string | null;
  parentTaskId?: string | null;
  siblingTasks?: TaskWithRelations[];
  editTask?: TaskWithRelations;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerLabel?: string;
}

export function TaskForm({
  onSubmit,
  projects = [],
  defaultProjectId = null,
  parentTaskId = null,
  siblingTasks = [],
  editTask,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  triggerLabel,
}: TaskFormProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (controlledOnOpenChange || (() => {})) : setInternalOpen;

  const [title, setTitle] = useState('');
  const [condition, setCondition] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('should');
  const [status, setStatus] = useState<TaskStatus>('yet');
  const [projectId, setProjectId] = useState<string>('__none__');
  const [blockedBy, setBlockedBy] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      if (editTask) {
        setTitle(editTask.title);
        setCondition(editTask.condition);
        setDueDate(editTask.due_date || '');
        setPriority(editTask.priority);
        setStatus(editTask.status);
        setProjectId(editTask.project_id || '__none__');
        setBlockedBy(editTask.blocked_by || []);
      } else {
        setTitle('');
        setCondition('');
        setDueDate('');
        setPriority('should');
        setStatus('yet');
        setProjectId(defaultProjectId || '__none__');
        setBlockedBy([]);
      }
    }
  }, [open, editTask, defaultProjectId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    try {
      await onSubmit({
        title: title.trim(),
        condition: condition.trim() || undefined,
        due_date: dueDate || null,
        priority,
        status,
        project_id: projectId === '__none__' ? null : projectId,
        parent_task_id: parentTaskId,
        blocked_by: blockedBy.length > 0 ? blockedBy : undefined,
      });
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  const availableSiblings = siblingTasks.filter(t => t.id !== editTask?.id);

  const dialogContent = (
    <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{editTask ? 'Edit Task' : parentTaskId ? 'Add Sub-task' : 'New Task'}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="title">Title *</Label>
          <Input id="title" value={title} onChange={e => setTitle(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="condition">Completion Condition</Label>
          <Textarea id="condition" value={condition} onChange={e => setCondition(e.target.value)} rows={2} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Priority</Label>
            <Select value={priority} onValueChange={v => v && setPriority(v as TaskPriority)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="must">Must</SelectItem>
                <SelectItem value="should">Should</SelectItem>
                <SelectItem value="want">Want</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={v => v && setStatus(v as TaskStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="yet">Yet</SelectItem>
                <SelectItem value="doing">Doing</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="done">Done</SelectItem>
                <SelectItem value="canceled">Canceled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="due_date">Due Date</Label>
          <Input id="due_date" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
        </div>
        {!parentTaskId && (
          <div>
            <Label>Project</Label>
            <Select value={projectId} onValueChange={(v) => setProjectId(v || '__none__')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {availableSiblings.length > 0 && (
          <div>
            <Label>Blocked By</Label>
            <div className="space-y-1 mt-1 max-h-32 overflow-y-auto border rounded-md p-2">
              {availableSiblings.map(t => (
                <label key={t.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={blockedBy.includes(t.id)}
                    onChange={e => {
                      if (e.target.checked) {
                        setBlockedBy([...blockedBy, t.id]);
                      } else {
                        setBlockedBy(blockedBy.filter(id => id !== t.id));
                      }
                    }}
                    className="rounded"
                  />
                  {t.title}
                </label>
              ))}
            </div>
          </div>
        )}
        <Button type="submit" className="w-full" disabled={loading || !title.trim()}>
          {loading ? 'Saving...' : editTask ? 'Update' : 'Create'}
        </Button>
      </form>
    </DialogContent>
  );

  if (isControlled) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        {dialogContent}
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant={triggerLabel ? 'outline' : 'default'} />}>
        {triggerLabel || '+ Task'}
      </DialogTrigger>
      {dialogContent}
    </Dialog>
  );
}
