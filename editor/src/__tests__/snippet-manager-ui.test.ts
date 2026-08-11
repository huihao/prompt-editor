import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SnippetManagerUI } from '../snippet-manager-ui';
import { snippetManager } from '../snippet-manager';
import editorHTML from '../../index.html?raw';

const snippetData = {
  version: '1.0',
  categories: [
    {
      id: 'root',
      name: '<b>Root</b>',
      icon: 'R',
      description: 'Root category',
      subcategories: [
        {
          id: 'leaf',
          name: 'Leaf',
          icon: 'L',
          description: 'Leaf category',
          snippets: [
            { id: 'base', name: '<b>Base</b>', description: 'Base prompt', content: '<img src=x onerror=alert(1)>' },
          ],
        },
      ],
    },
  ],
};

describe('SnippetManagerUI interactions', () => {
  let ui: SnippetManagerUI | null = null;

  beforeEach(async () => {
    document.body.innerHTML = '<button id="btn-snippets">Snippets</button>';
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => structuredClone(snippetData),
    }));
    await snippetManager.reload();
  });

  afterEach(() => {
    ui?.close(true);
    ui = null;
    vi.restoreAllMocks();
  });

  it('renders no leaf-level empty state and encodes dynamic content', async () => {
    ui = new SnippetManagerUI();
    await ui.open();

    expect(document.querySelectorAll('.empty-state')).toHaveLength(0);
    expect(document.querySelector('.snippet-name')?.textContent).toBe('<b>Base</b>');
    expect(document.querySelector('.tree-snippet-item b')).toBeNull();
  });

  it('collapses after search is cleared', async () => {
    ui = new SnippetManagerUI();
    await ui.open();
    const search = document.querySelector('#snippet-search') as HTMLInputElement;

    search.value = 'Base';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    search.value = '';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector<HTMLElement>('[data-category-id="root"]')!.click();

    const item = document.querySelector('[data-category-id="root"]')!.closest('.category-tree-item');
    expect(item?.classList.contains('collapsed')).toBe(true);
  });

  it('toggles a focused category with the keyboard', async () => {
    ui = new SnippetManagerUI();
    await ui.open();
    const header = document.querySelector<HTMLElement>('[data-category-id="root"]')!;

    header.focus();
    header.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(header.closest('.category-tree-item')?.classList.contains('collapsed')).toBe(true);
    expect(header.getAttribute('aria-expanded')).toBe('false');
  });

  it('dispatches one action after repeated list renders', async () => {
    ui = new SnippetManagerUI();
    const openForm = vi.spyOn(ui as any, 'showEditSnippetView');
    await ui.open();

    document.querySelector<HTMLElement>('#btn-add-snippet')!.click();
    document.querySelector<HTMLElement>('#btn-cancel')!.click();
    document.querySelector<HTMLElement>('#btn-add-snippet')!.click();
    document.querySelector<HTMLElement>('#btn-cancel')!.click();
    openForm.mockClear();
    document.querySelector<HTMLElement>('[data-action="add-snippet"]')!.click();

    expect(openForm).toHaveBeenCalledTimes(1);
  });

  it('shows copy instead of edit and delete for a built-in snippet', async () => {
    ui = new SnippetManagerUI();
    await ui.open();
    const row = document.querySelector('[data-snippet-id="base"]')!;

    expect(row.querySelector('[data-action="copy-snippet"]')).not.toBeNull();
    expect(row.querySelector('[data-action="edit-snippet"]')).toBeNull();
    expect(row.querySelector('[data-action="delete-snippet"]')).toBeNull();
  });

  it('copies a built-in snippet into the existing new form', async () => {
    ui = new SnippetManagerUI();
    await ui.open();
    document.querySelector<HTMLElement>('[data-action="copy-snippet"]')!.click();

    const id = document.querySelector('#snippet-id') as HTMLInputElement;
    expect(id.type).toBe('hidden');
    expect(id.value).toMatch(/^snippet-/);
    expect(id.value).not.toContain('base');
    expect((document.querySelector('#snippet-content') as HTMLTextAreaElement).value).toBe('<img src=x onerror=alert(1)>');
  });

  it('generates hidden identifiers for new snippets and categories', async () => {
    ui = new SnippetManagerUI();
    await ui.open();

    document.querySelector<HTMLElement>('#btn-add-snippet')!.click();
    const snippetId = document.querySelector('#snippet-id') as HTMLInputElement;
    expect(snippetId.type).toBe('hidden');
    expect(snippetId.value).toMatch(/^snippet-/);
    expect(document.activeElement).toBe(document.querySelector('#snippet-name'));

    document.querySelector<HTMLElement>('#btn-cancel')!.click();
    document.querySelector<HTMLElement>('#btn-add-category')!.click();
    const categoryId = document.querySelector('#category-id') as HTMLInputElement;
    expect(categoryId.type).toBe('hidden');
    expect(categoryId.value).toMatch(/^category-/);
    expect(categoryId.value).not.toBe(snippetId.value);
    expect(document.activeElement).toBe(document.querySelector('#category-name'));
  });

  it('uses inline validation and focuses the first invalid user field', async () => {
    ui = new SnippetManagerUI();
    await ui.open();
    document.querySelector<HTMLElement>('#btn-add-snippet')!.click();
    document.querySelector<HTMLElement>('#btn-save-snippet')!.click();
    await Promise.resolve();

    expect(document.querySelector('[data-error-for="snippet-name"]')?.textContent).toContain('required');
    expect(document.activeElement).toBe(document.querySelector('#snippet-name'));
  });

  it('confirms before discarding a dirty form and restores opener focus', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const opener = document.querySelector('#btn-snippets') as HTMLButtonElement;
    opener.focus();
    ui = new SnippetManagerUI();
    await ui.open(opener);
    document.querySelector<HTMLElement>('#btn-add-snippet')!.click();
    const name = document.querySelector('#snippet-name') as HTMLInputElement;
    name.value = 'Changed';
    name.dispatchEvent(new Event('input', { bubbles: true }));

    document.querySelector<HTMLElement>('#btn-cancel')!.click();
    expect(confirm).toHaveBeenCalledOnce();
    expect(document.querySelector('#snippet-name')).not.toBeNull();

    confirm.mockReturnValue(true);
    document.querySelector<HTMLElement>('.snippet-manager-close')!.click();
    expect(document.activeElement).toBe(opener);
  });

  it('defines a narrow-window manager override', () => {
    const responsiveBlock = editorHTML.slice(editorHTML.indexOf('@media (max-width: 700px)'));

    expect(responsiveBlock).toContain('.snippet-manager-modal');
    expect(responsiveBlock).toContain('min-width: 0');
    expect(responsiveBlock).toContain('resize: none');
  });

  it('defines explicit light text colors for the dark manager', () => {
    const start = editorHTML.indexOf('/* Dark theme for snippet manager */');
    const end = editorHTML.indexOf('/* Responsive adjustments */', start);
    const darkManagerBlock = editorHTML.slice(start, end);

    expect(darkManagerBlock).toContain('color: #f5f5f7;');
    expect(darkManagerBlock).toContain('.snippet-manager-modal input');
    expect(darkManagerBlock).toContain('.snippet-manager-modal button');
    expect(darkManagerBlock).toContain('color: #b8b8bd;');
  });

  it('keeps native snippet wheel text readable and lets long labels wrap', () => {
    const nativeWheel = readFileSync(resolve(process.cwd(), '../macos/PromptEditor/SnippetWheelWindow.swift'), 'utf8');

    expect(nativeWheel).toContain('.wheel-item {');
    expect(nativeWheel).toContain('color: #f5f5f7;');
    expect(nativeWheel).toContain('.wheel-item.category');
    expect(nativeWheel).toContain('white-space: normal;');
    expect(nativeWheel).toContain('overflow-wrap: anywhere;');
  });
});
