import {
  getAIConfig,
  getDefaultAIModel,
  saveAIConfig,
  type AIConfig,
} from './ai-config';
import {
  AI_PROMPT_FEATURES,
  DEFAULT_AI_PROMPTS,
  normalizeAIPromptSettings,
  type AIPromptFeature,
  type AIPromptSettings,
} from './ai-prompts';

export interface AIPromptSettingsPanelOptions {
  onSave?: () => void;
  onCancel?: () => void;
}

const PROMPT_LABELS: Record<AIPromptFeature, string> = {
  enhance: 'Prompt Enhance',
  autocomplete: 'AI Autocomplete',
  orchestration: 'Prompt Orchestration',
};

function getConfigForPromptSave(): AIConfig {
  return getAIConfig() ?? {
    provider: 'openai',
    model: getDefaultAIModel('openai'),
    apiKey: '',
    enabled: true,
  };
}

export function mountAIPromptSettingsPanel(
  container: HTMLElement,
  options: AIPromptSettingsPanelOptions = {},
): void {
  const promptSettings = normalizeAIPromptSettings(getAIConfig()?.prompts);

  container.innerHTML = `
    <div class="ai-settings-body prompt-settings-tab">
      <section class="ai-prompt-settings">
        <div class="ai-prompt-editors">
          ${AI_PROMPT_FEATURES.map(feature => `
            <div class="ai-prompt-editor" data-ai-prompt-editor="${feature}">
              <div class="ai-prompt-editor-heading">
                <label for="ai-prompt-mode-${feature}">${PROMPT_LABELS[feature]}</label>
                <select id="ai-prompt-mode-${feature}" aria-label="${PROMPT_LABELS[feature]} mode">
                  <option value="default">Use default</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <textarea id="ai-prompt-content-${feature}" aria-label="${PROMPT_LABELS[feature]} prompt"></textarea>
              <button id="ai-prompt-reset-${feature}" type="button" class="ai-btn-secondary">Reset to default</button>
            </div>
          `).join('')}
        </div>
      </section>
    </div>
    <div class="ai-settings-footer">
      <div style="flex:1"></div>
      <button id="ai-prompt-cancel-btn" class="ai-btn-secondary">Cancel</button>
      <button id="ai-prompt-save-btn" class="ai-btn-primary">Save</button>
    </div>
  `;

  const renderPromptEditor = (feature: AIPromptFeature): void => {
    const setting = promptSettings[feature];
    const mode = container.querySelector<HTMLSelectElement>(`#ai-prompt-mode-${feature}`)!;
    const content = container.querySelector<HTMLTextAreaElement>(`#ai-prompt-content-${feature}`)!;
    mode.value = setting.mode;
    content.disabled = setting.mode === 'default';
    content.value = setting.mode === 'custom'
      ? setting.content
      : DEFAULT_AI_PROMPTS[feature];
  };

  AI_PROMPT_FEATURES.forEach(feature => {
    const mode = container.querySelector<HTMLSelectElement>(`#ai-prompt-mode-${feature}`)!;
    const content = container.querySelector<HTMLTextAreaElement>(`#ai-prompt-content-${feature}`)!;

    renderPromptEditor(feature);
    mode.addEventListener('change', () => {
      const setting = promptSettings[feature];
      setting.mode = mode.value === 'custom' ? 'custom' : 'default';
      if (setting.mode === 'custom' && !setting.content) {
        setting.content = DEFAULT_AI_PROMPTS[feature];
      }
      renderPromptEditor(feature);
    });
    content.addEventListener('input', () => {
      promptSettings[feature].content = content.value;
    });
    container.querySelector<HTMLButtonElement>(`#ai-prompt-reset-${feature}`)!
      .addEventListener('click', () => {
        promptSettings[feature] = { mode: 'default', content: '' };
        renderPromptEditor(feature);
      });
  });

  container.querySelector<HTMLButtonElement>('#ai-prompt-save-btn')!.addEventListener('click', () => {
    const config = getConfigForPromptSave();
    const prompts = Object.fromEntries(AI_PROMPT_FEATURES.map(feature => [
      feature,
      { ...promptSettings[feature] },
    ])) as AIPromptSettings;
    saveAIConfig({ ...config, prompts });
    options.onSave?.();
  });
  container.querySelector<HTMLButtonElement>('#ai-prompt-cancel-btn')!
    .addEventListener('click', () => options.onCancel?.());
}
