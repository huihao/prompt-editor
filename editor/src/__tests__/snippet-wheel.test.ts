import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { snippetManager } from '../snippet-manager';
import { getSnippetWheelRadius, hideSnippetWheel, showSnippetWheel } from '../snippet-wheel';
import editorHTML from '../../index.html?raw';

const wheelData = {
  version: '1.0',
  categories: [
    {
      id: 'root',
      name: '<b>Root</b>',
      icon: 'R',
      description: 'Root category',
      snippets: [
        { id: 'one', name: 'One', description: 'First', content: '<img src=x onerror=alert(1)>' },
        { id: 'two', name: 'Two', description: 'Second', content: 'two' },
      ],
    },
  ],
};

describe('SnippetWheel keyboard interactions', () => {
  it('keeps wheel items inside a narrow viewport', () => {
    expect(getSnippetWheelRadius(390)).toBe(140);
    expect(getSnippetWheelRadius(1200)).toBe(180);
  });

  it('uses white text throughout the dark snippet wheel', () => {
    const darkWheelStyles = editorHTML.match(
      /\/\* Dark theme for snippet wheel - Enhanced center disc \*\/\s*@media \(prefers-color-scheme: dark\) \{([\s\S]*?)\n    \}\n\n    \/\* ={20,}/,
    )?.[1];

    const whiteTextSelectors = [
      '.snippet-wheel-breadcrumb',
      '.snippet-wheel-close',
      '.snippet-wheel-manage',
      '.snippet-wheel-hint',
      '.wheel-item.category',
      '.wheel-item.back',
      '.snippet-wheel-center .center-text',
      '.snippet-wheel-center .center-desc',
    ];

    expect(darkWheelStyles).toContain('--snippet-wheel-fg: #fff;');
    expect(darkWheelStyles).toContain(
      `${whiteTextSelectors.join(',\n      ')} {\n        color: var(--snippet-wheel-fg);\n      }`,
    );
  });

  beforeEach(async () => {
    document.body.innerHTML = '<button id="btn-snippets">Snippets</button>';
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => structuredClone(wheelData),
    }));
    await snippetManager.reload();
  });

  afterEach(() => {
    hideSnippetWheel();
    vi.restoreAllMocks();
  });

  it('focuses an item, moves with arrows, and activates with Enter', async () => {
    const opener = document.querySelector('#btn-snippets') as HTMLButtonElement;
    const onSelect = vi.fn();
    opener.focus();

    await showSnippetWheel(undefined, onSelect, opener);
    expect((document.activeElement as HTMLElement).classList.contains('wheel-item')).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect.mock.calls[0][0].id).toBe('one');
    expect(document.activeElement).toBe(opener);
  });

  it('renders names and snippet previews as text', async () => {
    const opener = document.querySelector('#btn-snippets') as HTMLButtonElement;
    await showSnippetWheel(undefined, vi.fn(), opener);

    expect(document.querySelector('.wheel-item b')).toBeNull();
    (document.querySelector('.wheel-item') as HTMLButtonElement).click();
    const snippet = document.querySelector<HTMLElement>('.wheel-item.snippet')!;
    snippet.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    expect(document.querySelector('.snippet-wheel-center img')).toBeNull();
    expect(document.querySelector('.center-desc')?.textContent).toContain('<img src=x');
  });

  it('exposes semantic close, manage, breadcrumb, and item controls', async () => {
    await showSnippetWheel(undefined, vi.fn(), document.querySelector('#btn-snippets') as HTMLButtonElement);

    expect(document.querySelector('.snippet-wheel-close')?.tagName).toBe('BUTTON');
    expect(document.querySelector('.snippet-wheel-manage')?.tagName).toBe('BUTTON');
    expect(document.querySelector('.snippet-wheel-breadcrumb button')?.tagName).toBe('BUTTON');
    expect(document.querySelector('.wheel-item')?.tagName).toBe('BUTTON');
  });
});
