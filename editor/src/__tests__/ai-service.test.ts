import { describe, expect, it, vi } from 'vitest';
import { streamAIText } from '../ai-service';

const streamTextMock = vi.fn();
const { recordAIUsageMock } = vi.hoisted(() => ({ recordAIUsageMock: vi.fn() }));

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

vi.mock('../ai-usage', () => ({
  recordAIUsage: (...args: unknown[]) => recordAIUsageMock(...args),
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
    expect(recordAIUsageMock).not.toHaveBeenCalled();
  });

  it('records usage after a successful labeled stream', async () => {
    streamTextMock.mockReturnValue({
      fullStream: (async function* () {
        yield { type: 'text-delta', text: 'result' };
        yield {
          type: 'finish',
          totalUsage: {
            inputTokens: 40,
            outputTokens: 12,
            inputTokenDetails: { cacheReadTokens: 20, cacheWriteTokens: 4, noCacheTokens: 20 },
          },
        };
      })(),
    });
    const onDone = vi.fn();

    streamAIText(
      [{ role: 'user', content: 'hello' }],
      vi.fn(),
      onDone,
      vi.fn(),
      config,
      { feature: 'enhance' },
    );

    await vi.waitFor(() => expect(onDone).toHaveBeenCalledWith(expect.objectContaining({
      inputTokens: 40,
      outputTokens: 12,
      cacheReadTokens: 20,
    })));
    expect(recordAIUsageMock).toHaveBeenCalledWith(expect.objectContaining({
      feature: 'enhance',
      provider: 'openai',
      model: 'gpt-5.6',
      inputTokens: 40,
    }));
  });

  it('sets an ephemeral cache breakpoint on Anthropic system instructions', () => {
    streamTextMock.mockReturnValue({ fullStream: (async function* () {})() });

    streamAIText(
      [{ role: 'system', content: 'Stable instruction' }, { role: 'user', content: 'Dynamic input' }],
      vi.fn(),
      vi.fn(),
      vi.fn(),
      { ...config, provider: 'anthropic' },
    );

    expect(streamTextMock).toHaveBeenCalledWith(expect.objectContaining({
      system: expect.objectContaining({
        providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
      }),
    }));
  });

  it('does not record a stream cancelled before completion', async () => {
    let release: (() => void) | undefined;
    streamTextMock.mockReturnValue({
      fullStream: (async function* () {
        yield { type: 'text-delta', text: 'partial' };
        await new Promise<void>(resolve => { release = resolve; });
        yield { type: 'finish', totalUsage: { inputTokens: 10, outputTokens: 2, inputTokenDetails: {} } };
      })(),
    });
    recordAIUsageMock.mockClear();

    const controller = streamAIText(
      [{ role: 'user', content: 'hello' }],
      vi.fn(),
      vi.fn(),
      vi.fn(),
      config,
      { feature: 'enhance' },
    );
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    controller.abort();
    release?.();

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(recordAIUsageMock).not.toHaveBeenCalled();
  });

  it('finishes normally when a provider omits usage from the finish event', async () => {
    streamTextMock.mockReturnValue({
      fullStream: (async function* () {
        yield { type: 'text-delta', text: 'result' };
        yield { type: 'finish' };
      })(),
    });
    const onDone = vi.fn();
    const onError = vi.fn();

    streamAIText(
      [{ role: 'user', content: 'hello' }],
      vi.fn(),
      onDone,
      onError,
      config,
      { feature: 'enhance' },
    );

    await vi.waitFor(() => expect(onDone).toHaveBeenCalledWith(undefined));
    expect(onError).not.toHaveBeenCalled();
  });
});
