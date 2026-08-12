// Unified AI streaming service — routes to the correct Vercel AI SDK provider

import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import {
  getAIConfig,
  getAIProviderDefinition,
  type AIConfig,
  type AIProvider,
} from './ai-config';
import { recordAIUsage, type AIUsageFeature } from './ai-usage';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIRequestOptions {
  feature?: AIUsageFeature;
}

export interface AIRequestUsage {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  noCacheTokens?: number;
}

/**
 * Stream AI text. Returns an AbortController you can call `.abort()` on to cancel.
 * Optionally pass an explicit `overrideConfig` to bypass the stored settings (used for Test Connection).
 */
export function streamAIText(
  messages: AIMessage[],
  onChunk: (text: string) => void | Promise<void>,
  onDone: (usage?: AIRequestUsage) => void,
  onError: (error: Error) => void,
  overrideConfig?: AIConfig,
  options?: AIRequestOptions,
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
        system: config.provider === 'anthropic' && systemMsg
          ? {
              role: 'system',
              content: systemMsg,
              providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
            }
          : systemMsg,
        messages: chatMessages,
        abortSignal: abortController.signal,
      });

      let sawText = false;
      let streamError: Error | null = null;
      let usage: AIRequestUsage | undefined;
      for await (const part of result.fullStream) {
        if (abortController.signal.aborted) break;

        if (part.type === 'text-delta') {
          sawText = true;
          await onChunk(part.text);
        } else if (part.type === 'error') {
          streamError = part.error instanceof Error ? part.error : new Error(String(part.error));
          break;
        } else if (part.type === 'finish') {
          const finishUsage = part.totalUsage;
          if (finishUsage) {
            usage = {
              inputTokens: finishUsage.inputTokens,
              outputTokens: finishUsage.outputTokens,
              cacheReadTokens: finishUsage.inputTokenDetails?.cacheReadTokens,
              cacheWriteTokens: finishUsage.inputTokenDetails?.cacheWriteTokens,
              noCacheTokens: finishUsage.inputTokenDetails?.noCacheTokens,
            };
          }
        }
      }

      if (streamError) throw streamError;
      if (!abortController.signal.aborted && !sawText) {
        throw new Error('The AI provider returned an empty response. Try again or check the selected model.');
      }

      if (!abortController.signal.aborted) {
        if (options?.feature) {
          recordAIUsage({
            timestamp: Date.now(),
            feature: options.feature,
            provider: config.provider,
            model: config.model,
            ...usage,
          });
        }
        onDone(usage);
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
  const definition = getAIProviderDefinition(provider as AIProvider);

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

    case 'deepseek':
    case 'moonshotai':
    case 'moonshotai-cn':
    case 'minimax':
    case 'minimax-cn':
    case 'kimi-coding':
    case 'xiaomi-token-plan-cn':
      return createOpenAI({
        apiKey,
        baseURL: baseURL ?? definition.defaultBaseURL,
      })(model);

    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}
