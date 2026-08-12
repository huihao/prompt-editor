import { beforeEach, describe, expect, it } from 'vitest';
import type { AIConfig } from '../ai-config';
import {
  AI_PROMPT_FEATURES,
  DEFAULT_AI_PROMPTS,
  getAIPrompt,
  normalizeAIPromptSettings,
} from '../ai-prompts';

function createConfig(prompts?: AIConfig['prompts']): AIConfig {
  return {
    provider: 'openai',
    model: 'gpt-5.6',
    apiKey: 'key',
    enabled: true,
    prompts,
  };
}

describe('AI prompt resolution', () => {
  beforeEach(() => localStorage.clear());

  it('uses built-in prompts without stored configuration', () => {
    expect(getAIPrompt('enhance')).toBe(DEFAULT_AI_PROMPTS.enhance);
  });

  it('supports old AI configurations without prompt settings', () => {
    expect(getAIPrompt('autocomplete', createConfig())).toBe(DEFAULT_AI_PROMPTS.autocomplete);
  });

  it('returns an independent custom prompt for every feature', () => {
    for (const feature of AI_PROMPT_FEATURES) {
      const prompts = normalizeAIPromptSettings(undefined);
      prompts[feature] = { mode: 'custom', content: `custom ${feature}` };

      expect(getAIPrompt(feature, createConfig(prompts))).toBe(`custom ${feature}`);
    }
  });

  it('falls back to the built-in prompt for blank custom content', () => {
    const prompts = normalizeAIPromptSettings(undefined);
    prompts.enhance = { mode: 'custom', content: '   ' };

    expect(getAIPrompt('enhance', createConfig(prompts))).toBe(DEFAULT_AI_PROMPTS.enhance);
  });

  it('normalizes malformed prompt settings to safe defaults', () => {
    expect(normalizeAIPromptSettings({
      enhance: { mode: 'other', content: 4 },
      autocomplete: { mode: 'custom', content: 'Continue concisely.' },
    })).toEqual({
      enhance: { mode: 'default', content: '' },
      autocomplete: { mode: 'custom', content: 'Continue concisely.' },
      orchestration: { mode: 'default', content: '' },
    });
  });
});
