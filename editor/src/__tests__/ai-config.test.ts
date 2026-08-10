import { beforeEach, describe, expect, it } from 'vitest';
import {
  AI_PROVIDER_OPTIONS,
  BUILT_IN_MODELS,
  getDefaultAIModel,
  mountAISettingsPanel,
} from '../ai-config';

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
});
