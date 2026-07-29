export interface HistoryItem {
  id: string;
  content: string;
  name: string;
  timestamp: number;
  isFavorite: boolean;
}

export interface FavoriteImportInput {
  content: string;
  timestamp?: number | null;
}

const LEGACY_HISTORY_KEY = 'promptEditor:history';
const MIGRATION_KEY = 'promptEditor:history:indexeddb:v1';
const STORE_NAME = 'history';

export function normalizeHistoryContent(content: string): string {
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

function canUseLocalStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

function canUseIndexedDB(): boolean {
  return typeof indexedDB !== 'undefined';
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function generateName(content: string): string {
  const firstLine = content.split('\n')[0].trim();
  if (!firstLine) return '';
  return firstLine.length > 50 ? `${firstLine.slice(0, 50)}...` : firstLine;
}

function isHistoryItem(value: unknown): value is HistoryItem {
  const item = value as Partial<HistoryItem>;
  return Boolean(
    item &&
    typeof item.id === 'string' &&
    typeof item.content === 'string' &&
    typeof item.name === 'string' &&
    typeof item.timestamp === 'number' &&
    typeof item.isFavorite === 'boolean'
  );
}

export class HistoryStore {
  private db: IDBDatabase | null = null;
  private initialized = false;
  private items: HistoryItem[] = [];
  private byId = new Map<string, HistoryItem>();
  private byContent = new Set<string>();

  constructor(private readonly dbName = 'prompt-editor-history') {
    this.items = this.readLegacyHistory();
    this.rebuildIndexes();
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    if (!canUseIndexedDB()) {
      this.initialized = true;
      return;
    }

    const db = await this.openDb();
    const dbItems = await this.loadFromIndexedDB(db);
    const legacy = this.readLegacyHistory();
    const shouldMigrate = legacy.length > 0 && localStorage.getItem(MIGRATION_KEY) !== 'done';

    this.items = shouldMigrate ? legacy : dbItems;
    this.sortItems();
    this.rebuildIndexes();

    if (shouldMigrate) {
      await this.replaceAllInIndexedDB(db, this.items);
      localStorage.setItem(MIGRATION_KEY, 'done');
      localStorage.removeItem(LEGACY_HISTORY_KEY);
    }

    this.initialized = true;
  }

  getHistory(): HistoryItem[] {
    return [...this.items];
  }

  search(query: string): HistoryItem[] {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return this.getHistory();
    return this.items.filter(item =>
      item.name.toLowerCase().includes(normalized) ||
      item.content.toLowerCase().includes(normalized)
    );
  }

  hasContent(content: string): boolean {
    return this.byContent.has(normalizeHistoryContent(content));
  }

  async add(content: string, name?: string, isFavorite = false, timestamp = Date.now()): Promise<HistoryItem | null> {
    if (!content.trim()) return null;
    if (this.items[0]?.content === content) return this.items[0];

    const item: HistoryItem = {
      id: generateId(),
      content,
      name: name || generateName(content),
      timestamp,
      isFavorite,
    };

    await this.replaceItems([item, ...this.items]);
    return item;
  }

  async bulkAddFavorites(inputs: FavoriteImportInput[]): Promise<{ inserted: number; skipped: number }> {
    const additions: HistoryItem[] = [];
    const seen = new Set(this.byContent);
    let skipped = 0;

    for (const input of inputs) {
      const content = normalizeHistoryContent(input.content);
      if (!content || seen.has(content)) {
        skipped++;
        continue;
      }

      seen.add(content);
      additions.push({
        id: generateId(),
        content,
        name: generateName(content),
        timestamp: input.timestamp || Date.now(),
        isFavorite: true,
      });
    }

    if (additions.length > 0) {
      await this.replaceItems([...additions, ...this.items]);
    }

    return { inserted: additions.length, skipped };
  }

  async delete(id: string): Promise<void> {
    await this.replaceItems(this.items.filter(item => item.id !== id));
  }

  async toggleFavorite(id: string): Promise<void> {
    const next = this.items.map(item =>
      item.id === id ? { ...item, isFavorite: !item.isFavorite } : item
    );
    await this.replaceItems(next);
  }

  async updateName(id: string, name: string): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) return;
    const next = this.items.map(item =>
      item.id === id ? { ...item, name: trimmed } : item
    );
    await this.replaceItems(next);
  }

  private async replaceItems(next: HistoryItem[]): Promise<void> {
    const previous = this.items;
    this.items = next;
    this.sortItems();
    this.rebuildIndexes();

    try {
      await this.persist();
    } catch (error) {
      this.items = previous;
      this.rebuildIndexes();
      throw error;
    }
  }

  private sortItems(): void {
    this.items.sort((a, b) => b.timestamp - a.timestamp);
  }

  private rebuildIndexes(): void {
    this.byId = new Map(this.items.map(item => [item.id, item]));
    this.byContent = new Set(
      this.items.map(item => normalizeHistoryContent(item.content)).filter(Boolean)
    );
  }

  private readLegacyHistory(): HistoryItem[] {
    if (!canUseLocalStorage()) return [];
    try {
      const raw = localStorage.getItem(LEGACY_HISTORY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter(isHistoryItem) : [];
    } catch {
      return [];
    }
  }

  private async persist(): Promise<void> {
    if (canUseIndexedDB()) {
      const db = await this.openDb();
      await this.replaceAllInIndexedDB(db, this.items);
      return;
    }

    if (canUseLocalStorage()) {
      localStorage.setItem(LEGACY_HISTORY_KEY, JSON.stringify(this.items));
    }
  }

  private openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        resolve(this.db);
        return;
      }

      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  private loadFromIndexedDB(db: IDBDatabase): Promise<HistoryItem[]> {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        const items = Array.isArray(request.result) ? request.result.filter(isHistoryItem) : [];
        resolve(items);
      };
      request.onerror = () => reject(request.error);
    });
  }

  private replaceAllInIndexedDB(db: IDBDatabase, items: HistoryItem[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.clear();
      for (const item of items) {
        store.put(item);
      }
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }
}

export const historyStore = new HistoryStore();
