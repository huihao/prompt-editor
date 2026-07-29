import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PromptMemoryController } from '../prompt-memory';

function createLocalStorageMock() {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: () => {
      store = {};
    },
  };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', createLocalStorageMock());
  vi.stubGlobal('webkit', {
    messageHandlers: {
      promptEditor: { postMessage: vi.fn() },
    },
  });
});

describe('PromptMemoryController', () => {
  it('detects directories through native bridge and marks existing detected dirs selected', async () => {
    const controller = new PromptMemoryController();
    const promise = controller.detectDirectories();
    const callbackName = Object.keys(window).find(key => key.startsWith('promptMemoryDirectories_'))!;

    (window as any)[callbackName]([
      { id: 'd1', agent: 'codex', path: '/tmp/codex', isDetected: true, exists: true },
      { id: 'd2', agent: 'kimi', path: '/tmp/kimi', isDetected: true, exists: false },
    ]);

    const dirs = await promise;
    expect(dirs.find(dir => dir.id === 'd1')?.selected).toBe(true);
    expect(dirs.find(dir => dir.id === 'd2')?.selected).toBe(false);
  });

  it('ignores stale scan batches after a new scan starts', () => {
    const controller = new PromptMemoryController();
    controller.startScan([{ id: 'd', agent: 'codex', path: '/tmp/codex', isDetected: true, exists: true, selected: true }]);
    const oldScanId = controller.scanId;
    controller.startScan([{ id: 'd2', agent: 'kimi', path: '/tmp/kimi', isDetected: true, exists: true, selected: true }]);

    (window as any).onPromptMemoryScanBatch({
      scanId: oldScanId,
      items: [{ id: 'old', content: 'old', agents: ['codex'], sourceDirectories: [] }],
    });

    expect(controller.items).toHaveLength(0);
  });

  it('merges batches and marks existing history content', () => {
    const controller = new PromptMemoryController({ hasContent: (content: string) => content === 'old prompt' } as any);
    controller.startScan([{ id: 'd', agent: 'codex', path: '/tmp/codex', isDetected: true, exists: true, selected: true }]);

    (window as any).onPromptMemoryScanBatch({
      scanId: controller.scanId,
      items: [
        { id: '1', content: 'old prompt', agents: ['codex'], sourceDirectories: ['/tmp/codex'] },
        { id: '2', content: 'new prompt', agents: ['codex'], sourceDirectories: ['/tmp/codex'] },
      ],
    });

    expect(controller.items.find(item => item.id === '1')?.existsInHistory).toBe(true);
    expect(controller.items.find(item => item.id === '2')?.existsInHistory).toBe(false);
  });

  it('saves selected items to favorites', async () => {
    const historyStore = {
      hasContent: vi.fn(() => false),
      bulkAddFavorites: vi.fn(async () => ({ inserted: 1, skipped: 0 })),
    };
    const controller = new PromptMemoryController(historyStore as any);
    controller.startScan([{ id: 'd', agent: 'codex', path: '/tmp/codex', isDetected: true, exists: true, selected: true }]);
    (window as any).onPromptMemoryScanBatch({
      scanId: controller.scanId,
      items: [{ id: '1', content: 'save me', agents: ['codex'], sourceDirectories: [], selected: true }],
    });
    controller.items[0].selected = true;

    const result = await controller.saveSelectedToFavorites();

    expect(result).toEqual({ inserted: 1, skipped: 0 });
    expect(historyStore.bulkAddFavorites).toHaveBeenCalledWith([{ content: 'save me', timestamp: null }]);
    expect(controller.items[0].saved).toBe(true);
  });
});
