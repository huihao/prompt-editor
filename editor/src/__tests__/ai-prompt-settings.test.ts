import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAIConfig, saveAIConfig } from '../ai-config';
import { mountAIPromptSettingsPanel } from '../ai-prompt-settings';
import { DEFAULT_AI_PROMPTS } from '../ai-prompts';
import { normalizeAIPromptSettings } from '../ai-prompts';

describe('AI prompt settings panel', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
  });

  it('renders all prompt editors without provider controls', () => {
    const container = document.createElement('div');
    mountAIPromptSettingsPanel(container);

    expect(container.querySelectorAll('[data-ai-prompt-editor]')).toHaveLength(3);
    expect(container.querySelector('#ai-provider-select')).toBeNull();
    expect(container.querySelector<HTMLTextAreaElement>('#ai-prompt-content-enhance')?.value)
      .toBe(DEFAULT_AI_PROMPTS.enhance);
  });

  it('saves custom prompts while preserving provider configuration', () => {
    saveAIConfig({
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
      apiKey: 'secret-key',
      baseURL: 'https://custom.example/v1',
      enabled: false,
    });
    const onSave = vi.fn();
    const container = document.createElement('div');
    mountAIPromptSettingsPanel(container, { onSave });

    const mode = container.querySelector<HTMLSelectElement>('#ai-prompt-mode-enhance')!;
    mode.value = 'custom';
    mode.dispatchEvent(new Event('change', { bubbles: true }));
    const content = container.querySelector<HTMLTextAreaElement>('#ai-prompt-content-enhance')!;
    content.value = 'Custom enhance prompt';
    content.dispatchEvent(new Event('input', { bubbles: true }));
    container.querySelector<HTMLButtonElement>('#ai-prompt-save-btn')!.click();

    expect(getAIConfig()).toEqual(expect.objectContaining({
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
      apiKey: 'secret-key',
      baseURL: 'https://custom.example/v1',
      enabled: false,
      prompts: expect.objectContaining({
        enhance: { mode: 'custom', content: 'Custom enhance prompt' },
      }),
    }));
    expect(onSave).toHaveBeenCalledOnce();
  });

  it('renders custom content as text and preserves drafts across mode switches', () => {
    const prompts = normalizeAIPromptSettings(undefined);
    prompts.enhance = { mode: 'custom', content: '<improve & preserve> "quoted"' };
    saveAIConfig({
      provider: 'openai', model: 'gpt-5.6', apiKey: 'key', enabled: true, prompts,
    });
    const container = document.createElement('div');
    mountAIPromptSettingsPanel(container);

    const mode = container.querySelector<HTMLSelectElement>('#ai-prompt-mode-enhance')!;
    const content = container.querySelector<HTMLTextAreaElement>('#ai-prompt-content-enhance')!;
    expect(content.value).toBe('<improve & preserve> "quoted"');
    expect(container.querySelector('improve')).toBeNull();

    mode.value = 'default';
    mode.dispatchEvent(new Event('change', { bubbles: true }));
    expect(content.disabled).toBe(true);
    expect(content.value).toBe(DEFAULT_AI_PROMPTS.enhance);

    mode.value = 'custom';
    mode.dispatchEvent(new Event('change', { bubbles: true }));
    expect(content.value).toBe('<improve & preserve> "quoted"');
  });

  it('resets only the selected prompt', () => {
    const prompts = normalizeAIPromptSettings(undefined);
    prompts.enhance = { mode: 'custom', content: 'Enhance draft' };
    prompts.autocomplete = { mode: 'custom', content: 'Autocomplete draft' };
    saveAIConfig({
      provider: 'openai', model: 'gpt-5.6', apiKey: 'key', enabled: true, prompts,
    });
    const container = document.createElement('div');
    mountAIPromptSettingsPanel(container);

    container.querySelector<HTMLButtonElement>('#ai-prompt-reset-enhance')!.click();

    expect(container.querySelector<HTMLSelectElement>('#ai-prompt-mode-enhance')?.value).toBe('default');
    expect(container.querySelector<HTMLTextAreaElement>('#ai-prompt-content-enhance')?.value)
      .toBe(DEFAULT_AI_PROMPTS.enhance);
    expect(container.querySelector<HTMLTextAreaElement>('#ai-prompt-content-autocomplete')?.value)
      .toBe('Autocomplete draft');
  });

  it('does not persist prompt edits when cancelled', () => {
    const saved = {
      provider: 'openai' as const,
      model: 'gpt-5.6',
      apiKey: 'key',
      enabled: true,
    };
    saveAIConfig(saved);
    const onCancel = vi.fn();
    const container = document.createElement('div');
    mountAIPromptSettingsPanel(container, { onCancel });

    container.querySelector<HTMLSelectElement>('#ai-prompt-mode-orchestration')!.value = 'custom';
    container.querySelector<HTMLSelectElement>('#ai-prompt-mode-orchestration')!
      .dispatchEvent(new Event('change', { bubbles: true }));
    container.querySelector<HTMLTextAreaElement>('#ai-prompt-content-orchestration')!.value = 'Unsaved';
    container.querySelector<HTMLButtonElement>('#ai-prompt-cancel-btn')!.click();

    expect(getAIConfig()).toEqual(saved);
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
