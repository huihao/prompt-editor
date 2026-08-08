# Prompt Snippets Interaction Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair and harden Prompt Snippets interactions while preserving the existing circular picker and tree-based manager layout.

**Architecture:** Keep `SnippetManager` as the persistence boundary, but add explicit origin, validation, and move APIs. Keep the current manager and wheel classes, replace repeated per-render bindings with stable delegated listeners, and centralize output encoding in a small rendering helper. CSS changes only add missing states and responsive constraints.

**Tech Stack:** TypeScript, DOM APIs, CodeMirror 6, Vitest, jsdom, Vite

---

## File Map

- Create `editor/src/snippet-rendering.ts`: strict text/attribute escaping for the remaining static HTML templates.
- Create `editor/src/__tests__/snippet-rendering.test.ts`: encoding regression tests.
- Create `editor/src/__tests__/snippet-manager.test.ts`: origin, import validation, custom deletion, and atomic move tests.
- Create `editor/src/__tests__/snippet-manager-ui.test.ts`: tree, event lifecycle, form, focus, and safe-rendering tests.
- Create `editor/src/__tests__/snippet-wheel.test.ts`: keyboard and focus regression tests.
- Modify `editor/src/snippet-manager.ts`: origin maps, import schema validation, reset awaiting, and snippet moves.
- Modify `editor/src/snippet-manager-ui.ts`: stable event lifecycle, safe templates, built-in actions, form state, focus, and feedback.
- Modify `editor/src/snippet-wheel.ts`: semantic controls, safe content, keyboard navigation, and focus restoration.
- Modify `editor/src/editor.ts`: expose a discoverable manager gesture in the existing button title and pass the opener through existing APIs.
- Modify `editor/index.html`: collapse, validation, status, origin, focus, and narrow-window styles.

### Task 1: Safe Rendering Primitive

**Files:**
- Create: `editor/src/snippet-rendering.ts`
- Create: `editor/src/__tests__/snippet-rendering.test.ts`

- [ ] **Step 1: Write the failing encoding tests**

```ts
import { describe, expect, it } from 'vitest';
import { escapeHTML } from '../snippet-rendering';

describe('escapeHTML', () => {
  it('encodes text and quoted attribute delimiters', () => {
    expect(escapeHTML(`<img src=x onerror="alert('x')">&`)).toBe(
      '&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;'
    );
  });

  it('keeps ordinary prompt text unchanged', () => {
    expect(escapeHTML('Explain this function\nStep 1')).toBe('Explain this function\nStep 1');
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `cd editor && npm test -- src/__tests__/snippet-rendering.test.ts`

Expected: FAIL because `../snippet-rendering` does not exist.

- [ ] **Step 3: Implement the strict encoder**

```ts
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

export function escapeHTML(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, character => HTML_ENTITIES[character]);
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `cd editor && npm test -- src/__tests__/snippet-rendering.test.ts`

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add editor/src/snippet-rendering.ts editor/src/__tests__/snippet-rendering.test.ts
git commit -m "test: add safe snippet rendering primitive"
```

### Task 2: Data Origin, Import Validation, and Atomic Moves

**Files:**
- Create: `editor/src/__tests__/snippet-manager.test.ts`
- Modify: `editor/src/snippet-manager.ts`

- [ ] **Step 1: Write failing manager behavior tests**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SnippetManager } from '../snippet-manager';

const builtIns = {
  version: '1.0',
  categories: [{
    id: 'built-in', name: 'Built in', icon: 'B',
    snippets: [{ id: 'base', name: 'Base', description: '', content: 'base' }]
  }]
};

describe('SnippetManager data semantics', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => structuredClone(builtIns) }));
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
    await manager.addCategory({ id: 'target', name: 'Target', icon: 'T' });
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
    const result = await manager.importData(JSON.stringify({ version: '1.0', categories: [{ id: '', name: 'Bad', icon: 'X' }] }));
    expect(result.success).toBe(false);
    expect(result.error).toContain('category id');
    expect(manager.exportData()).toBe(before);
  });
});
```

- [ ] **Step 2: Run the manager tests and verify RED**

Run: `cd editor && npm test -- src/__tests__/snippet-manager.test.ts`

Expected: FAIL because `SnippetManager` is not exported, origin APIs do not exist, `updateSnippet` has no destination argument, and `importData` returns a boolean.

- [ ] **Step 3: Export the class and capture built-in IDs before merge**

```ts
export interface ImportResult {
  success: boolean;
  error?: string;
}

export class SnippetManager {
  private builtInCategoryIds = new Set<string>();
  private builtInSnippetIds = new Set<string>();

  private captureBuiltInIds(data: SnippetData): void {
    this.builtInCategoryIds.clear();
    this.builtInSnippetIds.clear();
    const visit = (category: Category) => {
      this.builtInCategoryIds.add(category.id);
      category.snippets?.forEach(snippet => this.builtInSnippetIds.add(snippet.id));
      category.subcategories?.forEach(visit);
    };
    data.categories.forEach(visit);
  }

  isBuiltInCategory(id: string): boolean {
    return this.builtInCategoryIds.has(id);
  }

  isBuiltInSnippet(id: string): boolean {
    return this.builtInSnippetIds.has(id);
  }

  async reload(): Promise<void> {
    await this.reloadData();
  }
}
```

Call `captureBuiltInIds(this.data)` after built-in JSON/default loading and before `loadUserData()`/`mergeData()`.

- [ ] **Step 4: Add immutable built-in guards and an atomic destination argument**

```ts
async updateSnippet(id: string, updates: Partial<Snippet>, destinationCategoryId?: string): Promise<boolean> {
  this.ensureLoaded();
  if (this.isBuiltInSnippet(id)) return false;

  const source = this.findSnippetInUserData(id);
  if (!source) return false;
  const destinationId = destinationCategoryId || source.category.id;
  const destination = this.findCategoryInUserData(destinationId);
  if (!destination) {
    const mergedDestination = this.categoryMap.get(destinationId);
    if (!mergedDestination) return false;
    const clone = this.cloneCategoryStructure(destinationId);
    if (!clone) return false;
    this.addCategoryToUserData(clone);
  }

  const finalDestination = this.findCategoryInUserData(destinationId);
  if (!finalDestination) return false;
  if (destinationId !== source.category.id && finalDestination.snippets?.some(item => item.id === id)) return false;

  const updated = { ...source.snippet, ...updates, id };
  source.category.snippets = source.category.snippets?.filter(item => item.id !== id);
  finalDestination.snippets = finalDestination.snippets || [];
  finalDestination.snippets.push(updated);
  this.saveUserData();
  await this.reloadData();
  return true;
}
```

Add early `isBuiltInCategory`/`isBuiltInSnippet` returns to update and delete methods. Preserve `addSnippet` into built-in categories.

- [ ] **Step 5: Validate imports before mutating storage**

```ts
private validateImport(value: unknown): ImportResult {
  if (!value || typeof value !== 'object') return { success: false, error: 'Import must be an object.' };
  const candidate = value as Partial<SnippetData>;
  if (typeof candidate.version !== 'string' || !Array.isArray(candidate.categories)) {
    return { success: false, error: 'Import requires a version and categories array.' };
  }

  const categoryIds = new Set<string>();
  const snippetIds = new Set<string>();
  const visit = (category: Category): string | null => {
    if (!category || typeof category.id !== 'string' || !category.id.trim()) return 'Every category id must be a non-empty string.';
    if (typeof category.name !== 'string' || !category.name.trim()) return `Category ${category.id} requires a name.`;
    if (typeof category.icon !== 'string' || !category.icon.trim()) return `Category ${category.id} requires an icon.`;
    if (categoryIds.has(category.id)) return `Duplicate category id: ${category.id}`;
    categoryIds.add(category.id);
    for (const snippet of category.snippets || []) {
      if (!snippet || typeof snippet.id !== 'string' || !snippet.id.trim()) return 'Every snippet id must be a non-empty string.';
      if (typeof snippet.name !== 'string' || !snippet.name.trim()) return `Snippet ${snippet.id} requires a name.`;
      if (typeof snippet.content !== 'string' || !snippet.content.trim()) return `Snippet ${snippet.id} requires content.`;
      if (snippetIds.has(snippet.id)) return `Duplicate snippet id: ${snippet.id}`;
      snippetIds.add(snippet.id);
    }
    for (const child of category.subcategories || []) {
      const error = visit(child);
      if (error) return error;
    }
    return null;
  };
  for (const category of candidate.categories) {
    const error = visit(category);
    if (error) return { success: false, error };
  }
  return { success: true };
}
```

Parse into a local variable, validate it, and only then assign `userData`, save, and reload. Return `ImportResult` in every branch.

- [ ] **Step 6: Run the manager tests and verify GREEN**

Run: `cd editor && npm test -- src/__tests__/snippet-manager.test.ts`

Expected: all manager behavior tests pass.

- [ ] **Step 7: Commit**

```bash
git add editor/src/snippet-manager.ts editor/src/__tests__/snippet-manager.test.ts
git commit -m "fix: harden snippet data operations"
```

### Task 3: Stable Tree Rendering and Event Lifecycle

**Files:**
- Create: `editor/src/__tests__/snippet-manager-ui.test.ts`
- Modify: `editor/src/snippet-manager-ui.ts`
- Modify: `editor/index.html`

- [ ] **Step 1: Write failing list interaction tests**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SnippetManagerUI } from '../snippet-manager-ui';
import { snippetManager } from '../snippet-manager';

describe('SnippetManagerUI list interactions', () => {
  beforeEach(async () => {
    document.body.innerHTML = '<button id="btn-snippets">Snippets</button>';
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      version: '1.0', categories: [{ id: 'root', name: 'Root', icon: 'R', subcategories: [
        { id: 'leaf', name: 'Leaf', icon: 'L', snippets: [{ id: 'base', name: 'Base', description: '', content: '<b>text</b>' }] }
      ] }]
    }) }));
    await snippetManager.reload();
  });

  it('renders no leaf-level empty state and encodes dynamic content', async () => {
    const ui = new SnippetManagerUI();
    await ui.open();
    expect(document.querySelectorAll('.empty-state')).toHaveLength(0);
    expect(document.querySelector('.snippet-name')?.textContent).toBe('Base');
    expect(document.querySelector('.tree-snippet-item b')).toBeNull();
  });

  it('collapses after search is cleared', async () => {
    const ui = new SnippetManagerUI();
    await ui.open();
    const search = document.querySelector('#snippet-search') as HTMLInputElement;
    search.value = 'Base'; search.dispatchEvent(new Event('input', { bubbles: true }));
    search.value = ''; search.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector<HTMLElement>('[data-category-id="root"]')!.click();
    expect(document.querySelector('[data-category-id="root"]')!.closest('.category-tree-item')?.classList.contains('collapsed')).toBe(true);
  });

  it('dispatches one action after repeated list renders', async () => {
    const ui = new SnippetManagerUI();
    const openForm = vi.spyOn(ui as never, 'showEditSnippetView');
    await ui.open();
    document.querySelector<HTMLElement>('#btn-add-snippet')!.click();
    document.querySelector<HTMLElement>('#btn-cancel')!.click();
    document.querySelector<HTMLElement>('#btn-add-snippet')!.click();
    document.querySelector<HTMLElement>('#btn-cancel')!.click();
    openForm.mockClear();
    document.querySelector<HTMLElement>('[data-action="add-snippet"]')!.click();
    expect(openForm).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run list tests and verify RED**

Run: `cd editor && npm test -- src/__tests__/snippet-manager-ui.test.ts`

Expected: FAIL for recursive empty states, lost collapse behavior, unsafe rendering, or repeated dispatch.

- [ ] **Step 3: Make `open` awaitable and bind overlay events once**

```ts
async open(opener: HTMLElement | null = document.activeElement as HTMLElement | null): Promise<void> {
  if (this.overlay) return;
  this.opener = opener;
  await snippetManager.loadData();
  this.createOverlay();
  this.showListView();
}

private handleContainerClick = async (event: Event): Promise<void> => {
  const target = event.target as HTMLElement;
  const actionTarget = target.closest<HTMLElement>('[data-action]');
  if (actionTarget) {
    await this.handleAction(actionTarget.dataset.action || '', actionTarget.dataset.id || '');
    return;
  }
  const header = target.closest<HTMLElement>('.tree-item-header');
  if (header) this.toggleCategory(header.dataset.categoryId || '');
};
```

Bind `click`, `input`, and `submit` once in `createOverlay`. Remove `this.container.addEventListener(...)` and per-header bindings from `bindListEvents`. Use an `AbortController` for document drag listeners and abort it in `close()`.

- [ ] **Step 4: Render only root empty states and preserve collapse state**

```ts
private collapsedCategoryIds = new Set<string>();

private renderCategoryTree(categories: Category[], level = 0): string {
  if (categories.length === 0) {
    return level === 0
      ? '<div class="empty-state"><div class="empty-text">No categories yet</div></div>'
      : '';
  }
  // Add `collapsed` from collapsedCategoryIds and encode every dynamic value with escapeHTML.
}

private toggleCategory(id: string): void {
  if (!id) return;
  if (this.collapsedCategoryIds.has(id)) this.collapsedCategoryIds.delete(id);
  else this.collapsedCategoryIds.add(id);
  this.container?.querySelector(`[data-category-id="${CSS.escape(id)}"]`)
    ?.closest('.category-tree-item')?.classList.toggle('collapsed');
}
```

Use `escapeHTML` for category/snippet values and all dynamic attribute values.

- [ ] **Step 5: Add the missing collapse styles**

```css
.category-tree-item.collapsed > .tree-children {
  display: none;
}

.category-tree-item.collapsed > .tree-item-header .tree-toggle {
  transform: rotate(-90deg);
}

.tree-toggle {
  transition: transform 0.15s ease;
}
```

- [ ] **Step 6: Run list tests and verify GREEN**

Run: `cd editor && npm test -- src/__tests__/snippet-manager-ui.test.ts`

Expected: list interaction tests pass.

- [ ] **Step 7: Commit**

```bash
git add editor/src/snippet-manager-ui.ts editor/index.html editor/src/__tests__/snippet-manager-ui.test.ts
git commit -m "fix: stabilize snippet manager tree interactions"
```

### Task 4: Built-In Actions, Form Feedback, Dirty State, and Focus

**Files:**
- Modify: `editor/src/__tests__/snippet-manager-ui.test.ts`
- Modify: `editor/src/snippet-manager-ui.ts`
- Modify: `editor/index.html`

- [ ] **Step 1: Add failing form and origin tests**

```ts
it('shows copy instead of edit and delete for a built-in snippet', async () => {
  const ui = new SnippetManagerUI();
  await ui.open();
  const row = document.querySelector('[data-snippet-id="base"]')!;
  expect(row.querySelector('[data-action="copy-snippet"]')).not.toBeNull();
  expect(row.querySelector('[data-action="edit-snippet"]')).toBeNull();
  expect(row.querySelector('[data-action="delete-snippet"]')).toBeNull();
});

it('copies a built-in snippet into the existing new form', async () => {
  const ui = new SnippetManagerUI();
  await ui.open();
  document.querySelector<HTMLElement>('[data-action="copy-snippet"]')!.click();
  expect((document.querySelector('#snippet-id') as HTMLInputElement).value).toBe('base-copy');
  expect((document.querySelector('#snippet-content') as HTMLTextAreaElement).value).toBe('<b>text</b>');
});

it('uses inline validation and focuses the first invalid field', async () => {
  const ui = new SnippetManagerUI();
  await ui.open();
  document.querySelector<HTMLElement>('#btn-add-snippet')!.click();
  document.querySelector<HTMLElement>('#btn-save-snippet')!.click();
  expect(document.querySelector('[data-error-for="snippet-id"]')?.textContent).toContain('required');
  expect(document.activeElement).toBe(document.querySelector('#snippet-id'));
});

it('confirms before discarding a dirty form and restores opener focus', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  const opener = document.querySelector('#btn-snippets') as HTMLButtonElement;
  opener.focus();
  const ui = new SnippetManagerUI();
  await ui.open(opener);
  document.querySelector<HTMLElement>('#btn-add-snippet')!.click();
  const name = document.querySelector('#snippet-name') as HTMLInputElement;
  name.value = 'Changed'; name.dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector<HTMLElement>('#btn-cancel')!.click();
  expect(confirm).toHaveBeenCalledOnce();
  expect(document.querySelector('#snippet-name')).not.toBeNull();
  confirm.mockReturnValue(true);
  document.querySelector<HTMLElement>('.snippet-manager-close')!.click();
  expect(document.activeElement).toBe(opener);
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `cd editor && npm test -- src/__tests__/snippet-manager-ui.test.ts`

Expected: FAIL because origin-specific actions, inline errors, dirty tracking, and focus restoration do not exist.

- [ ] **Step 3: Render origin-specific actions and copy flow**

```ts
private renderSnippetActions(snippet: Snippet): string {
  if (snippetManager.isBuiltInSnippet(snippet.id)) {
    return `<span class="origin-badge">Built-in</span>
      <button class="btn-icon-sm" data-action="copy-snippet" data-id="${escapeHTML(snippet.id)}" aria-label="Copy ${escapeHTML(snippet.name)}">⧉</button>`;
  }
  return `<button class="btn-icon-sm" data-action="edit-snippet" data-id="${escapeHTML(snippet.id)}" aria-label="Edit ${escapeHTML(snippet.name)}">✎</button>
    <button class="btn-icon-sm" data-action="delete-snippet" data-id="${escapeHTML(snippet.id)}" aria-label="Delete ${escapeHTML(snippet.name)}">⌫</button>`;
}

private copyBuiltInSnippet(id: string): void {
  const source = snippetManager.getSnippet(id);
  if (!source) return;
  this.showEditSnippetView(this.findSnippetCategoryId(id) || undefined, {
    ...source,
    id: this.createCopyId(source.id),
    name: `${source.name} Copy`
  }, false);
}
```

Category built-in rows retain add-snippet but omit edit/delete. Add an origin badge. Route `copy-snippet` through the stable action handler.

- [ ] **Step 4: Add form baseline, inline errors, and save state**

```ts
private formBaseline = '';
private isSaving = false;

private captureFormBaseline(): void {
  this.formBaseline = this.serializeCurrentForm();
}

private isFormDirty(): boolean {
  return this.currentView.startsWith('edit-') && this.serializeCurrentForm() !== this.formBaseline;
}

private showFieldError(id: string, message: string): void {
  const field = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
  const error = this.container?.querySelector<HTMLElement>(`[data-error-for="${id}"]`);
  if (error) error.textContent = message;
  field?.setAttribute('aria-invalid', 'true');
  field?.focus();
}

private setSaving(button: HTMLButtonElement, saving: boolean, normalLabel: string): void {
  this.isSaving = saving;
  button.disabled = saving;
  button.textContent = saving ? 'Saving...' : normalLabel;
}
```

Add `<div class="form-error" data-error-for="field-id" aria-live="polite"></div>` after each required field. Wrap each save call in `setSaving(..., true)` and `finally { setSaving(..., false) }`. Pass the selected category to `updateSnippet(id, snippet, categoryId)`.

- [ ] **Step 5: Guard discard paths and restore focus**

```ts
private canDiscardForm(): boolean {
  return !this.isFormDirty() || confirm('Discard unsaved changes?');
}

private returnToList(): void {
  if (this.canDiscardForm()) this.showListView();
}

close(force = false): void {
  if (!force && !this.canDiscardForm()) return;
  const opener = this.opener;
  // remove overlay and listeners
  opener?.focus();
}
```

Use `returnToList` for Cancel and non-list Escape. Use `close()` for outside click and close button. After a successful save, reset the baseline before returning so no discard prompt appears. Focus search after list render and the ID/name field after form render.

- [ ] **Step 6: Await reset and surface import errors inline**

```ts
private async resetSnippets(): Promise<void> {
  if (!confirm('Reset all custom snippets to default?')) return;
  await snippetManager.resetToDefault();
  this.showListView();
}

const result = await snippetManager.importData(json);
if (!result.success) {
  this.showPanelMessage(result.error || 'Invalid snippet file.', 'error');
  return;
}
this.showPanelMessage('Snippets imported successfully.', 'success');
this.showListView();
```

Change `resetToDefault` to `async resetToDefault(): Promise<void>` and `await this.loadData()`.

- [ ] **Step 7: Add supporting styles**

```css
.form-error,
.panel-message.error {
  color: #d70015;
  font-size: 11px;
  margin-top: 4px;
}

.form-error:empty {
  display: none;
}

.origin-badge {
  color: var(--muted-fg, #666);
  font-size: 10px;
}

.btn:disabled {
  cursor: progress;
  opacity: 0.65;
}
```

- [ ] **Step 8: Run manager UI tests and verify GREEN**

Run: `cd editor && npm test -- src/__tests__/snippet-manager-ui.test.ts`

Expected: all list and form tests pass.

- [ ] **Step 9: Commit**

```bash
git add editor/src/snippet-manager.ts editor/src/snippet-manager-ui.ts editor/index.html editor/src/__tests__/snippet-manager-ui.test.ts
git commit -m "feat: improve snippet manager form interactions"
```

### Task 5: Picker Keyboard Navigation and Safe Content

**Files:**
- Create: `editor/src/__tests__/snippet-wheel.test.ts`
- Modify: `editor/src/snippet-wheel.ts`
- Modify: `editor/index.html`

- [ ] **Step 1: Write failing picker interaction tests**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hideSnippetWheel, showSnippetWheel } from '../snippet-wheel';

describe('SnippetWheel keyboard interactions', () => {
  beforeEach(() => {
    document.body.innerHTML = '<button id="btn-snippets">Snippets</button>';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      version: '1.0', categories: [{ id: 'root', name: '<b>Root</b>', icon: 'R', description: 'Root', snippets: [
        { id: 'one', name: 'One', description: 'First', content: '<img src=x onerror=alert(1)>' },
        { id: 'two', name: 'Two', description: 'Second', content: 'two' }
      ] }]
    }) }));
  });

  it('focuses an item, moves with arrows, and activates with Enter', async () => {
    const opener = document.querySelector('#btn-snippets') as HTMLButtonElement;
    opener.focus();
    const onSelect = vi.fn();
    await showSnippetWheel(undefined, onSelect, opener);
    expect(document.activeElement).toHaveClass('wheel-item');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it('renders names and previews as text and restores focus on close', async () => {
    const opener = document.querySelector('#btn-snippets') as HTMLButtonElement;
    await showSnippetWheel(undefined, vi.fn(), opener);
    expect(document.querySelector('.wheel-item b')).toBeNull();
    document.querySelector<HTMLElement>('.wheel-item')!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(document.querySelector('.snippet-wheel-center img')).toBeNull();
    hideSnippetWheel();
    expect(document.activeElement).toBe(opener);
  });
});
```

- [ ] **Step 2: Run picker tests and verify RED**

Run: `cd editor && npm test -- src/__tests__/snippet-wheel.test.ts`

Expected: FAIL because the API is synchronous/has no opener, items are `div` elements without focus behavior, and dynamic content is unescaped.

- [ ] **Step 3: Make controls semantic and retain the circular classes**

```ts
private createWheelButton(item: WheelItem, index: number): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `wheel-item ${item.type}`;
  button.dataset.index = String(index);
  button.setAttribute('aria-label', `${item.type === 'snippet' ? 'Insert' : 'Open'} ${item.name}`);
  const icon = document.createElement('span');
  icon.className = 'wheel-item-icon';
  icon.textContent = item.icon;
  const name = document.createElement('span');
  name.className = 'wheel-item-name';
  name.textContent = item.name;
  button.append(icon, name);
  return button;
}
```

Create close/manage as `<button type="button">`, breadcrumb links as buttons, and keep all existing CSS class names so the display structure stays unchanged. Build center preview children with `textContent`.

- [ ] **Step 4: Add roving focus and focus restoration**

```ts
private focusedItemIndex = 0;
private opener: HTMLElement | null = null;

private focusItem(index: number): void {
  const items = Array.from(this.wheelContainer?.querySelectorAll<HTMLElement>('.wheel-item') || []);
  if (!items.length) return;
  this.focusedItemIndex = (index + items.length) % items.length;
  items[this.focusedItemIndex].focus();
}

private handleKeyDown(e: KeyboardEvent): void {
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    e.preventDefault(); this.focusItem(this.focusedItemIndex + 1); return;
  }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault(); this.focusItem(this.focusedItemIndex - 1); return;
  }
  if (e.key === 'Enter' || e.key === ' ') {
    const item = this.currentItems[this.focusedItemIndex];
    if (item) { e.preventDefault(); this.handleItemClick(item); }
    return;
  }
  if (e.key === 'Escape') this.currentCategoryId ? this.goBack() : this.hide();
}
```

Make `show`, `showInlineWheel`, and exported `showSnippetWheel` return `Promise<void>` and accept an opener. After rendering, focus item zero. In `hide`, focus the saved opener after cleanup.

- [ ] **Step 5: Add dialog semantics without changing layout**

```ts
this.overlay.setAttribute('role', 'dialog');
this.overlay.setAttribute('aria-modal', 'true');
this.overlay.setAttribute('aria-label', 'Prompt Snippets');
```

Add visible focus styles using the existing item outline and color tokens.

- [ ] **Step 6: Run picker tests and verify GREEN**

Run: `cd editor && npm test -- src/__tests__/snippet-wheel.test.ts`

Expected: picker keyboard and safe-content tests pass.

- [ ] **Step 7: Commit**

```bash
git add editor/src/snippet-wheel.ts editor/index.html editor/src/__tests__/snippet-wheel.test.ts
git commit -m "feat: add accessible snippet wheel navigation"
```

### Task 6: Narrow-Window Behavior and Entry Discoverability

**Files:**
- Modify: `editor/index.html`
- Modify: `editor/src/editor.ts`
- Modify: `editor/src/__tests__/snippet-manager-ui.test.ts`

- [ ] **Step 1: Add a failing narrow-layout contract test**

```ts
import editorHTML from '../../index.html?raw';

it('defines a narrow-window manager override', () => {
  expect(editorHTML).toContain('@media (max-width: 700px)');
  expect(editorHTML).toContain('.snippet-manager-modal');
  expect(editorHTML).toContain('min-width: 0');
  expect(editorHTML).toContain('resize: none');
});
```

Place this assertion in a test that loads `editor/index.html` as text with Vite's `?raw` import, rather than relying on jsdom layout calculations.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `cd editor && npm test -- src/__tests__/snippet-manager-ui.test.ts`

Expected: FAIL because the existing narrow media query has no manager override.

- [ ] **Step 3: Add manager-only responsive constraints**

```css
@media (max-width: 700px) {
  .snippet-manager-modal {
    width: calc(100vw - 16px);
    height: calc(100vh - 16px);
    min-width: 0;
    min-height: 0;
    max-width: none;
    max-height: none;
    left: 8px !important;
    top: 8px !important;
    resize: none;
  }

  .snippet-manager-toolbar {
    flex-wrap: wrap;
  }

  .snippet-manager-toolbar .toolbar-spacer {
    flex-basis: 100%;
    height: 0;
  }

  .snippet-edit-form {
    padding: 16px;
  }
}
```

In dragging setup, return early when `matchMedia('(max-width: 700px)').matches`. Listen for resize and recenter/clamp the desktop modal inside the overlay.

- [ ] **Step 4: Clarify the existing manager gesture**

```ts
const snippetsButton = document.getElementById('btn-snippets')!;
snippetsButton.title = 'Prompt Snippets (⌘⇧S) · Right-click to manage';
snippetsButton.addEventListener('click', () => showSnippetWheel(view, onSnippetSelected, snippetsButton));
snippetsButton.addEventListener('contextmenu', event => {
  event.preventDefault();
  snippetManagerUI.open(snippetsButton);
});
```

Reuse the current insertion callback. Do not add a new toolbar button or panel.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run: `cd editor && npm test -- src/__tests__/snippet-manager-ui.test.ts`

Expected: the responsive contract test and all manager UI tests pass.

- [ ] **Step 6: Commit**

```bash
git add editor/index.html editor/src/editor.ts editor/src/__tests__/snippet-manager-ui.test.ts
git commit -m "fix: keep snippet manager usable in narrow windows"
```

### Task 7: Full Verification and Browser QA

**Files:**
- Modify only if verification reveals a failing requirement in files already listed above.

- [ ] **Step 1: Run all automated tests**

Run: `cd editor && npm test`

Expected: all existing and new test files pass with no unhandled errors.

- [ ] **Step 2: Run the production build**

Run: `cd editor && npm run build`

Expected: Vite completes successfully and emits `editor/dist/index.html`.

- [ ] **Step 3: Check formatting and unintended diffs**

Run: `git diff --check`

Expected: no whitespace errors.

Run: `git status --short`

Expected: only intentional Prompt Snippets files plus the user's pre-existing unrelated modifications are shown.

- [ ] **Step 4: Verify desktop manager interactions in a browser**

Start: `cd editor && npm run dev -- --host 127.0.0.1`

Verify at `http://127.0.0.1:5173/`:

1. Right-click Prompt Snippets and confirm search receives focus.
2. Collapse a category, search for a snippet, clear search, and confirm collapse still works.
3. Enter and cancel forms repeatedly, then confirm one category action opens one form.
4. Confirm built-in rows expose copy but not edit/delete.
5. Copy a built-in snippet, trigger required-field feedback, save it, move it to another category, and delete it.
6. Modify a form and confirm Cancel, Escape, outside click, and close all protect unsaved changes.
7. Import an invalid JSON fixture and confirm current snippets remain visible.

- [ ] **Step 5: Verify picker keyboard flow**

1. Focus the toolbar button and open Prompt Snippets.
2. Confirm the first item receives focus.
3. Navigate with arrow keys, enter a category with Enter, go back with Escape, and insert a snippet with Enter.
4. Reopen and close the picker; confirm focus returns to the toolbar button.
5. Open the manager through the existing gear button and confirm focus enters the manager.

- [ ] **Step 6: Verify the 390-pixel viewport**

Set the browser viewport to `390x844`. Confirm the entire manager is visible, the toolbar wraps, forms scroll, buttons remain reachable, and drag/resize is disabled. Reset the viewport after the check.

- [ ] **Step 7: Commit any verification-only corrections**

```bash
git add editor/src/snippet-manager.ts editor/src/snippet-manager-ui.ts editor/src/snippet-wheel.ts editor/src/snippet-rendering.ts editor/src/editor.ts editor/index.html editor/src/__tests__/snippet-manager.test.ts editor/src/__tests__/snippet-manager-ui.test.ts editor/src/__tests__/snippet-wheel.test.ts editor/src/__tests__/snippet-rendering.test.ts
git commit -m "test: verify prompt snippets interactions"
```

Skip this commit when verification required no corrections.
