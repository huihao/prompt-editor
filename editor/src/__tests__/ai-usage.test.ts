import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAIUsage,
  getAIUsageSummary,
  recordAIUsage,
} from '../ai-usage';

describe('AI usage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-11T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('records provider usage without prompt content and calculates cache hits', () => {
    recordAIUsage({
      timestamp: Date.now(),
      feature: 'enhance',
      provider: 'openai',
      model: 'gpt-5.6',
      inputTokens: 100,
      outputTokens: 20,
      cacheReadTokens: 60,
      cacheWriteTokens: 10,
    });

    const summary = getAIUsageSummary();

    expect(summary.totals).toMatchObject({
      inputTokens: 100,
      outputTokens: 20,
      cacheReadTokens: 60,
    });
    expect(summary.cacheHitRate).toBe(0.6);
    expect(summary.byFeature).toEqual([
      expect.objectContaining({ key: 'enhance', totalTokens: 120 }),
    ]);
    expect(localStorage.getItem('promptEditor:aiUsage')).not.toContain('user prompt text');
  });

  it('prunes records older than 30 days and clears records', () => {
    recordAIUsage({
      timestamp: Date.now() - 31 * 86_400_000,
      feature: 'autocomplete',
      provider: 'openai',
      model: 'gpt-5.6',
    });
    recordAIUsage({
      timestamp: Date.now(),
      feature: 'orchestration',
      provider: 'anthropic',
      model: 'claude-sonnet-5',
      inputTokens: 8,
    });

    expect(getAIUsageSummary().recordCount).toBe(1);
    clearAIUsage();
    expect(getAIUsageSummary().recordCount).toBe(0);
  });
});
