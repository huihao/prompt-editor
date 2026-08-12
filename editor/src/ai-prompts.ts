import { getAIConfig, type AIConfig } from './ai-config';

export type AIPromptFeature = 'enhance' | 'autocomplete' | 'orchestration';
export type AIPromptMode = 'default' | 'custom';

export interface AIPromptSetting {
  mode: AIPromptMode;
  content: string;
}

export type AIPromptSettings = Record<AIPromptFeature, AIPromptSetting>;

export const AI_PROMPT_FEATURES = [
  'enhance',
  'autocomplete',
  'orchestration',
] as const satisfies readonly AIPromptFeature[];

export const DEFAULT_AI_PROMPTS: Readonly<Record<AIPromptFeature, string>> = {
  enhance: `You are an expert prompt engineer. Your task is to expand and improve the given prompt to make it:
- More specific and detailed
- Clearer in intent and scope
- Better structured (use headers, bullet points, or numbered lists where appropriate)
- More effective for AI assistants to understand and execute

Return ONLY the improved prompt text. Do not add any explanation, preamble, or commentary.`,
  autocomplete: `You are an expert prompt engineer assistant. The user is writing a prompt. Based on what they've written, suggest a concise and useful continuation or follow-up prompt (1-3 sentences maximum).

Rules:
- Return ONLY the suggested continuation text, nothing else
- Make it directly useful as the next part of the prompt
- Match the style and context of what the user has already written
- Keep it brief and actionable`,
  orchestration: `You are an expert prompt workflow architect. Expand and split the user's prompt into an actionable workflow.

Return ONLY valid JSON with this shape:
{"title":"Workflow title","stages":[{"prompts":[{"title":"Step title","content":"Complete standalone prompt"}]}]}

Rules:
- Stages execute sequentially in array order.
- Prompts within the same stage must be independent and safe to run in parallel.
- Put dependent prompts in later stages.
- Each prompt must be complete, specific, and executable on its own.
- Preserve the user's intent and add useful detail without inventing requirements.
- Use no more than 24 prompts.
- Do not include markdown fences, explanations, or extra keys.`,
};

export function normalizeAIPromptSettings(value: unknown): AIPromptSettings {
  const source = value && typeof value === 'object'
    ? value as Record<string, unknown>
    : {};

  return Object.fromEntries(AI_PROMPT_FEATURES.map(feature => {
    const candidate = source[feature];
    const entry = candidate && typeof candidate === 'object'
      ? candidate as Record<string, unknown>
      : {};

    return [feature, {
      mode: entry.mode === 'custom' ? 'custom' : 'default',
      content: typeof entry.content === 'string' ? entry.content : '',
    }];
  })) as AIPromptSettings;
}

export function getAIPrompt(
  feature: AIPromptFeature,
  config: AIConfig | null = getAIConfig(),
): string {
  const setting = normalizeAIPromptSettings(config?.prompts)[feature];
  return setting.mode === 'custom' && setting.content.trim()
    ? setting.content
    : DEFAULT_AI_PROMPTS[feature];
}
