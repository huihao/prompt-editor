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
  it('falls back to the final text when the stream emits no chunks', async () => {
    streamTextMock.mockReturnValue({
      textStream: (async function* () {})(),
      text: Promise.resolve('final enhanced prompt'),
    });

    const onChunk = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    streamAIText(
      [{ role: 'user', content: 'hello' }],
      onChunk,
      onDone,
      onError,
      {
        provider: 'openai',
        model: 'gpt-5.6',
        apiKey: 'test-key',
        enabled: true,
      },
    );

    await vi.waitFor(() => {
      expect(onChunk).toHaveBeenCalledWith('final enhanced prompt');
      expect(onDone).toHaveBeenCalled();
    });
    expect(onError).not.toHaveBeenCalled();
  });
});
