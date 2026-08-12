import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SnippetManager } from '../snippet-manager';

const builtIns = {
  version: '1.0',
  categories: [
    {
      id: 'built-in',
      name: 'Built in',
      icon: 'B',
      description: '',
      snippets: [{ id: 'base', name: 'Base', description: '', content: 'base' }],
    },
  ],
};

describe('SnippetManager data semantics', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => structuredClone(builtIns),
    }));
  });

  it('classifies built-in and custom records', async () => {
    const manager = new SnippetManager();
    await manager.loadData();
    await manager.addSnippet({ id: 'mine', name: 'Mine', description: '', content: 'custom' }, 'built-in');

    expect(manager.isBuiltInCategory('built-in')).toBe(true);
    expect(manager.isBuiltInSnippet('base')).toBe(true);
    expect(manager.isBuiltInSnippet('mine')).toBe(false);
  });

  it('refuses to modify or delete built-in records', async () => {
    const manager = new SnippetManager();
    await manager.loadData();

    expect(await manager.updateSnippet('base', { name: 'Changed' })).toBe(false);
    expect(await manager.deleteSnippet('base')).toBe(false);
    expect(await manager.deleteCategory('built-in')).toBe(false);
  });

  it('moves a custom snippet to another category without duplication', async () => {
    const manager = new SnippetManager();
    await manager.loadData();
    await manager.addCategory({ id: 'target', name: 'Target', icon: 'T', description: '' });
    await manager.addSnippet({ id: 'mine', name: 'Mine', description: '', content: 'before' }, 'built-in');

    expect(await manager.updateSnippet('mine', { content: 'after' }, 'target')).toBe(true);
    expect(manager.getSnippets('built-in').some(item => item.id === 'mine')).toBe(false);
    expect(manager.getSnippets('target').filter(item => item.id === 'mine')).toHaveLength(1);
    expect(manager.getSnippet('mine')?.content).toBe('after');
  });

  it('rejects invalid imports without changing stored data', async () => {
    const manager = new SnippetManager();
    await manager.loadData();
    const before = manager.exportData();

    const result = await manager.importData(JSON.stringify({
      version: '1.0',
      categories: [{ id: '', name: 'Bad', icon: 'X' }],
    }));

    expect(result.success).toBe(false);
    expect(result.error).toContain('category id');
    expect(manager.exportData()).toBe(before);
  });
});
