import { describe, it, expect } from 'vitest';
import { suggestProjectStatus } from '../project-logic';

describe('suggestProjectStatus', () => {
  it('should return yet if no tasks', () => {
    expect(suggestProjectStatus([])).toBe('yet');
  });

  it('should return finished if all tasks are done', () => {
    expect(suggestProjectStatus([
      { status: 'done' },
      { status: 'done' },
    ])).toBe('finished');
  });

  it('should return finished if all tasks are done or canceled', () => {
    expect(suggestProjectStatus([
      { status: 'done' },
      { status: 'canceled' },
    ])).toBe('finished');
  });

  it('should return processing if any task is doing', () => {
    expect(suggestProjectStatus([
      { status: 'doing' },
      { status: 'yet' },
    ])).toBe('processing');
  });

  it('should return processing if any task is pending', () => {
    expect(suggestProjectStatus([
      { status: 'pending' },
      { status: 'yet' },
    ])).toBe('processing');
  });

  it('should return yet if all tasks are yet', () => {
    expect(suggestProjectStatus([
      { status: 'yet' },
      { status: 'yet' },
    ])).toBe('yet');
  });

  it('should return yet if all tasks are yet or canceled', () => {
    expect(suggestProjectStatus([
      { status: 'yet' },
      { status: 'canceled' },
    ])).toBe('yet');
  });
});
