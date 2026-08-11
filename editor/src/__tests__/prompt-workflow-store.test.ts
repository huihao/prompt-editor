import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseWorkflowResponse } from '../prompt-orchestration';
import { PromptWorkflowStore, WORKFLOW_STORAGE_KEY } from '../prompt-workflow-store';

function makeWorkflow(title = 'Research plan') {
  return parseWorkflowResponse(JSON.stringify({
    title,
    stages: [{ prompts: [{ title: 'Research', content: 'Find primary sources.' }] }],
  }), 'Research this topic');
}

describe('PromptWorkflowStore', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('saves and retrieves a defensive copy of a workflow', () => {
    const store = new PromptWorkflowStore();
    const workflow = makeWorkflow();
    const saved = store.save(workflow);

    expect(store.list()).toHaveLength(1);
    expect(store.get(workflow.id)?.title).toBe('Research plan');
    saved.title = 'Mutated outside';
    expect(store.get(workflow.id)?.title).toBe('Research plan');
  });

  it('updates an existing workflow and its updated timestamp', () => {
    const store = new PromptWorkflowStore();
    const workflow = makeWorkflow();
    vi.spyOn(Date, 'now').mockReturnValueOnce(100).mockReturnValueOnce(200);

    const first = store.save(workflow);
    const second = store.save({ ...first, title: 'Updated plan' });

    expect(second.createdAt).toBe(100);
    expect(second.updatedAt).toBe(200);
    expect(store.list()).toHaveLength(1);
    expect(store.get(workflow.id)?.title).toBe('Updated plan');
  });

  it('renames, duplicates, and deletes workflows', () => {
    const store = new PromptWorkflowStore();
    const original = store.save(makeWorkflow());

    expect(store.rename(original.id, 'New title')?.title).toBe('New title');
    const copy = store.duplicate(original.id);
    expect(copy?.id).not.toBe(original.id);
    expect(copy?.title).toBe('New title copy');
    expect(copy?.sourcePrompt).toBe(original.sourcePrompt);
    expect(store.list()).toHaveLength(2);

    expect(store.delete(original.id)).toBe(true);
    expect(store.get(original.id)).toBeUndefined();
    expect(store.list()).toHaveLength(1);
  });

  it('recovers from malformed or incompatible stored data', () => {
    localStorage.setItem(WORKFLOW_STORAGE_KEY, '{broken');
    expect(new PromptWorkflowStore().list()).toEqual([]);

    localStorage.setItem(WORKFLOW_STORAGE_KEY, JSON.stringify([{ id: 'invalid' }]));
    expect(new PromptWorkflowStore().list()).toEqual([]);
  });
});
