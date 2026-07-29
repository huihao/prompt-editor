import { historyStore, HistoryStore } from './history-store';

export type PromptMemoryAgent = 'claudeCode' | 'codex' | 'openCode' | 'pi' | 'kimi';

export interface PromptMemoryDirectory {
  id: string;
  agent: PromptMemoryAgent;
  path: string;
  isDetected: boolean;
  exists: boolean;
  modifiedAt?: string | null;
  selected?: boolean;
}

export interface PromptMemoryItem {
  id: string;
  content: string;
  timestamp?: string | null;
  agents: PromptMemoryAgent[];
  sourceDirectories: string[];
  projectDirectory?: string | null;
  selected?: boolean;
  expanded?: boolean;
  existsInHistory?: boolean;
  saved?: boolean;
}

export interface PromptMemoryProgress {
  scanId: string;
  directoryId: string;
  status: 'waiting' | 'scanning' | 'completed' | 'skipped' | 'failed' | 'cancelled';
  filesRead: number;
  extracted: number;
  skipped: number;
  error?: string | null;
}

interface NativeBatch {
  scanId: string;
  items: PromptMemoryItem[];
}

const CUSTOM_DIRECTORIES_KEY = 'promptEditor:promptMemory:customDirectories';

function postToNative(action: string, data: Record<string, unknown> = {}): void {
  const handler = (window as any).webkit?.messageHandlers?.promptEditor;
  if (handler) {
    handler.postMessage({ action, ...data });
  }
}

function callbackName(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function loadCustomDirectories(): PromptMemoryDirectory[] {
  try {
    const raw = localStorage.getItem(CUSTOM_DIRECTORIES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCustomDirectories(directories: PromptMemoryDirectory[]): void {
  localStorage.setItem(CUSTOM_DIRECTORIES_KEY, JSON.stringify(directories.filter(dir => !dir.isDetected)));
}

export class PromptMemoryController {
  directories: PromptMemoryDirectory[] = [];
  items: PromptMemoryItem[] = [];
  progress: PromptMemoryProgress[] = [];
  scanId = '';
  isScanning = false;
  error: string | null = null;

  constructor(private readonly store: Pick<HistoryStore, 'hasContent' | 'bulkAddFavorites'> = historyStore) {
    this.installCallbacks();
  }

  async detectDirectories(): Promise<PromptMemoryDirectory[]> {
    return new Promise(resolve => {
      const name = callbackName('promptMemoryDirectories');
      (window as any)[name] = (directories: PromptMemoryDirectory[] = []) => {
        delete (window as any)[name];
        const detected = directories.map(dir => ({ ...dir, selected: dir.exists }));
        const custom = loadCustomDirectories();
      this.directories = [...detected, ...custom];
      resolve(this.directories);
      };

      postToNative('detectPromptMemoryDirectories', { callback: name });
      if (!(window as any).webkit?.messageHandlers?.promptEditor) {
        (window as any)[name]([]);
      }
    });
  }

  async chooseDirectory(agent: PromptMemoryAgent): Promise<PromptMemoryDirectory | null> {
    return new Promise(resolve => {
      const name = callbackName('promptMemoryDirectory');
      (window as any)[name] = (path: string | null) => {
        delete (window as any)[name];
        if (!path) {
          resolve(null);
          return;
        }
        const directory: PromptMemoryDirectory = {
          id: `${agent}:${path}`,
          agent,
          path,
          isDetected: false,
          exists: true,
          selected: true,
        };
        this.directories = [
          ...this.directories.filter(existing => existing.id !== directory.id),
          directory,
        ];
        saveCustomDirectories(this.directories);
        resolve(directory);
      };

      postToNative('choosePromptMemoryDirectory', { callback: name });
      if (!(window as any).webkit?.messageHandlers?.promptEditor) {
        (window as any)[name](null);
      }
    });
  }

  startScan(directories: PromptMemoryDirectory[]): string {
    this.scanId = `scan-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.items = [];
    this.progress = [];
    this.isScanning = true;
    this.error = null;
    this.emitUpdate();
    postToNative('startPromptMemoryScan', {
      scanId: this.scanId,
      directories: directories.filter(dir => dir.selected),
    });
    return this.scanId;
  }

  cancelScan(): void {
    if (!this.scanId) return;
    postToNative('cancelPromptMemoryScan', { scanId: this.scanId });
    this.isScanning = false;
    this.progress = this.progress.map(progress => (
      progress.status === 'scanning' || progress.status === 'waiting'
        ? { ...progress, status: 'cancelled' }
        : progress
    ));
    this.emitUpdate();
  }

  async saveSelectedToFavorites(): Promise<{ inserted: number; skipped: number }> {
    const selected = this.items.filter(item => item.selected && !item.existsInHistory && !item.saved);
    const result = await this.store.bulkAddFavorites(selected.map(item => ({
      content: item.content,
      timestamp: item.timestamp ? new Date(item.timestamp).getTime() : null,
    })));
    for (const item of selected) {
      const saved = this.store.hasContent(item.content);
      item.saved = saved;
      item.selected = false;
      item.existsInHistory = saved;
    }
    return result;
  }

  private installCallbacks(): void {
    (window as any).onPromptMemoryScanProgress = (progress: PromptMemoryProgress) => {
      if (progress.scanId !== this.scanId) return;
      const index = this.progress.findIndex(item => item.directoryId === progress.directoryId);
      if (index >= 0) {
        this.progress[index] = progress;
      } else {
        this.progress.push(progress);
      }
      this.emitUpdate();
    };

    (window as any).onPromptMemoryScanBatch = (batch: NativeBatch) => {
      if (batch.scanId !== this.scanId) return;
      for (const item of batch.items) {
        const next = {
          ...item,
          selected: false,
          existsInHistory: this.store.hasContent(item.content),
        };
        const index = this.items.findIndex(existing => existing.id === item.id);
        if (index >= 0) {
          this.items[index] = next;
        } else {
          this.items.push(next);
        }
      }
      this.sortItems();
      this.emitUpdate();
    };

    (window as any).onPromptMemoryScanCompleted = (batch: NativeBatch) => {
      if (batch.scanId !== this.scanId) return;
      (window as any).onPromptMemoryScanBatch(batch);
      this.isScanning = false;
      this.emitUpdate();
    };

    (window as any).onPromptMemoryScanFailed = (failure: { scanId: string; error: string }) => {
      if (failure.scanId !== this.scanId) return;
      this.isScanning = false;
      this.error = failure.error;
      this.emitUpdate();
    };
  }

  private emitUpdate(): void {
    window.dispatchEvent(new CustomEvent('prompt-memory:update'));
  }

  private sortItems(): void {
    this.items.sort((a, b) => {
      const left = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const right = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return right - left || a.id.localeCompare(b.id);
    });
  }
}
