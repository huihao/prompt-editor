import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AI_PROVIDER_OPTIONS,
  BUILT_IN_MODELS,
  getAIConfig,
  getDefaultAIModel,
  mountAISettingsPanel,
  saveAIConfig,
} from '../ai-config';
import { DEFAULT_AI_PROMPTS, normalizeAIPromptSettings } from '../ai-prompts';
import { getAIUsageSummary, recordAIUsage } from '../ai-usage';

describe('AI settings catalog', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
  });

  it('exposes the expected provider order and current model presets', () => {
    expect(AI_PROVIDER_OPTIONS.map(option => option.id)).toEqual([
      'openai',
      'anthropic',
      'google',
      'ollama',
      'deepseek',
      'moonshotai',
      'moonshotai-cn',
      'minimax',
      'minimax-cn',
      'kimi-coding',
      'xiaomi-token-plan-cn',
    ]);

    expect(BUILT_IN_MODELS.openai.map(model => model.id).slice(0, 3)).toEqual([
      'gpt-5.6',
      'gpt-5.5',
      'gpt-5.4',
    ]);
    expect(BUILT_IN_MODELS.anthropic.map(model => model.id)).toEqual([
      'claude-fable-5',
      'claude-mythos-5',
      'claude-opus-5',
      'claude-sonnet-5',
      'claude-haiku-4-5',
    ]);
    expect(BUILT_IN_MODELS.google[0].id).toBe('gemini-3.6-flash');
    expect(BUILT_IN_MODELS.ollama[0].id).toBe('qwen3.6:35b');
    expect(BUILT_IN_MODELS.deepseek.map(model => model.id)).toEqual([
      'deepseek-v4-flash',
      'deepseek-v4-pro',
    ]);
    expect(BUILT_IN_MODELS.moonshotai.map(model => model.id)).toEqual([
      'kimi-k3',
      'kimi-k2.7-code-highspeed',
      'kimi-k2.7-code',
      'kimi-k2.6',
    ]);
    expect(BUILT_IN_MODELS.minimax.map(model => model.id)).toEqual([
      'MiniMax-M3',
      'MiniMax-M2.7-highspeed',
      'MiniMax-M2.7',
      'MiniMax-M2.5-highspeed',
      'MiniMax-M2.5',
    ]);
    expect(BUILT_IN_MODELS['kimi-coding'][0].id).toBe('kimi-k3');
    expect(BUILT_IN_MODELS['xiaomi-token-plan-cn'].map(model => model.id)).toEqual([
      'mimo-v2.5',
      'mimo-v2.5-pro',
    ]);
    expect(getDefaultAIModel('openai')).toBe('gpt-5.6');
  });

  it('resets the model picker when the provider changes', () => {
    const container = document.createElement('div');
    mountAISettingsPanel(container);

    const providerSelect = container.querySelector<HTMLSelectElement>('#ai-provider-select')!;
    const modelSelect = container.querySelector<HTMLSelectElement>('#ai-model-select')!;
    const modelCustom = container.querySelector<HTMLInputElement>('#ai-model-custom')!;

    expect(modelSelect.value).toBe('gpt-5.6');

    providerSelect.value = 'anthropic';
    providerSelect.dispatchEvent(new Event('change', { bubbles: true }));

    expect(modelSelect.value).toBe('claude-fable-5');
    expect(modelCustom.value).toBe('claude-fable-5');

    providerSelect.value = 'deepseek';
    providerSelect.dispatchEvent(new Event('change', { bubbles: true }));

    expect(modelSelect.value).toBe('deepseek-v4-flash');
    expect(modelCustom.value).toBe('deepseek-v4-flash');
    expect(container.querySelector<HTMLElement>('#ai-baseurl-field')?.style.display).toBe('');
    expect(container.querySelector<HTMLInputElement>('#ai-baseurl-input')?.value).toBe('https://api.deepseek.com');
  });

  it('renders aggregate token usage and clears records after confirmation', () => {
    recordAIUsage({
      timestamp: Date.now(),
      feature: 'enhance',
      provider: 'openai',
      model: 'gpt-5.6',
      inputTokens: 30,
      outputTokens: 10,
      cacheReadTokens: 15,
    });
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const container = document.createElement('div');

    mountAISettingsPanel(container);

    expect(container.querySelector('#ai-usage-summary')?.textContent).toContain('40');
    expect(container.querySelector('#ai-usage-summary')?.textContent).toContain('50%');
    container.querySelector<HTMLButtonElement>('#ai-clear-usage')?.click();
    expect(getAIUsageSummary().recordCount).toBe(0);
    expect(confirmMock).toHaveBeenCalled();
  });

  it('shows an empty usage state without inventing a cache rate', () => {
    const container = document.createElement('div');

    mountAISettingsPanel(container);

    expect(container.querySelector('#ai-usage-summary')?.textContent).toContain('No usage recorded in the last 30 days.');
  });

  it('renders independent prompt editors and saves custom content safely', () => {
    const container = document.createElement('div');
    mountAISettingsPanel(container);

    expect(container.querySelectorAll('[data-ai-prompt-editor]')).toHaveLength(3);
    const mode = container.querySelector<HTMLSelectElement>('#ai-prompt-mode-enhance')!;
    const content = container.querySelector<HTMLTextAreaElement>('#ai-prompt-content-enhance')!;
    expect(mode.value).toBe('default');
    expect(content.disabled).toBe(true);
    expect(content.value).toBe(DEFAULT_AI_PROMPTS.enhance);

    mode.value = 'custom';
    mode.dispatchEvent(new Event('change', { bubbles: true }));
    expect(content.disabled).toBe(false);
    content.value = '<improve & preserve> "quoted"';
    content.dispatchEvent(new Event('input', { bubbles: true }));
    container.querySelector<HTMLButtonElement>('#ai-save-btn')!.click();

    expect(getAIConfig()?.prompts?.enhance).toEqual({
      mode: 'custom',
      content: '<improve & preserve> "quoted"',
    });

    const remounted = document.createElement('div');
    mountAISettingsPanel(remounted);
    expect(remounted.querySelector<HTMLTextAreaElement>('#ai-prompt-content-enhance')?.value)
      .toBe('<improve & preserve> "quoted"');
    expect(remounted.querySelector('improve')).toBeNull();
  });

  it('preserves custom drafts when switching modes and resets one feature locally', () => {
    const prompts = normalizeAIPromptSettings(undefined);
    prompts.enhance = { mode: 'custom', content: 'Enhance draft' };
    prompts.autocomplete = { mode: 'custom', content: 'Autocomplete draft' };
    saveAIConfig({
      provider: 'openai', model: 'gpt-5.6', apiKey: 'key', enabled: true, prompts,
    });
    const container = document.createElement('div');
    mountAISettingsPanel(container);

    const mode = container.querySelector<HTMLSelectElement>('#ai-prompt-mode-enhance')!;
    const content = container.querySelector<HTMLTextAreaElement>('#ai-prompt-content-enhance')!;
    mode.value = 'default';
    mode.dispatchEvent(new Event('change', { bubbles: true }));
    expect(content.disabled).toBe(true);
    expect(content.value).toBe(DEFAULT_AI_PROMPTS.enhance);

    mode.value = 'custom';
    mode.dispatchEvent(new Event('change', { bubbles: true }));
    expect(content.value).toBe('Enhance draft');

    container.querySelector<HTMLButtonElement>('#ai-prompt-reset-enhance')!.click();
    expect(mode.value).toBe('default');
    expect(content.value).toBe(DEFAULT_AI_PROMPTS.enhance);
    expect(container.querySelector<HTMLTextAreaElement>('#ai-prompt-content-autocomplete')?.value)
      .toBe('Autocomplete draft');
  });

  it('does not persist prompt edits when cancelled', () => {
    const prompts = normalizeAIPromptSettings(undefined);
    prompts.orchestration = { mode: 'custom', content: 'Original workflow prompt' };
    const saved = {
      provider: 'openai' as const,
      model: 'gpt-5.6',
      apiKey: 'key',
      enabled: true,
      prompts,
    };
    saveAIConfig(saved);
    const onCancel = vi.fn();
    const container = document.createElement('div');
    mountAISettingsPanel(container, { onCancel });

    const content = container.querySelector<HTMLTextAreaElement>('#ai-prompt-content-orchestration')!;
    content.value = 'Unsaved workflow prompt';
    content.dispatchEvent(new Event('input', { bubbles: true }));
    container.querySelector<HTMLButtonElement>('#ai-cancel-btn')!.click();

    expect(getAIConfig()).toEqual(saved);
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
