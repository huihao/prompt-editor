import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initPromptMemoryUI } from '../prompt-memory-ui';

beforeEach(() => {
  document.body.innerHTML = '<button id="btn-prompt-memory"></button><div id="prompt-memory-root"></div><div id="history-list"></div>';
});

describe('prompt memory UI', () => {
  it('opens the modal when the toolbar button is clicked', () => {
    initPromptMemoryUI({ detectDirectories: vi.fn(async () => []) } as any);
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
    await new Promise(resolve => setTimeout(resolve, 0));

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

  it('refreshes results when scan updates arrive', async () => {
    const controller = {
      detectDirectories: vi.fn(async () => []),
      items: [] as any[],
    };
    initPromptMemoryUI(controller as any);

    window.dispatchEvent(new CustomEvent('prompt-memory:open'));
    await new Promise(resolve => setTimeout(resolve, 0));

    controller.items.push({ id: 'i', content: 'prompt from callback', agents: ['codex'], sourceDirectories: [] });
    window.dispatchEvent(new CustomEvent('prompt-memory:update'));

    expect(document.querySelector('.prompt-memory-result-content')?.textContent).toBe('prompt from callback');
  });

  it('shows cancel while scanning and cancels when closed', async () => {
    const controller = {
      detectDirectories: vi.fn(async () => []),
      cancelScan: vi.fn(),
      items: [],
      progress: [{ scanId: 's', directoryId: 'codex:/tmp', status: 'scanning', filesRead: 0, extracted: 2, skipped: 0 }],
      isScanning: true,
    };
    initPromptMemoryUI(controller as any);

    window.dispatchEvent(new CustomEvent('prompt-memory:open'));
    await new Promise(resolve => setTimeout(resolve, 0));
    window.dispatchEvent(new CustomEvent('prompt-memory:update'));

    expect(document.querySelector<HTMLButtonElement>('[data-action="cancel-scan"]')?.hidden).toBe(false);
    expect(document.querySelector('[data-role="progress"]')?.textContent).toContain('codex:/tmp');

    document.querySelector<HTMLButtonElement>('[data-action="close"]')!.click();
    expect(controller.cancelScan).toHaveBeenCalled();
  });
});
