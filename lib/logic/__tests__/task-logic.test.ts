import { describe, it, expect } from 'vitest';
import {
  computeParentStatus,
  shouldBePending,
  validateSubTaskDependencies,
  canBeSubTask,
  canManuallyChangeStatus,
  computeEffectiveStatus,
} from '../task-logic';

describe('computeParentStatus', () => {
  it('should throw if no sub-tasks', () => {
    expect(() => computeParentStatus([])).toThrow();
  });

  it('should return done if all sub-tasks are done', () => {
    expect(computeParentStatus([
      { status: 'done' },
      { status: 'done' },
    ])).toBe('done');
  });

  it('should return done if all sub-tasks are done or canceled', () => {
    expect(computeParentStatus([
      { status: 'done' },
      { status: 'canceled' },
    ])).toBe('done');
  });

  it('should return doing if any sub-task is doing', () => {
    expect(computeParentStatus([
      { status: 'doing' },
      { status: 'done' },
    ])).toBe('doing');
  });

  it('should return doing if any sub-task is yet', () => {
    expect(computeParentStatus([
      { status: 'yet' },
      { status: 'done' },
    ])).toBe('doing');
  });

  it('should return doing if any sub-task is pending', () => {
    expect(computeParentStatus([
      { status: 'pending' },
      { status: 'done' },
    ])).toBe('doing');
  });

  it('should return done if all canceled', () => {
    expect(computeParentStatus([
      { status: 'canceled' },
      { status: 'canceled' },
    ])).toBe('done');
  });
});

describe('shouldBePending', () => {
  it('should return false if no blockers', () => {
    expect(shouldBePending([])).toBe(false);
  });

  it('should return false if all blockers are done', () => {
    expect(shouldBePending(['done', 'done'])).toBe(false);
  });

  it('should return false if all blockers are done or canceled', () => {
    expect(shouldBePending(['done', 'canceled'])).toBe(false);
  });

  it('should return true if any blocker is yet', () => {
    expect(shouldBePending(['yet', 'done'])).toBe(true);
  });

  it('should return true if any blocker is doing', () => {
    expect(shouldBePending(['doing'])).toBe(true);
  });

  it('should return true if any blocker is pending', () => {
    expect(shouldBePending(['pending'])).toBe(true);
  });
});

describe('validateSubTaskDependencies', () => {
  const siblings = [
    { id: 's1', parent_task_id: 'parent1' },
    { id: 's2', parent_task_id: 'parent1' },
    { id: 's3', parent_task_id: 'parent1' },
    { id: 'other', parent_task_id: 'parent2' },
  ];

  it('should be valid with no blocked_by', () => {
    expect(validateSubTaskDependencies('parent1', [], siblings)).toEqual({ valid: true });
  });

  it('should be valid when blocked_by references siblings', () => {
    expect(validateSubTaskDependencies('parent1', ['s1', 's2'], siblings)).toEqual({ valid: true });
  });

  it('should be invalid when blocked_by references non-sibling', () => {
    const result = validateSubTaskDependencies('parent1', ['other'], siblings);
    expect(result.valid).toBe(false);
  });

  it('should be invalid when task has no parent', () => {
    const result = validateSubTaskDependencies(null, ['s1'], siblings);
    expect(result.valid).toBe(false);
  });
});

describe('canBeSubTask', () => {
  it('should return true if parent has no parent', () => {
    expect(canBeSubTask({ parent_task_id: null })).toBe(true);
  });

  it('should return false if parent is already a sub-task', () => {
    expect(canBeSubTask({ parent_task_id: 'some-id' })).toBe(false);
  });
});

describe('canManuallyChangeStatus', () => {
  it('should return true if no sub-tasks', () => {
    expect(canManuallyChangeStatus(false)).toBe(true);
  });

  it('should return false if has sub-tasks', () => {
    expect(canManuallyChangeStatus(true)).toBe(false);
  });
});

describe('computeEffectiveStatus', () => {
  it('should return current status if no blockers', () => {
    expect(computeEffectiveStatus('yet', [])).toBe('yet');
  });

  it('should return pending if any blocker is active', () => {
    expect(computeEffectiveStatus('yet', ['doing'])).toBe('pending');
  });

  it('should return yet if was pending and all blockers resolved', () => {
    expect(computeEffectiveStatus('pending', ['done'])).toBe('yet');
  });

  it('should keep current status if blockers all resolved and not pending', () => {
    expect(computeEffectiveStatus('doing', ['done', 'canceled'])).toBe('doing');
  });
});
