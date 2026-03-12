'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ProjectStatus, ProjectWithCounts } from '@/lib/types';

interface ProjectFormProps {
  onSubmit: (data: { title: string; condition?: string; status?: ProjectStatus }) => Promise<void>;
  editProject?: ProjectWithCounts;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ProjectForm({ onSubmit, editProject, open: controlledOpen, onOpenChange: controlledOnOpenChange }: ProjectFormProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (controlledOnOpenChange || (() => {})) : setInternalOpen;

  const [title, setTitle] = useState('');
  const [condition, setCondition] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('yet');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      if (editProject) {
        setTitle(editProject.title);
        setCondition(editProject.condition);
        setStatus(editProject.status);
      } else {
        setTitle('');
        setCondition('');
        setStatus('yet');
      }
    }
  }, [open, editProject]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    try {
      await onSubmit({
        title: title.trim(),
        condition: condition.trim() || undefined,
        status,
      });
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  const dialogContent = (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>{editProject ? 'Edit Project' : 'New Project'}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="p-title">Title *</Label>
          <Input id="p-title" value={title} onChange={e => setTitle(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="p-condition">Completion Condition</Label>
          <Textarea id="p-condition" value={condition} onChange={e => setCondition(e.target.value)} rows={2} />
        </div>
        <div>
          <Label>Status</Label>
          <Select value={status} onValueChange={v => v && setStatus(v as ProjectStatus)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="yet">Yet</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="finished">Finished</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" className="w-full" disabled={loading || !title.trim()}>
          {loading ? 'Saving...' : editProject ? 'Update' : 'Create'}
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
      <DialogTrigger render={<Button size="sm" />}>
        + Project
      </DialogTrigger>
      {dialogContent}
    </Dialog>
  );
}
