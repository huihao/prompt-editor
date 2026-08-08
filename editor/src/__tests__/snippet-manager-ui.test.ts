import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SnippetManagerUI } from '../snippet-manager-ui';
import { snippetManager } from '../snippet-manager';

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

    expect((document.querySelector('#snippet-id') as HTMLInputElement).value).toBe('base-copy');
    expect((document.querySelector('#snippet-content') as HTMLTextAreaElement).value).toBe('<img src=x onerror=alert(1)>');
  });

  it('uses inline validation and focuses the first invalid field', async () => {
    ui = new SnippetManagerUI();
    await ui.open();
    document.querySelector<HTMLElement>('#btn-add-snippet')!.click();
    document.querySelector<HTMLElement>('#btn-save-snippet')!.click();
    await Promise.resolve();

    expect(document.querySelector('[data-error-for="snippet-id"]')?.textContent).toContain('required');
    expect(document.activeElement).toBe(document.querySelector('#snippet-id'));
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
});
