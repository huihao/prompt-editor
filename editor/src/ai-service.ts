// Unified AI streaming service — routes to the correct Vercel AI SDK provider

import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { getAIConfig, type AIConfig, type AIProvider } from './ai-config';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Stream AI text. Returns an AbortController you can call `.abort()` on to cancel.
 * Optionally pass an explicit `overrideConfig` to bypass the stored settings (used for Test Connection).
 */
export function streamAIText(
  messages: AIMessage[],
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (error: Error) => void,
  overrideConfig?: AIConfig,
): AbortController {
  const abortController = new AbortController();

  const config = overrideConfig ?? getAIConfig();
  if (!config) {
    onError(new Error('AI not configured. Click ⚙ to set up your AI provider.'));
    return abortController;
  }

  // Extract system message if present
  const systemMsg = messages.find(m => m.role === 'system')?.content;
  const chatMessages = messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  (async () => {
    try {
      const model = createLanguageModel(config);

      const result = streamText({
        model,
        system: systemMsg,
        messages: chatMessages,
        abortSignal: abortController.signal,
        maxOutputTokens: 4096,
      });

      for await (const chunk of result.textStream) {
        if (abortController.signal.aborted) break;
        onChunk(chunk);
      }

      if (!abortController.signal.aborted) {
        onDone();
      }
    } catch (err: unknown) {
      if (abortController.signal.aborted) return;
      const error = err instanceof Error ? err : new Error(String(err));
      // Provide friendlier messages for common errors
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        onError(new Error('Invalid API key. Please check your AI settings.'));
      } else if (error.message.includes('CORS') || error.message.includes('fetch')) {
        onError(new Error(
          `Network error. ${config.provider === 'anthropic'
            ? 'Anthropic may block direct browser requests — try OpenAI or Ollama instead.'
            : 'Check your network connection and API endpoint.'}`
        ));
      } else {
        onError(error);
      }
    }
  })();

  return abortController;
}

function createLanguageModel(config: AIConfig) {
  const { provider, model, apiKey, baseURL } = config;

  switch (provider as AIProvider) {
    case 'openai':
      return createOpenAI({ apiKey })(model);

    case 'anthropic':
      return createAnthropic({ apiKey })(model);

    case 'google':
      return createGoogleGenerativeAI({ apiKey })(model);

    case 'ollama':
      return createOpenAI({
        apiKey: 'ollama',
        baseURL: baseURL ?? 'http://localhost:11434/v1',
      })(model);

    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}
