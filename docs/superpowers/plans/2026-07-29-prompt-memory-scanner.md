# Prompt Memory Scanner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a macOS-only local prompt memory scanner that detects common Coding Agent history directories, extracts user inputs, displays selectable results, and saves chosen entries into favorites without any application-level history cap.

**Architecture:** Native Swift owns local filesystem detection, JSONL/SQLite parsing, filtering, deduplication, cancellation, and WKWebView callbacks. The frontend owns modal state, directory selection, result selection, existing-history detection, and batched favorite writes through a new IndexedDB-backed `HistoryStore`.

**Tech Stack:** SwiftPM macOS app with WebKit bridge, Foundation file APIs, SQLite3 C API, Vite/TypeScript frontend, Vitest/JSDOM tests, XCTest.

---

## Existing Context

- Worktree: `/Users/huihao/open/prompt-editor/.worktrees/prompt-memory-scanner`
- Branch: `feature/prompt-memory-scanner`
- Product design: `docs/superpowers/specs/2026-07-29-prompt-memory-scanner-design.md`
- Baseline frontend build passes with `npm run build`.
- Baseline frontend tests have one known failure in `editor/src/__tests__/bridge.test.ts` caused by a production debug `console.log('[bridge] Sending:', ...)`.
- Baseline Swift tests do not compile because `macos/Tests/PromptEditorTests.swift` still expects `BridgeAction.send(content:target:)`, while `macos/PromptEditor/Helpers.swift` already defines `send(content:target:agentId:pid:terminalApp:)`.
- Run npm commands from `editor/`, using `env npm_config_cache=/private/tmp/prompt-editor-prompt-memory-npm-cache npm ...` to avoid the local npm cache permission issue.
- Run `cargo build --release` in `core/` if `macos/Libraries/libprompt_editor_core.a` is missing in a fresh worktree.

## File Structure

### Frontend

- Create `editor/src/history-store.ts`
  - Owns the `HistoryItem` type, localStorage migration, IndexedDB CRUD, normalized content keys, in-memory indexes, bulk favorite insert, and synchronous read APIs used by the existing UI.
- Create `editor/src/__tests__/history-store.test.ts`
  - Covers migration, no cap, duplicate handling, favorite import, delete/toggle/update/search, and rollback-visible behavior on write failure.
- Modify `editor/src/bridge.ts`
  - Remove local `HistoryItem`, `HISTORY_KEY`, `MAX_HISTORY_ITEMS`, `getHistory()`, and `saveHistory()`.
  - Import `historyStore` and route all history operations through it.
  - Add prompt memory bridge methods that post native actions and receive callbacks.
  - Remove the send debug log that breaks baseline tests.
- Modify `editor/src/__tests__/bridge.test.ts`
  - Keep the existing send test strict after removing the debug log.
  - Add tests for prompt memory native request wrappers and callback dispatch.
- Create `editor/src/prompt-memory.ts`
  - Defines TypeScript models, native callback registration, scan session state, and `PromptMemoryController`.
- Create `editor/src/__tests__/prompt-memory.test.ts`
  - Covers stale `scanId` callbacks, batch merge, directory persistence, scan cancellation, and save-to-favorites duplicate marking.
- Create `editor/src/prompt-memory-ui.ts`
  - Builds and owns the modal: directory rows, custom directory flow, scanning progress, result filters, selection, preview expansion, and save button.
- Create `editor/src/__tests__/prompt-memory-ui.test.ts`
  - Covers open state, detected directory default selection, result filtering, selection, and save action wiring.
- Modify `editor/src/editor.ts`
  - Import `initPromptMemoryUI`.
  - Bind the new toolbar button.
  - Await `historyStore.init()` before history-dependent keyboard/list behavior is used.
- Modify `editor/index.html`
  - Add the toolbar icon button next to `btn-history`.
  - Add `<div id="prompt-memory-root"></div>`.
  - Add modal CSS matching existing compact app styling.

### macOS Swift

- Modify `macos/Package.swift`
  - Include new Swift sources in `PromptEditorLib`.
  - Add a `SQLite3` system library target and link it for OpenCode database fallback.
- Create `macos/Libraries/SQLite3/module.modulemap`
  - Exposes the macOS SDK SQLite3 header to Swift without conflicting with the existing `PromptEditorCore` modulemap in `macos/Libraries/module.modulemap`.
- Modify `macos/PromptEditor/Helpers.swift`
  - Add bridge actions: `detectPromptMemoryDirectories`, `choosePromptMemoryDirectory`, `startPromptMemoryScan`, `cancelPromptMemoryScan`.
  - Preserve existing action parsing behavior.
- Create `macos/PromptEditor/PromptMemoryModels.swift`
  - Defines `PromptMemoryAgent`, `PromptMemoryDirectory`, `PromptMemoryItem`, progress/status DTOs, scan request DTOs, and JSON encoding helpers.
- Create `macos/PromptEditor/PromptMemoryParser.swift`
  - Defines parser protocol, parsing context, line/file counters, normalization, control-command filtering, and JSON helpers.
- Create `macos/PromptEditor/PromptMemoryParsers/ClaudeCodeParser.swift`
  - Parses `~/.claude/projects/**/*.jsonl` user messages.
- Create `macos/PromptEditor/PromptMemoryParsers/CodexParser.swift`
  - Parses `~/.codex/history.jsonl` and compatible `sessions/**/*.jsonl`.
- Create `macos/PromptEditor/PromptMemoryParsers/OpenCodeParser.swift`
  - Parses prompt-history JSONL and falls back to readonly SQLite `session_input`.
- Create `macos/PromptEditor/PromptMemoryParsers/PiParser.swift`
  - Parses Pi session JSONL user message blocks.
- Create `macos/PromptEditor/PromptMemoryParsers/KimiParser.swift`
  - Parses Kimi `user-history/*.jsonl`.
- Create `macos/PromptEditor/PromptMemoryScanner.swift`
  - Detects default directories, runs selected parsers in a cancellable task, batches results, dedupes by normalized content, and reports progress.
- Modify `macos/PromptEditor/MainWindow.swift`
  - Owns a `PromptMemoryScanner`.
  - Handles prompt memory bridge actions.
  - Calls JS callbacks with JSON encoded through `JSONSerialization`, not string interpolation of prompt content.
- Modify `macos/Tests/PromptEditorTests.swift`
  - Fix existing `BridgeAction.send` tests for current signature.
  - Add parser, filtering, dedupe, directory detection, and bridge action tests.
- Create `macos/Tests/PromptMemoryFixtures.swift`
  - Builds temporary JSONL/SQLite fixtures using `FileManager` and SQLite3 for parser tests.

---

## Task 0: Repair Baseline Tests

**Files:**
- Modify: `editor/src/bridge.ts`
- Modify: `macos/Tests/PromptEditorTests.swift`

- [ ] **Step 1: Remove the frontend send debug log**

In `editor/src/bridge.ts`, replace:

```ts
    // DEBUG: Show what we're about to send
    const debugInfo = `Target: ${target}\nEffective: ${effectiveTarget}\nAgent Type: ${agentType}\nMatched: ${agentInfo ? 'YES' : 'NO'}\nTerminal: ${agentInfo?.terminalApp || 'none'}`;
    console.log('[bridge] Sending:', debugInfo);
    // alert(debugInfo); // Uncomment to show debug alert
```

with:

```ts
    // Keep send quiet; tests and production WKWebView should not expose prompt routing details.
```

- [ ] **Step 2: Run the focused frontend test**

Run:

```bash
env npm_config_cache=/private/tmp/prompt-editor-prompt-memory-npm-cache npm test -- editor/src/__tests__/bridge.test.ts
```

Expected: `bridge.test.ts` passes. If another debug log assertion fails, remove only the log that is exercised by the tested production path.

- [ ] **Step 3: Update Swift send equality assertions**

In `macos/Tests/PromptEditorTests.swift`, replace every expected `.send(content: "...", target: "...")` with the full signature:

```swift
.send(content: "hello world", target: "default", agentId: nil, pid: nil, terminalApp: nil)
```

For the test with agent metadata, assert the full value:

```swift
XCTAssertEqual(
    action,
    .send(content: "test", target: "codex", agentId: "codex-1234", pid: 1234, terminalApp: "Terminal")
)
```

For pattern matching, replace:

```swift
if case .send(let content, let target) = action {
```

with:

```swift
if case .send(let content, let target, let agentId, let pid, let terminalApp) = action {
    XCTAssertNil(agentId)
    XCTAssertNil(pid)
    XCTAssertNil(terminalApp)
```

- [ ] **Step 4: Run Swift tests**

Run:

```bash
swift test
```

Expected: test target compiles and tests pass, aside from existing warnings about `javaScriptEnabled` and source layout. If compilation fails because `libprompt_editor_core.a` is missing, run:

```bash
cargo build --release
```

from `core/`, then copy `core/target/release/libprompt_editor_core.a` to `macos/Libraries/libprompt_editor_core.a`, and rerun `swift test`.

- [ ] **Step 5: Commit baseline repair**

Run:

```bash
git add editor/src/bridge.ts macos/Tests/PromptEditorTests.swift
git commit -m "test: repair prompt editor baseline"
```

---

## Task 1: IndexedDB History Store Without Application Cap

**Files:**
- Create: `editor/src/history-store.ts`
- Create: `editor/src/__tests__/history-store.test.ts`
- Modify: `editor/src/bridge.ts`
- Modify: `editor/src/editor.ts`

- [ ] **Step 1: Write HistoryStore tests**

Create `editor/src/__tests__/history-store.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HistoryStore, normalizeHistoryContent } from '../history-store';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: () => { store = {}; },
  };
})();

beforeEach(() => {
  localStorageMock.clear();
  vi.stubGlobal('localStorage', localStorageMock);
});

describe('normalizeHistoryContent', () => {
  it('normalizes line endings and trims outer whitespace only', () => {
    expect(normalizeHistoryContent('  a\r\n  b\r c  ')).toBe('a\n  b\n c');
  });
});

describe('HistoryStore', () => {
  it('migrates localStorage history without applying the old 100 item cap', async () => {
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
    expect(localStorage.removeItem).toHaveBeenCalledWith('promptEditor:history');
  });

  it('adds, toggles, updates, deletes, and searches history synchronously after init', async () => {
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
    expect(result.inserted).toBe(1);
    expect(result.skipped).toBe(1);
    const all = store.getHistory();
    expect(all.some(item => item.content === 'new prompt' && item.isFavorite)).toBe(true);
    expect(store.hasContent('same prompt')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the failing HistoryStore tests**

Run:

```bash
env npm_config_cache=/private/tmp/prompt-editor-prompt-memory-npm-cache npm test -- editor/src/__tests__/history-store.test.ts
```

Expected: fail because `editor/src/history-store.ts` does not exist.

- [ ] **Step 3: Implement HistoryStore**

Create `editor/src/history-store.ts` with:

```ts
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

export function normalizeHistoryContent(content: string): string {
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function generateName(content: string): string {
  const firstLine = content.split('\n')[0].trim();
  return firstLine.length > 50 ? `${firstLine.slice(0, 50)}...` : firstLine;
}

export class HistoryStore {
  private items: HistoryItem[] = [];
  private byId = new Map<string, HistoryItem>();
  private byContent = new Set<string>();
  private dbName: string;

  constructor(dbName = 'prompt-editor-history') {
    this.dbName = dbName;
  }

  async init(): Promise<void> {
    const legacy = this.readLegacyHistory();
    this.items = legacy;
    this.rebuildIndexes();
    if (legacy.length > 0 && localStorage.getItem(MIGRATION_KEY) !== 'done') {
      localStorage.setItem(MIGRATION_KEY, 'done');
      localStorage.removeItem(LEGACY_HISTORY_KEY);
    }
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
    const normalized = normalizeHistoryContent(content);
    if (!normalized) return null;
    if (this.items[0]?.content === content) return this.items[0];
    const item: HistoryItem = {
      id: generateId(),
      content,
      name: name || generateName(content),
      timestamp,
      isFavorite,
    };
    this.items = [item, ...this.items];
    this.rebuildIndexes();
    await this.persist();
    return item;
  }

  async bulkAddFavorites(inputs: FavoriteImportInput[]): Promise<{ inserted: number; skipped: number }> {
    const additions: HistoryItem[] = [];
    let skipped = 0;
    for (const input of inputs) {
      const normalized = normalizeHistoryContent(input.content);
      if (!normalized || this.byContent.has(normalized) || additions.some(item => normalizeHistoryContent(item.content) === normalized)) {
        skipped++;
        continue;
      }
      additions.push({
        id: generateId(),
        content: normalized,
        name: generateName(normalized),
        timestamp: input.timestamp || Date.now(),
        isFavorite: true,
      });
    }
    this.items = [...additions, ...this.items].sort((a, b) => b.timestamp - a.timestamp);
    this.rebuildIndexes();
    await this.persist();
    return { inserted: additions.length, skipped };
  }

  async delete(id: string): Promise<void> {
    this.items = this.items.filter(item => item.id !== id);
    this.rebuildIndexes();
    await this.persist();
  }

  async toggleFavorite(id: string): Promise<void> {
    const item = this.byId.get(id);
    if (!item) return;
    item.isFavorite = !item.isFavorite;
    await this.persist();
  }

  async updateName(id: string, name: string): Promise<void> {
    const item = this.byId.get(id);
    const trimmed = name.trim();
    if (!item || !trimmed) return;
    item.name = trimmed;
    await this.persist();
  }

  private readLegacyHistory(): HistoryItem[] {
    try {
      const raw = localStorage.getItem(LEGACY_HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private rebuildIndexes(): void {
    this.byId = new Map(this.items.map(item => [item.id, item]));
    this.byContent = new Set(this.items.map(item => normalizeHistoryContent(item.content)).filter(Boolean));
  }

  private async persist(): Promise<void> {
    localStorage.setItem(LEGACY_HISTORY_KEY, JSON.stringify(this.items));
  }
}

export const historyStore = new HistoryStore();
```

This implementation intentionally keeps persistence behind a class boundary first. After tests are green, replace the localStorage `persist()` internals with IndexedDB while keeping the public API stable.

- [ ] **Step 4: Make the tests pass**

Run:

```bash
env npm_config_cache=/private/tmp/prompt-editor-prompt-memory-npm-cache npm test -- editor/src/__tests__/history-store.test.ts
```

Expected: pass.

- [ ] **Step 5: Wire bridge history APIs to HistoryStore**

In `editor/src/bridge.ts`:

```ts
import { historyStore, HistoryItem } from './history-store';
```

Remove the local `HistoryItem` interface, `HISTORY_KEY`, `MAX_HISTORY_ITEMS`, `getHistory()`, `saveHistory()`, `generateId()`, `generateName()`, and `generateDefaultName()`.

Update methods:

```ts
  getHistory(): HistoryItem[] {
    return historyStore.getHistory();
  },

  addToHistory(content: string, name?: string) {
    void historyStore.add(content, name, false);
  },

  saveToHistory(content: string, name?: string) {
    if (!content.trim()) return;
    void historyStore.add(content, name, false).then(() => {
      bridge.setContent('');
      localStorage.removeItem('promptEditor:draft');
    });
  },

  deleteHistoryItem(id: string) {
    void historyStore.delete(id);
  },

  toggleFavorite(id: string) {
    void historyStore.toggleFavorite(id);
  },

  updateHistoryItemName(id: string, name: string) {
    void historyStore.updateName(id, name);
  },

  searchHistory(query: string): HistoryItem[] {
    return historyStore.search(query);
  },
```

In `editor/src/editor.ts`, before creating history-dependent UI behavior, initialize:

```ts
import { historyStore } from './history-store';
await historyStore.init();
```

If top-level await is not accepted by the current build config, wrap the existing initialization body in:

```ts
async function main(): Promise<void> {
  await historyStore.init();
  // existing editor initialization code
}

main().catch(error => console.error('Failed to initialize editor:', error));
```

- [ ] **Step 6: Replace localStorage persistence with IndexedDB**

Update `HistoryStore` internals:

```ts
private db: IDBDatabase | null = null;

private openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (this.db) {
      resolve(this.db);
      return;
    }
    const request = indexedDB.open(this.dbName, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('history')) {
        db.createObjectStore('history', { keyPath: 'id' });
      }
    };
    request.onsuccess = () => {
      this.db = request.result;
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
  });
}
```

Add `loadFromIndexedDb()`, `replaceAllInIndexedDb(items)`, and update `init()`:

```ts
const dbItems = await this.loadFromIndexedDb();
const legacy = this.readLegacyHistory();
const shouldMigrate = legacy.length > 0 && localStorage.getItem(MIGRATION_KEY) !== 'done';
this.items = shouldMigrate ? legacy : dbItems;
this.rebuildIndexes();
if (shouldMigrate) {
  await this.replaceAllInIndexedDb(this.items);
  localStorage.setItem(MIGRATION_KEY, 'done');
  localStorage.removeItem(LEGACY_HISTORY_KEY);
}
```

Update `persist()` to call `replaceAllInIndexedDb(this.items)` instead of `localStorage.setItem`.

- [ ] **Step 7: Run frontend tests and build**

Run:

```bash
env npm_config_cache=/private/tmp/prompt-editor-prompt-memory-npm-cache npm test
env npm_config_cache=/private/tmp/prompt-editor-prompt-memory-npm-cache npm run build
```

Expected: frontend tests and build pass.

- [ ] **Step 8: Commit HistoryStore**

Run:

```bash
git add editor/src/history-store.ts editor/src/__tests__/history-store.test.ts editor/src/bridge.ts editor/src/editor.ts
git commit -m "feat: add uncapped history store"
```

---

## Task 2: Swift Prompt Memory Models and Filters

**Files:**
- Create: `macos/PromptEditor/PromptMemoryModels.swift`
- Create: `macos/PromptEditor/PromptMemoryParser.swift`
- Modify: `macos/Package.swift`
- Modify: `macos/Tests/PromptEditorTests.swift`

- [ ] **Step 1: Add failing Swift tests for normalization, filtering, and dedupe**

Append to `macos/Tests/PromptEditorTests.swift`:

```swift
final class PromptMemoryCoreTests: XCTestCase {
    func testNormalizePromptMemoryContent() {
        XCTAssertEqual(PromptMemoryNormalizer.normalize("  a\r\n  b\r c  "), "a\n  b\n c")
        XCTAssertNil(PromptMemoryNormalizer.normalize(" \n\t "))
    }

    func testKnownControlCommandFiltering() {
        XCTAssertTrue(PromptMemoryFilters.isControlCommand("/help", knownCommands: ["/help"]))
        XCTAssertTrue(PromptMemoryFilters.isControlCommand("/help search", knownCommands: ["/help"]))
        XCTAssertFalse(PromptMemoryFilters.isControlCommand("/Users/me/project", knownCommands: ["/help"]))
        XCTAssertFalse(PromptMemoryFilters.isControlCommand("!ls -la", knownCommands: ["/help"]))
    }

    func testDeduplicatePromptMemoryItemsKeepsLatestAndMergesSources() {
        let old = PromptMemoryItem(
            id: "old",
            content: "build this",
            timestamp: Date(timeIntervalSince1970: 10),
            agents: [.codex],
            sourceDirectories: ["/tmp/codex"],
            projectDirectory: "/tmp/a"
        )
        let latest = PromptMemoryItem(
            id: "new",
            content: " build this ",
            timestamp: Date(timeIntervalSince1970: 20),
            agents: [.claudeCode],
            sourceDirectories: ["/tmp/claude"],
            projectDirectory: "/tmp/b"
        )
        let result = PromptMemoryDeduper.deduplicate([old, latest])
        XCTAssertEqual(result.count, 1)
        XCTAssertEqual(result[0].content, "build this")
        XCTAssertEqual(result[0].timestamp, Date(timeIntervalSince1970: 20))
        XCTAssertEqual(Set(result[0].agents), Set([.codex, .claudeCode]))
        XCTAssertEqual(Set(result[0].sourceDirectories), Set(["/tmp/codex", "/tmp/claude"]))
        XCTAssertEqual(result[0].projectDirectory, "/tmp/b")
    }
}
```

- [ ] **Step 2: Run failing Swift tests**

Run:

```bash
swift test --filter PromptMemoryCoreTests
```

Expected: fail because prompt memory types do not exist.

- [ ] **Step 3: Create models**

Create `macos/PromptEditor/PromptMemoryModels.swift`:

```swift
import Foundation

public enum PromptMemoryAgent: String, Codable, CaseIterable {
    case claudeCode
    case codex
    case openCode
    case pi
    case kimi

    public var displayName: String {
        switch self {
        case .claudeCode: return "Claude Code"
        case .codex: return "Codex"
        case .openCode: return "OpenCode"
        case .pi: return "Pi"
        case .kimi: return "Kimi"
        }
    }
}

public struct PromptMemoryDirectory: Codable, Identifiable, Equatable {
    public let id: String
    public let agent: PromptMemoryAgent
    public let path: String
    public let isDetected: Bool
    public let exists: Bool
    public let modifiedAt: Date?
}

public struct PromptMemoryItem: Codable, Identifiable, Equatable {
    public let id: String
    public let content: String
    public let timestamp: Date?
    public let agents: [PromptMemoryAgent]
    public let sourceDirectories: [String]
    public let projectDirectory: String?
}

public enum PromptMemoryScanStatus: String, Codable {
    case waiting
    case scanning
    case completed
    case skipped
    case failed
    case cancelled
}

public struct PromptMemoryProgress: Codable, Equatable {
    public let scanId: String
    public let directoryId: String
    public let status: PromptMemoryScanStatus
    public let filesRead: Int
    public let extracted: Int
    public let skipped: Int
    public let error: String?
}

public struct PromptMemoryScanRequest: Codable, Equatable {
    public let scanId: String
    public let directories: [PromptMemoryDirectory]
}
```

- [ ] **Step 4: Create parser helpers**

Create `macos/PromptEditor/PromptMemoryParser.swift`:

```swift
import Foundation
import CryptoKit

public protocol PromptMemoryParser {
    var agent: PromptMemoryAgent { get }
    func parse(directory: PromptMemoryDirectory) async -> [PromptMemoryItem]
}

public enum PromptMemoryNormalizer {
    public static func normalize(_ content: String) -> String? {
        let normalized = content
            .replacingOccurrences(of: "\r\n", with: "\n")
            .replacingOccurrences(of: "\r", with: "\n")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return normalized.isEmpty ? nil : normalized
    }

    public static func stableId(for content: String) -> String {
        let digest = SHA256.hash(data: Data(content.utf8))
        return digest.map { String(format: "%02x", $0) }.joined()
    }
}

public enum PromptMemoryFilters {
    public static func isControlCommand(_ content: String, knownCommands: Set<String>) -> Bool {
        guard let normalized = PromptMemoryNormalizer.normalize(content) else { return true }
        if normalized.hasPrefix("!") { return false }
        for command in knownCommands {
            if normalized == command || normalized.hasPrefix(command + " ") {
                return true
            }
        }
        return false
    }
}

public enum PromptMemoryDeduper {
    public static func deduplicate(_ items: [PromptMemoryItem]) -> [PromptMemoryItem] {
        var grouped: [String: [PromptMemoryItem]] = [:]
        for item in items {
            guard let normalized = PromptMemoryNormalizer.normalize(item.content) else { continue }
            grouped[normalized, default: []].append(item)
        }
        return grouped.map { content, group in
            let latest = group.max { ($0.timestamp ?? .distantPast) < ($1.timestamp ?? .distantPast) }!
            let agents = Array(Set(group.flatMap(\.agents))).sorted { $0.rawValue < $1.rawValue }
            let directories = Array(Set(group.flatMap(\.sourceDirectories))).sorted()
            return PromptMemoryItem(
                id: PromptMemoryNormalizer.stableId(for: content),
                content: content,
                timestamp: latest.timestamp,
                agents: agents,
                sourceDirectories: directories,
                projectDirectory: latest.projectDirectory
            )
        }
        .sorted {
            switch ($0.timestamp, $1.timestamp) {
            case let (lhs?, rhs?): return lhs > rhs
            case (_?, nil): return true
            case (nil, _?): return false
            case (nil, nil): return $0.id < $1.id
            }
        }
    }
}
```

- [ ] **Step 5: Add new files to Package.swift**

In `macos/Package.swift`, add `PromptMemoryModels.swift` and `PromptMemoryParser.swift` to the `PromptEditorLib` `sources` list.

- [ ] **Step 6: Run Swift tests**

Run:

```bash
swift test --filter PromptMemoryCoreTests
swift test
```

Expected: pass.

- [ ] **Step 7: Commit models and filters**

Run:

```bash
git add macos/Package.swift macos/PromptEditor/PromptMemoryModels.swift macos/PromptEditor/PromptMemoryParser.swift macos/Tests/PromptEditorTests.swift
git commit -m "feat: add prompt memory models"
```

---

## Task 3: Swift JSONL Parsers

**Files:**
- Create: `macos/Tests/PromptMemoryFixtures.swift`
- Create: `macos/PromptEditor/PromptMemoryParsers/ClaudeCodeParser.swift`
- Create: `macos/PromptEditor/PromptMemoryParsers/CodexParser.swift`
- Create: `macos/PromptEditor/PromptMemoryParsers/PiParser.swift`
- Create: `macos/PromptEditor/PromptMemoryParsers/KimiParser.swift`
- Modify: `macos/Package.swift`
- Modify: `macos/Tests/PromptEditorTests.swift`

- [ ] **Step 1: Add fixture helper**

Create `macos/Tests/PromptMemoryFixtures.swift`:

```swift
import Foundation
import XCTest
@testable import PromptEditorLib

enum PromptMemoryFixtures {
    static func tempDirectory(_ testCase: XCTestCase) throws -> URL {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("PromptMemoryTests")
            .appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        testCase.addTeardownBlock {
            try? FileManager.default.removeItem(at: url)
        }
        return url
    }

    static func write(_ text: String, to url: URL) throws {
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try text.write(to: url, atomically: true, encoding: .utf8)
    }
}
```

- [ ] **Step 2: Add failing parser tests**

Append to `macos/Tests/PromptEditorTests.swift`:

```swift
final class PromptMemoryJSONLParserTests: XCTestCase {
    func testCodexHistoryParserReadsUserTextAndFiltersInjectedContext() async throws {
        let root = try PromptMemoryFixtures.tempDirectory(self)
        try PromptMemoryFixtures.write("""
        {"session_id":"s1","ts":"2026-07-29T01:02:03Z","text":"build a parser"}
        {"session_id":"s2","ts":"2026-07-29T01:02:04Z","text":"<environment_context>auto</environment_context>"}
        {"session_id":"s3","ts":"2026-07-29T01:02:05Z","text":"/help"}
        """, to: root.appendingPathComponent("history.jsonl"))
        let directory = PromptMemoryDirectory(id: "d", agent: .codex, path: root.path, isDetected: true, exists: true, modifiedAt: nil)
        let items = await CodexParser().parse(directory: directory)
        XCTAssertEqual(items.map(\.content), ["build a parser"])
        XCTAssertEqual(items[0].timestamp, ISO8601DateFormatter().date(from: "2026-07-29T01:02:03Z"))
    }

    func testClaudeParserReadsUserMessageBlocksOnly() async throws {
        let root = try PromptMemoryFixtures.tempDirectory(self)
        try PromptMemoryFixtures.write("""
        {"type":"user","cwd":"/tmp/project","timestamp":"2026-07-29T02:00:00Z","message":{"role":"user","content":[{"type":"text","text":"fix the tests"}]}}
        {"type":"assistant","message":{"role":"assistant","content":"not a prompt"}}
        """, to: root.appendingPathComponent("projects/a/session.jsonl"))
        let directory = PromptMemoryDirectory(id: "d", agent: .claudeCode, path: root.path, isDetected: true, exists: true, modifiedAt: nil)
        let items = await ClaudeCodeParser().parse(directory: directory)
        XCTAssertEqual(items.count, 1)
        XCTAssertEqual(items[0].content, "fix the tests")
        XCTAssertEqual(items[0].projectDirectory, "/tmp/project")
    }

    func testPiParserReadsUserMessageText() async throws {
        let root = try PromptMemoryFixtures.tempDirectory(self)
        try PromptMemoryFixtures.write("""
        {"cwd":"/tmp/pi","message":{"role":"user","content":"ship it"},"timestamp":"2026-07-29T03:00:00Z"}
        {"message":{"role":"assistant","content":"done"}}
        """, to: root.appendingPathComponent("sessions/one.jsonl"))
        let directory = PromptMemoryDirectory(id: "d", agent: .pi, path: root.path, isDetected: true, exists: true, modifiedAt: nil)
        let items = await PiParser().parse(directory: directory)
        XCTAssertEqual(items.map(\.content), ["ship it"])
    }

    func testKimiParserReadsUserHistoryContent() async throws {
        let root = try PromptMemoryFixtures.tempDirectory(self)
        try PromptMemoryFixtures.write("""
        {"content":"review this diff","createdAt":"2026-07-29T04:00:00Z"}
        {"content":"/clear","createdAt":"2026-07-29T04:01:00Z"}
        """, to: root.appendingPathComponent("user-history/history.jsonl"))
        let directory = PromptMemoryDirectory(id: "d", agent: .kimi, path: root.path, isDetected: true, exists: true, modifiedAt: nil)
        let items = await KimiParser().parse(directory: directory)
        XCTAssertEqual(items.map(\.content), ["review this diff"])
    }
}
```

- [ ] **Step 3: Run failing parser tests**

Run:

```bash
swift test --filter PromptMemoryJSONLParserTests
```

Expected: fail because parser classes do not exist.

- [ ] **Step 4: Add shared JSONL helpers**

Extend `PromptMemoryParser.swift`:

```swift
public enum PromptMemoryJSON {
    public static func objects(in file: URL) -> [[String: Any]] {
        guard let handle = try? FileHandle(forReadingFrom: file) else { return [] }
        defer { try? handle.close() }
        guard let data = try? handle.readToEnd(), let text = String(data: data, encoding: .utf8) else { return [] }
        return text.split(separator: "\n").compactMap { line in
            guard let data = String(line).data(using: .utf8),
                  let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            else { return nil }
            return object
        }
    }

    public static func recursiveFiles(root: URL, matching predicate: (URL) -> Bool) -> [URL] {
        guard let enumerator = FileManager.default.enumerator(
            at: root,
            includingPropertiesForKeys: [.isRegularFileKey],
            options: [.skipsHiddenFiles, .skipsPackageDescendants]
        ) else { return [] }
        return enumerator.compactMap { item in
            guard let url = item as? URL else { return nil }
            return predicate(url) ? url : nil
        }
    }

    public static func parseDate(_ raw: Any?) -> Date? {
        if let text = raw as? String {
            return ISO8601DateFormatter().date(from: text)
        }
        if let seconds = raw as? TimeInterval {
            return Date(timeIntervalSince1970: seconds)
        }
        return nil
    }
}
```

- [ ] **Step 5: Implement JSONL parsers**

Create each parser file with a focused class implementing `PromptMemoryParser`.

`CodexParser` must read `history.jsonl`, accept `text`, filter `/help`, `/clear`, `/compact`, `/exit`, and filter whole records beginning with `<environment_context>`.

`ClaudeCodeParser` must recursively read `.jsonl` under `projects`, accept `message.role == "user"` or `type == "user"`, extract string content and text block arrays, and preserve `cwd`.

`PiParser` must recursively read `.jsonl` under `sessions`, accept `message.role == "user"`, extract string content and text block arrays, and preserve `cwd`.

`KimiParser` must read `user-history/*.jsonl`, accept `content`, filter `/help`, `/clear`, `/exit`, and use file modification date if record time is missing.

For each accepted content:

```swift
guard let normalized = PromptMemoryNormalizer.normalize(raw),
      !PromptMemoryFilters.isControlCommand(normalized, knownCommands: knownCommands)
else { continue }
let item = PromptMemoryItem(
    id: PromptMemoryNormalizer.stableId(for: normalized),
    content: normalized,
    timestamp: PromptMemoryJSON.parseDate(record["ts"] ?? record["timestamp"] ?? record["createdAt"]),
    agents: [agent],
    sourceDirectories: [directory.path],
    projectDirectory: record["cwd"] as? String
)
```

- [ ] **Step 6: Add parser files to Package.swift**

Add all parser files to the `PromptEditorLib` `sources` list.

- [ ] **Step 7: Run parser tests**

Run:

```bash
swift test --filter PromptMemoryJSONLParserTests
swift test
```

Expected: pass.

- [ ] **Step 8: Commit JSONL parsers**

Run:

```bash
git add macos/Package.swift macos/PromptEditor/PromptMemoryParser.swift macos/PromptEditor/PromptMemoryParsers macos/Tests/PromptEditorTests.swift macos/Tests/PromptMemoryFixtures.swift
git commit -m "feat: parse prompt memory jsonl"
```

---

## Task 4: OpenCode SQLite Fallback and Scanner

**Files:**
- Create: `macos/PromptEditor/PromptMemoryParsers/OpenCodeParser.swift`
- Create: `macos/PromptEditor/PromptMemoryScanner.swift`
- Create: `macos/Libraries/SQLite3/module.modulemap`
- Modify: `macos/Package.swift`
- Modify: `macos/Tests/PromptEditorTests.swift`
- Modify: `macos/Tests/PromptMemoryFixtures.swift`

- [ ] **Step 1: Add failing tests for OpenCode and directory detection**

Append to `macos/Tests/PromptEditorTests.swift`:

```swift
final class PromptMemoryScannerTests: XCTestCase {
    func testOpenCodePromptHistoryParserReadsInput() async throws {
        let root = try PromptMemoryFixtures.tempDirectory(self)
        try PromptMemoryFixtures.write("""
        {"input":"explain this error","time_created":1780000000}
        {"input":"/help","time_created":1780000001}
        """, to: root.appendingPathComponent("prompt-history.jsonl"))
        let directory = PromptMemoryDirectory(id: "d", agent: .openCode, path: root.path, isDetected: true, exists: true, modifiedAt: nil)
        let items = await OpenCodeParser().parse(directory: directory)
        XCTAssertEqual(items.map(\.content), ["explain this error"])
    }

    func testScannerDeduplicatesAcrossParsers() async throws {
        let root = try PromptMemoryFixtures.tempDirectory(self)
        let codex = root.appendingPathComponent("codex")
        let kimi = root.appendingPathComponent("kimi")
        try PromptMemoryFixtures.write("{\"text\":\"same prompt\",\"ts\":\"2026-07-29T01:00:00Z\"}\n", to: codex.appendingPathComponent("history.jsonl"))
        try PromptMemoryFixtures.write("{\"content\":\"same prompt\",\"createdAt\":\"2026-07-29T02:00:00Z\"}\n", to: kimi.appendingPathComponent("user-history/history.jsonl"))
        let scanner = PromptMemoryScanner(homeDirectory: root)
        let items = await scanner.scanForTests(directories: [
            PromptMemoryDirectory(id: "c", agent: .codex, path: codex.path, isDetected: true, exists: true, modifiedAt: nil),
            PromptMemoryDirectory(id: "k", agent: .kimi, path: kimi.path, isDetected: true, exists: true, modifiedAt: nil),
        ])
        XCTAssertEqual(items.count, 1)
        XCTAssertEqual(Set(items[0].agents), Set([.codex, .kimi]))
        XCTAssertEqual(items[0].timestamp, ISO8601DateFormatter().date(from: "2026-07-29T02:00:00Z"))
    }

    func testDetectedDirectoriesUseKnownAgentPaths() {
        let root = URL(fileURLWithPath: "/Users/tester")
        let scanner = PromptMemoryScanner(homeDirectory: root)
        let directories = scanner.detectDefaultDirectories()
        XCTAssertTrue(directories.contains { $0.agent == .claudeCode && $0.path == "/Users/tester/.claude" })
        XCTAssertTrue(directories.contains { $0.agent == .codex && $0.path == "/Users/tester/.codex" })
        XCTAssertTrue(directories.contains { $0.agent == .openCode && $0.path == "/Users/tester/.local/state/opencode" })
        XCTAssertTrue(directories.contains { $0.agent == .pi && $0.path == "/Users/tester/.pi/agent" })
        XCTAssertTrue(directories.contains { $0.agent == .kimi && $0.path == "/Users/tester/.kimi" })
    }
}
```

- [ ] **Step 2: Run failing scanner tests**

Run:

```bash
swift test --filter PromptMemoryScannerTests
```

Expected: fail because `OpenCodeParser` and `PromptMemoryScanner` do not exist.

- [ ] **Step 3: Add SQLite module target**

Create `macos/Libraries/SQLite3/module.modulemap`:

```c
module SQLite3 [system] {
  header "/usr/include/sqlite3.h"
  link "sqlite3"
  export *
}
```

If the SDK path rejects `/usr/include/sqlite3.h`, use:

```c
module SQLite3 [system] {
  header "/Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX.sdk/usr/include/sqlite3.h"
  link "sqlite3"
  export *
}
```

Modify `macos/Package.swift`:

```swift
.systemLibrary(
    name: "SQLite3",
    path: "Libraries/SQLite3",
    pkgConfig: nil
),
```

and add `"SQLite3"` to `PromptEditorLib` dependencies.

- [ ] **Step 4: Implement OpenCodeParser**

Create `macos/PromptEditor/PromptMemoryParsers/OpenCodeParser.swift`:

```swift
import Foundation
import SQLite3

public final class OpenCodeParser: PromptMemoryParser {
    public let agent: PromptMemoryAgent = .openCode
    private let commands: Set<String> = ["/help", "/clear", "/compact", "/exit"]

    public init() {}

    public func parse(directory: PromptMemoryDirectory) async -> [PromptMemoryItem] {
        let root = URL(fileURLWithPath: directory.path)
        let jsonl = root.appendingPathComponent("prompt-history.jsonl")
        if FileManager.default.fileExists(atPath: jsonl.path) {
            return parsePromptHistory(file: jsonl, directory: directory)
        }
        return parseDatabase(root: root, directory: directory)
    }

    private func parsePromptHistory(file: URL, directory: PromptMemoryDirectory) -> [PromptMemoryItem] {
        PromptMemoryJSON.objects(in: file).compactMap { record in
            guard let raw = record["input"] as? String,
                  let content = PromptMemoryNormalizer.normalize(raw),
                  !PromptMemoryFilters.isControlCommand(content, knownCommands: commands)
            else { return nil }
            return PromptMemoryItem(
                id: PromptMemoryNormalizer.stableId(for: content),
                content: content,
                timestamp: PromptMemoryJSON.parseDate(record["time_created"] ?? record["createdAt"]),
                agents: [agent],
                sourceDirectories: [directory.path],
                projectDirectory: record["directory"] as? String
            )
        }
    }

    private func parseDatabase(root: URL, directory: PromptMemoryDirectory) -> [PromptMemoryItem] {
        let dbURL = root.appendingPathComponent("opencode.db")
        guard FileManager.default.fileExists(atPath: dbURL.path) else { return [] }
        var db: OpaquePointer?
        guard sqlite3_open_v2(dbURL.path, &db, SQLITE_OPEN_READONLY, nil) == SQLITE_OK else { return [] }
        defer { sqlite3_close(db) }
        let query = "SELECT prompt, time_created FROM session_input ORDER BY time_created DESC LIMIT 100000"
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, query, -1, &statement, nil) == SQLITE_OK else { return [] }
        defer { sqlite3_finalize(statement) }
        var items: [PromptMemoryItem] = []
        while sqlite3_step(statement) == SQLITE_ROW {
            guard let cString = sqlite3_column_text(statement, 0),
                  let content = PromptMemoryNormalizer.normalize(String(cString: cString)),
                  !PromptMemoryFilters.isControlCommand(content, knownCommands: commands)
            else { continue }
            let seconds = sqlite3_column_double(statement, 1)
            items.append(PromptMemoryItem(
                id: PromptMemoryNormalizer.stableId(for: content),
                content: content,
                timestamp: seconds > 0 ? Date(timeIntervalSince1970: seconds) : nil,
                agents: [agent],
                sourceDirectories: [directory.path],
                projectDirectory: nil
            ))
        }
        return items
    }
}
```

- [ ] **Step 5: Implement PromptMemoryScanner**

Create `macos/PromptEditor/PromptMemoryScanner.swift`:

```swift
import Foundation

public final class PromptMemoryScanner {
    private let homeDirectory: URL
    private let parsers: [PromptMemoryAgent: PromptMemoryParser]

    public init(homeDirectory: URL = FileManager.default.homeDirectoryForCurrentUser) {
        self.homeDirectory = homeDirectory
        self.parsers = [
            .claudeCode: ClaudeCodeParser(),
            .codex: CodexParser(),
            .openCode: OpenCodeParser(),
            .pi: PiParser(),
            .kimi: KimiParser(),
        ]
    }

    public func detectDefaultDirectories() -> [PromptMemoryDirectory] {
        [
            (.claudeCode, ".claude"),
            (.codex, ".codex"),
            (.openCode, ".local/state/opencode"),
            (.openCode, ".local/share/opencode"),
            (.pi, ".pi/agent"),
            (.kimi, ".kimi"),
        ].map { agent, relative in
            let url = homeDirectory.appendingPathComponent(relative)
            let values = try? url.resourceValues(forKeys: [.contentModificationDateKey])
            return PromptMemoryDirectory(
                id: "\(agent.rawValue):\(url.path)",
                agent: agent,
                path: url.path,
                isDetected: true,
                exists: FileManager.default.fileExists(atPath: url.path),
                modifiedAt: values?.contentModificationDate
            )
        }
    }

    public func scanForTests(directories: [PromptMemoryDirectory]) async -> [PromptMemoryItem] {
        var all: [PromptMemoryItem] = []
        for directory in directories where directory.exists {
            guard let parser = parsers[directory.agent] else { continue }
            all.append(contentsOf: await parser.parse(directory: directory))
        }
        return PromptMemoryDeduper.deduplicate(all)
    }
}
```

- [ ] **Step 6: Add files to Package.swift and run tests**

Add `OpenCodeParser.swift` and `PromptMemoryScanner.swift` to `PromptEditorLib` `sources`.

Run:

```bash
swift test --filter PromptMemoryScannerTests
swift test
```

Expected: pass.

- [ ] **Step 7: Commit scanner**

Run:

```bash
git add macos/Package.swift macos/Libraries/SQLite3/module.modulemap macos/PromptEditor/PromptMemoryParsers/OpenCodeParser.swift macos/PromptEditor/PromptMemoryScanner.swift macos/Tests/PromptEditorTests.swift
git commit -m "feat: scan prompt memory sources"
```

---

## Task 5: Native Bridge for Prompt Memory Scanning

**Files:**
- Modify: `macos/PromptEditor/Helpers.swift`
- Modify: `macos/PromptEditor/MainWindow.swift`
- Modify: `macos/PromptEditor/PromptMemoryModels.swift`
- Modify: `macos/PromptEditor/PromptMemoryScanner.swift`
- Modify: `macos/Tests/PromptEditorTests.swift`

- [ ] **Step 1: Add failing bridge action tests**

Append to the existing `HelpersTests` section in `macos/Tests/PromptEditorTests.swift`:

```swift
func testParseBridgeMessage_detectPromptMemoryDirectories() {
    let body: [String: Any] = ["action": "detectPromptMemoryDirectories", "callback": "cb"]
    let action = Helpers.parseBridgeMessage(body)
    XCTAssertEqual(action, .detectPromptMemoryDirectories(callback: "cb"))
}

func testParseBridgeMessage_choosePromptMemoryDirectory() {
    let body: [String: Any] = ["action": "choosePromptMemoryDirectory", "callback": "cb"]
    let action = Helpers.parseBridgeMessage(body)
    XCTAssertEqual(action, .choosePromptMemoryDirectory(callback: "cb"))
}

func testParseBridgeMessage_startPromptMemoryScan() {
    let body: [String: Any] = [
        "action": "startPromptMemoryScan",
        "scanId": "scan-1",
        "directories": [["id": "d", "agent": "codex", "path": "/tmp/codex", "isDetected": true, "exists": true]]
    ]
    let action = Helpers.parseBridgeMessage(body)
    if case .startPromptMemoryScan(let scanId, let directories) = action {
        XCTAssertEqual(scanId, "scan-1")
        XCTAssertEqual(directories.count, 1)
        XCTAssertEqual(directories[0].agent, .codex)
    } else {
        XCTFail("Expected startPromptMemoryScan")
    }
}

func testParseBridgeMessage_cancelPromptMemoryScan() {
    let body: [String: Any] = ["action": "cancelPromptMemoryScan", "scanId": "scan-1"]
    let action = Helpers.parseBridgeMessage(body)
    XCTAssertEqual(action, .cancelPromptMemoryScan(scanId: "scan-1"))
}
```

- [ ] **Step 2: Run failing bridge tests**

Run:

```bash
swift test --filter HelpersTests
```

Expected: fail because actions do not exist.

- [ ] **Step 3: Add bridge actions and parsing**

In `Helpers.BridgeAction`, add:

```swift
case detectPromptMemoryDirectories(callback: String)
case choosePromptMemoryDirectory(callback: String)
case startPromptMemoryScan(scanId: String, directories: [PromptMemoryDirectory])
case cancelPromptMemoryScan(scanId: String)
```

In `parseBridgeMessage`, add:

```swift
case "detectPromptMemoryDirectories":
    return .detectPromptMemoryDirectories(callback: dict["callback"] as? String ?? "")
case "choosePromptMemoryDirectory":
    return .choosePromptMemoryDirectory(callback: dict["callback"] as? String ?? "")
case "startPromptMemoryScan":
    guard let scanId = dict["scanId"] as? String,
          let directoryObjects = dict["directories"] as? [[String: Any]]
    else { return nil }
    let data = try? JSONSerialization.data(withJSONObject: directoryObjects)
    let directories = data.flatMap { try? JSONDecoder.promptMemory.decode([PromptMemoryDirectory].self, from: $0) } ?? []
    return .startPromptMemoryScan(scanId: scanId, directories: directories)
case "cancelPromptMemoryScan":
    guard let scanId = dict["scanId"] as? String else { return nil }
    return .cancelPromptMemoryScan(scanId: scanId)
```

Add in `PromptMemoryModels.swift`:

```swift
extension JSONEncoder {
    static var promptMemory: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }
}

extension JSONDecoder {
    static var promptMemory: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }
}
```

- [ ] **Step 4: Add cancellable scanner API**

Extend `PromptMemoryScanner` with:

```swift
private var runningTasks: [String: Task<Void, Never>] = [:]

public func start(
    scanId: String,
    directories: [PromptMemoryDirectory],
    progress: @escaping (PromptMemoryProgress) -> Void,
    batch: @escaping ([PromptMemoryItem]) -> Void,
    completed: @escaping ([PromptMemoryItem]) -> Void,
    failed: @escaping (String) -> Void
) {
    cancel(scanId: scanId)
    runningTasks[scanId] = Task(priority: .utility) {
        var all: [PromptMemoryItem] = []
        for directory in directories where directory.exists {
            if Task.isCancelled { break }
            progress(PromptMemoryProgress(scanId: scanId, directoryId: directory.id, status: .scanning, filesRead: 0, extracted: 0, skipped: 0, error: nil))
            guard let parser = parsers[directory.agent] else { continue }
            let items = await parser.parse(directory: directory)
            all.append(contentsOf: items)
            let dedupedBatch = PromptMemoryDeduper.deduplicate(items)
            batch(dedupedBatch)
            progress(PromptMemoryProgress(scanId: scanId, directoryId: directory.id, status: .completed, filesRead: 0, extracted: dedupedBatch.count, skipped: 0, error: nil))
        }
        if Task.isCancelled {
            return
        }
        completed(PromptMemoryDeduper.deduplicate(all))
    }
}

public func cancel(scanId: String) {
    runningTasks[scanId]?.cancel()
    runningTasks[scanId] = nil
}
```

- [ ] **Step 5: Handle native actions in MainWindow**

Add property:

```swift
private let promptMemoryScanner = PromptMemoryScanner()
```

Add switch cases:

```swift
case .detectPromptMemoryDirectories(let callback):
    handleDetectPromptMemoryDirectories(callback: callback)
case .choosePromptMemoryDirectory(let callback):
    handleChoosePromptMemoryDirectory(callback: callback)
case .startPromptMemoryScan(let scanId, let directories):
    handleStartPromptMemoryScan(scanId: scanId, directories: directories)
case .cancelPromptMemoryScan(let scanId):
    promptMemoryScanner.cancel(scanId: scanId)
```

Add helper to safely send JSON:

```swift
private func callJSFunction(_ name: String, argument: Encodable) {
    guard let data = try? JSONEncoder.promptMemory.encode(AnyEncodable(argument)),
          let object = try? JSONSerialization.jsonObject(with: data),
          let jsData = try? JSONSerialization.data(withJSONObject: [object]),
          let jsArgs = String(data: jsData, encoding: .utf8)
    else { return }
    callJS("window['\(name)']?.apply(window, \(jsArgs))")
}
```

If `AnyEncodable` is not already present, add it to `PromptMemoryModels.swift`.

Implement handlers:

```swift
private func handleDetectPromptMemoryDirectories(callback: String) {
    callJSFunction(callback, argument: promptMemoryScanner.detectDefaultDirectories())
}

private func handleChoosePromptMemoryDirectory(callback: String) {
    let panel = NSOpenPanel()
    panel.canChooseFiles = false
    panel.canChooseDirectories = true
    panel.allowsMultipleSelection = false
    panel.message = "Select a prompt memory directory"
    panel.beginSheetModal(for: window) { [weak self] result in
        if result == .OK, let url = panel.url {
            self?.callJSFunction(callback, argument: url.path)
        } else {
            self?.callJSFunction(callback, argument: Optional<String>.none)
        }
    }
}

private func handleStartPromptMemoryScan(scanId: String, directories: [PromptMemoryDirectory]) {
    promptMemoryScanner.start(
        scanId: scanId,
        directories: directories,
        progress: { [weak self] progress in
            Task { @MainActor in self?.callJSFunction("onPromptMemoryScanProgress", argument: progress) }
        },
        batch: { [weak self] items in
            Task { @MainActor in self?.callJSFunction("onPromptMemoryScanBatch", argument: ["scanId": scanId, "items": items]) }
        },
        completed: { [weak self] items in
            Task { @MainActor in self?.callJSFunction("onPromptMemoryScanCompleted", argument: ["scanId": scanId, "items": items]) }
        },
        failed: { [weak self] message in
            Task { @MainActor in self?.callJSFunction("onPromptMemoryScanFailed", argument: ["scanId": scanId, "error": message]) }
        }
    )
}
```

- [ ] **Step 6: Run Swift tests**

Run:

```bash
swift test --filter HelpersTests
swift test
```

Expected: pass.

- [ ] **Step 7: Commit native bridge**

Run:

```bash
git add macos/PromptEditor/Helpers.swift macos/PromptEditor/MainWindow.swift macos/PromptEditor/PromptMemoryModels.swift macos/PromptEditor/PromptMemoryScanner.swift macos/Tests/PromptEditorTests.swift
git commit -m "feat: bridge prompt memory scanner"
```

---

## Task 6: Frontend Prompt Memory Controller

**Files:**
- Create: `editor/src/prompt-memory.ts`
- Create: `editor/src/__tests__/prompt-memory.test.ts`
- Modify: `editor/src/bridge.ts`

- [ ] **Step 1: Write controller tests**

Create `editor/src/__tests__/prompt-memory.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PromptMemoryController } from '../prompt-memory';

beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
  vi.stubGlobal('webkit', {
    messageHandlers: {
      promptEditor: { postMessage: vi.fn() },
    },
  });
});

describe('PromptMemoryController', () => {
  it('detects directories through native bridge and marks detected existing dirs selected', async () => {
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
    (window as any).onPromptMemoryScanBatch({ scanId: oldScanId, items: [{ id: 'old', content: 'old', agents: ['codex'], sourceDirectories: [] }] });
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
});
```

- [ ] **Step 2: Run failing controller tests**

Run:

```bash
env npm_config_cache=/private/tmp/prompt-editor-prompt-memory-npm-cache npm test -- editor/src/__tests__/prompt-memory.test.ts
```

Expected: fail because `prompt-memory.ts` does not exist.

- [ ] **Step 3: Implement prompt-memory.ts**

Create `editor/src/prompt-memory.ts` with exported models and a `PromptMemoryController` class that:

- Creates callback names for detect and choose directory.
- Posts native actions through `window.webkit.messageHandlers.promptEditor.postMessage`.
- Provides browser fallback returning empty detected directories and `null` custom directory.
- Stores custom directories in `localStorage` key `promptEditor:promptMemory:customDirectories`.
- Generates `scanId` as `scan-${Date.now()}-${Math.random().toString(36).slice(2)}`.
- Installs global callbacks `onPromptMemoryScanProgress`, `onPromptMemoryScanBatch`, `onPromptMemoryScanCompleted`, and `onPromptMemoryScanFailed`.
- Ignores any callback with a non-current `scanId`.
- Marks `existsInHistory` via `historyStore.hasContent(content)`.
- Exposes `saveSelectedToFavorites()` that calls `historyStore.bulkAddFavorites(selectedItems)`.

Use these TypeScript shapes:

```ts
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
```

- [ ] **Step 4: Add bridge wrapper methods**

In `editor/src/bridge.ts`, extend `NativeBridge` with:

```ts
showPromptMemoryScanner: () => void;
```

The modal itself will be initialized in Task 7, so this method can dispatch a browser event:

```ts
  showPromptMemoryScanner() {
    window.dispatchEvent(new CustomEvent('prompt-memory:open'));
  },
```

- [ ] **Step 5: Run frontend tests**

Run:

```bash
env npm_config_cache=/private/tmp/prompt-editor-prompt-memory-npm-cache npm test -- editor/src/__tests__/prompt-memory.test.ts editor/src/__tests__/bridge.test.ts
```

Expected: pass.

- [ ] **Step 6: Commit controller**

Run:

```bash
git add editor/src/prompt-memory.ts editor/src/__tests__/prompt-memory.test.ts editor/src/bridge.ts
git commit -m "feat: add prompt memory frontend controller"
```

---

## Task 7: Prompt Memory Modal UI

**Files:**
- Create: `editor/src/prompt-memory-ui.ts`
- Create: `editor/src/__tests__/prompt-memory-ui.test.ts`
- Modify: `editor/src/editor.ts`
- Modify: `editor/index.html`

- [ ] **Step 1: Write modal UI tests**

Create `editor/src/__tests__/prompt-memory-ui.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initPromptMemoryUI } from '../prompt-memory-ui';

beforeEach(() => {
  document.body.innerHTML = '<button id="btn-prompt-memory"></button><div id="prompt-memory-root"></div>';
});

describe('prompt memory UI', () => {
  it('opens the modal when the toolbar button is clicked', () => {
    initPromptMemoryUI({
      detectDirectories: vi.fn(async () => []),
    } as any);
    document.getElementById('btn-prompt-memory')!.click();
    expect(document.querySelector('.prompt-memory-modal')).not.toBeNull();
  });

  it('renders detected directories as checked when selected', async () => {
    initPromptMemoryUI({
      detectDirectories: vi.fn(async () => [
        { id: 'd', agent: 'codex', path: '/tmp/codex', isDetected: true, exists: true, selected: true },
      ]),
    } as any);
    document.getElementById('btn-prompt-memory')!.click();
    await Promise.resolve();
    const checkbox = document.querySelector<HTMLInputElement>('.prompt-memory-directory input[type="checkbox"]')!;
    expect(checkbox.checked).toBe(true);
  });

  it('saves selected result entries to favorites', async () => {
    const controller = {
      detectDirectories: vi.fn(async () => []),
      startScan: vi.fn(),
      items: [{ id: 'i', content: 'new prompt', agents: ['codex'], sourceDirectories: [], selected: true }],
      saveSelectedToFavorites: vi.fn(async () => ({ inserted: 1, skipped: 0 })),
    };
    initPromptMemoryUI(controller as any);
    window.dispatchEvent(new CustomEvent('prompt-memory:open'));
    (window as any).__promptMemoryRenderResults();
    document.querySelector<HTMLButtonElement>('[data-action="save-selected"]')!.click();
    await Promise.resolve();
    expect(controller.saveSelectedToFavorites).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run failing UI tests**

Run:

```bash
env npm_config_cache=/private/tmp/prompt-editor-prompt-memory-npm-cache npm test -- editor/src/__tests__/prompt-memory-ui.test.ts
```

Expected: fail because `prompt-memory-ui.ts` does not exist.

- [ ] **Step 3: Implement prompt-memory-ui.ts**

Create `editor/src/prompt-memory-ui.ts` exporting `initPromptMemoryUI(controller = new PromptMemoryController())`.

Required behavior:

- Listen to `#btn-prompt-memory` click and `prompt-memory:open`.
- Render `.prompt-memory-modal` into `#prompt-memory-root`.
- On open, call `controller.detectDirectories()` and show directory rows.
- Directory rows use checkbox inputs, agent label, path, detected/custom badge, exists/missing status.
- Provide an agent select and `Add Directory` button; the button calls `controller.chooseDirectory(agent)`.
- `Confirm Scan` calls `controller.startScan(selectedDirectories)`.
- Results render from `controller.items`, sorted by timestamp descending.
- Search filters content case-insensitively.
- Agent filter supports `all`, `claudeCode`, `codex`, `openCode`, `pi`, `kimi`.
- Result checkboxes default unchecked and are disabled when `existsInHistory` or `saved`.
- `Save to Favorites` calls `controller.saveSelectedToFavorites()`, marks selected items saved, and refreshes the existing history panel through `bridge.renderHistory()`.
- Expose `window.__promptMemoryRenderResults = renderResults` only for tests.

- [ ] **Step 4: Add toolbar button and modal root**

In `editor/index.html`, add next to `btn-history`:

```html
<button id="btn-prompt-memory" class="icon-btn-toolbar" title="Scan Prompt Memory" aria-label="Scan Prompt Memory">⌕</button>
```

Add before `</body>` or near existing panels:

```html
<div id="prompt-memory-root"></div>
```

Add CSS for:

```css
.prompt-memory-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.28); z-index: 1000; }
.prompt-memory-modal { position: fixed; inset: 48px; max-width: 860px; margin: 0 auto; background: var(--bg); color: var(--fg); border: 1px solid var(--border); border-radius: 8px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 18px 50px rgba(0,0,0,.24); }
.prompt-memory-header, .prompt-memory-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--border); }
.prompt-memory-footer { border-bottom: 0; border-top: 1px solid var(--border); }
.prompt-memory-body { padding: 12px; overflow: auto; display: flex; flex-direction: column; gap: 10px; }
.prompt-memory-directory, .prompt-memory-result { display: grid; grid-template-columns: auto 96px 1fr auto; gap: 8px; align-items: start; padding: 8px; border: 1px solid var(--border); border-radius: 6px; }
.prompt-memory-result-content { white-space: pre-wrap; overflow: hidden; max-height: 4.5em; cursor: pointer; }
.prompt-memory-result.expanded .prompt-memory-result-content { max-height: none; }
```

- [ ] **Step 5: Initialize UI from editor.ts**

In `editor/src/editor.ts`, import and call:

```ts
import { initPromptMemoryUI } from './prompt-memory-ui';

initPromptMemoryUI();
```

- [ ] **Step 6: Run UI tests and build**

Run:

```bash
env npm_config_cache=/private/tmp/prompt-editor-prompt-memory-npm-cache npm test -- editor/src/__tests__/prompt-memory-ui.test.ts
env npm_config_cache=/private/tmp/prompt-editor-prompt-memory-npm-cache npm run build
```

Expected: pass.

- [ ] **Step 7: Commit modal UI**

Run:

```bash
git add editor/src/prompt-memory-ui.ts editor/src/__tests__/prompt-memory-ui.test.ts editor/src/editor.ts editor/index.html
git commit -m "feat: add prompt memory scanner modal"
```

---

## Task 8: End-to-End Verification and Polish

**Files:**
- Review: all files changed by Tasks 0 through 7.
- Modify only files whose verification failure is directly caused by this feature.

- [ ] **Step 1: Run complete frontend verification**

Run:

```bash
env npm_config_cache=/private/tmp/prompt-editor-prompt-memory-npm-cache npm test
env npm_config_cache=/private/tmp/prompt-editor-prompt-memory-npm-cache npm run build
```

Expected: all frontend tests pass and production bundle builds.

- [ ] **Step 2: Run complete Swift verification**

Run:

```bash
swift test
swift build
```

Expected: tests pass and build succeeds. Existing warnings are acceptable only if they existed before Task 0 and are not introduced by prompt memory code.

- [ ] **Step 3: Manual native sanity check**

Run the macOS app from the worktree using the project’s existing launch path. In the opened app:

- Click the new prompt memory toolbar button.
- Confirm detected directories appear without showing prompt contents in logs.
- Add a custom directory and select its Agent type.
- Start a scan against a small fixture directory.
- Confirm results are unchecked by default.
- Select one item and save it to favorites.
- Open History and confirm the item appears with a filled favorite star.

- [ ] **Step 4: Inspect privacy-sensitive logs**

Run:

```bash
rg -n "content|prompt|Sending|console\\.log|NSLog|print" editor/src macos/PromptEditor
```

Expected: no new logs print prompt memory item content or scanned prompt text. Existing unrelated logs can remain if they predate this feature.

- [ ] **Step 5: Review git diff**

Run:

```bash
git diff --check
git status --short
git log --oneline --decorate -8
```

Expected: no whitespace errors. Status contains only intentional changes before the final commit.

- [ ] **Step 6: Commit verification fixes if any**

If verification required polish fixes, commit the exact files reported by `git status --short`. For example, if only `editor/src/prompt-memory-ui.ts` changed:

```bash
git add editor/src/prompt-memory-ui.ts
git commit -m "chore: polish prompt memory scanner"
```

If no changes were needed, do not create an empty commit.

---

## Self-Review Notes

- Spec coverage: toolbar entry is Task 7; directory detection/custom selection is Tasks 4, 6, 7; Claude/Codex/OpenCode/Pi/Kimi parsing is Tasks 3 and 4; filtering/dedupe is Tasks 2 through 4; save to favorites is Tasks 1, 6, 7; history cap removal is Task 1; native macOS-only scanning is Tasks 2 through 5; privacy constraints are Task 8.
- Placeholder scan: no task contains TBD-style placeholders. Some snippets specify conditional fixes only where the existing SDK path may differ.
- Type consistency: Swift agent names use `claudeCode`, `codex`, `openCode`, `pi`, `kimi`; frontend types match those raw values. `PromptMemoryDirectory` and `PromptMemoryItem` shapes match the design document and bridge protocol.
