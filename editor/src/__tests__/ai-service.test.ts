import { describe, expect, it, vi } from 'vitest';
import { streamAIText } from '../ai-service';

const streamTextMock = vi.fn();

vi.mock('ai', () => ({
  streamText: (...args: unknown[]) => streamTextMock(...args),
}));

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() => (model: string) => model),
}));

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn(() => (model: string) => model),
}));

vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: vi.fn(() => (model: string) => model),
}));

vi.mock('../ai-config', () => ({
  getAIConfig: () => null,
  getAIProviderDefinition: () => ({ defaultBaseURL: 'https://example.com/v1' }),
}));

describe('ai-service', () => {
  const config = {
    provider: 'openai' as const,
    model: 'gpt-5.6',
    apiKey: 'test-key',
    enabled: true,
  };

  it('delivers text emitted by the complete stream', async () => {
    streamTextMock.mockReturnValue({
      fullStream: (async function* () {
        yield { type: 'text-delta', text: 'enhanced prompt' };
      })(),
    });

    const onChunk = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    streamAIText(
      [{ role: 'user', content: 'hello' }],
      onChunk,
      onDone,
      onError,
      config,
    );

    await vi.waitFor(() => {
      expect(onChunk).toHaveBeenCalledWith('enhanced prompt');
      expect(onDone).toHaveBeenCalled();
    });
    expect(streamTextMock.mock.calls[0][0]).not.toHaveProperty('maxOutputTokens');
    expect(onError).not.toHaveBeenCalled();
  });

  it('reports an error emitted by the complete stream', async () => {
    const providerError = new Error('Model is unavailable');
    streamTextMock.mockReturnValue({
      fullStream: (async function* () {
        yield { type: 'error', error: providerError };
      })(),
    });

    const onChunk = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    streamAIText(
      [{ role: 'user', content: 'hello' }],
      onChunk,
      onDone,
      onError,
      config,
    );

    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(providerError));
    expect(onChunk).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });
});
