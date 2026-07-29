import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HistoryStore, normalizeHistoryContent } from '../history-store';

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

let localStorageMock: ReturnType<typeof createLocalStorageMock>;

function createIndexedDBMock(initialItems: any[] = []) {
  let records = [...initialItems];
  const db = {
    objectStoreNames: { contains: vi.fn(() => true) },
    createObjectStore: vi.fn(),
    transaction: vi.fn(() => {
      const transaction: any = {
        objectStore: vi.fn(() => ({
          getAll: vi.fn(() => {
            const request: any = {};
            setTimeout(() => {
              request.result = [...records];
              request.onsuccess?.();
            }, 10);
            return request;
          }),
          clear: vi.fn(() => {
            records = [];
          }),
          put: vi.fn((item: any) => {
            records.push(item);
          }),
        })),
        oncomplete: null,
        onerror: null,
        onabort: null,
        error: null,
      };
      setTimeout(() => transaction.oncomplete?.(), 0);
      return transaction;
    }),
  };
  return {
    open: vi.fn(() => {
      const request: any = {};
      setTimeout(() => {
        request.result = db;
        request.onsuccess?.();
      }, 0);
      return request;
    }),
    records: () => records,
  };
}

beforeEach(() => {
  localStorageMock = createLocalStorageMock();
  vi.stubGlobal('localStorage', localStorageMock);
  vi.stubGlobal('indexedDB', undefined);
});

describe('normalizeHistoryContent', () => {
  it('normalizes line endings and trims only outer whitespace', () => {
    expect(normalizeHistoryContent('  a\r\n  b\r c  ')).toBe('a\n  b\n c');
  });
});

describe('HistoryStore', () => {
  it('migrates legacy localStorage history without applying the old 100 item cap', async () => {
    const oldItems = Array.from({ length: 125 }, (_, index) => ({
      id: `old-${index}`,
      content: `prompt ${index}`,
      name: `Prompt ${index}`,
      timestamp: 1000 + index,
      isFavorite: index % 2 === 0,
    }));
    localStorage.setItem('promptEditor:history', JSON.stringify(oldItems));

    const store = new HistoryStore('test-history-cap');
    await store.init();

    expect(store.getHistory()).toHaveLength(125);
    expect(localStorage.removeItem).not.toHaveBeenCalledWith('promptEditor:history');
  });

  it('adds, toggles, updates, deletes, and searches history after init', async () => {
    const store = new HistoryStore('test-history-crud');
    await store.init();

    await store.add('alpha command', '');
    await store.add('beta prompt', 'Beta');

    const [latest, older] = store.getHistory();
    expect(latest.name).toBe('Beta');
    expect(older.name).toBe('alpha command');

    await store.toggleFavorite(latest.id);
    expect(store.getHistory()[0].isFavorite).toBe(true);

    await store.updateName(latest.id, 'Renamed');
    expect(store.search('renamed')).toHaveLength(1);

    await store.delete(latest.id);
    expect(store.getHistory()).toHaveLength(1);
  });

  it('bulk imports selected prompt memory items as favorites and skips duplicate content', async () => {
    const store = new HistoryStore('test-history-bulk');
    await store.init();
    await store.add('same prompt', 'Manual');

    const result = await store.bulkAddFavorites([
      { content: ' same prompt ', timestamp: 10 },
      { content: 'new prompt', timestamp: 20 },
    ]);

    expect(result).toEqual({ inserted: 1, skipped: 1 });
    expect(store.hasContent('same prompt')).toBe(true);
    expect(store.getHistory().some(item => item.content === 'new prompt' && item.isFavorite)).toBe(true);
  });

  it('waits for IndexedDB initialization before mutating history', async () => {
    const indexedDBMock = createIndexedDBMock([{
      id: 'old',
      content: 'old indexeddb prompt',
      name: 'Old',
      timestamp: 10,
      isFavorite: false,
    }]);
    vi.stubGlobal('indexedDB', indexedDBMock);

    const store = new HistoryStore('test-history-init-race');
    const initPromise = store.init();
    const addPromise = store.add('new prompt', 'New', false, 20);

    await Promise.all([initPromise, addPromise]);

    expect(store.getHistory().map(item => item.content)).toEqual(['new prompt', 'old indexeddb prompt']);
    expect(indexedDBMock.records().map(item => item.content)).toEqual(['new prompt', 'old indexeddb prompt']);
  });
});
