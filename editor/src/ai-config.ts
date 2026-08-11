// AI Provider Configuration & Settings Modal

import { clearAIUsage, formatTokenCount, getAIUsageSummary } from './ai-usage';

export type AIProvider =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'ollama'
  | 'deepseek'
  | 'moonshotai'
  | 'moonshotai-cn'
  | 'minimax'
  | 'minimax-cn'
  | 'kimi-coding'
  | 'xiaomi-token-plan-cn';

export interface AIModel {
  id: string;
  name: string;
}

export interface AIProviderOption {
  id: AIProvider;
  label: string;
}

interface AIProviderDefinition {
  id: AIProvider;
  label: string;
  kind: 'openai' | 'anthropic' | 'google' | 'ollama';
  models: AIModel[];
  defaultModel: string;
  defaultBaseURL?: string;
  showBaseURL?: boolean;
  headers?: Record<string, string>;
}

export interface AIConfig {
  provider: AIProvider;
  model: string;
  apiKey: string;
  baseURL?: string;
  enabled: boolean;
}

const AI_PROVIDER_DEFINITIONS: Record<AIProvider, AIProviderDefinition> = {
  openai: {
    id: 'openai',
    label: 'OpenAI',
    kind: 'openai',
    defaultModel: 'gpt-5.6',
    models: [
      { id: 'gpt-5.6', name: 'GPT-5.6' },
      { id: 'gpt-5.5', name: 'GPT-5.5' },
      { id: 'gpt-5.4', name: 'GPT-5.4' },
      { id: 'gpt-5', name: 'GPT-5' },
      { id: 'gpt-5-mini', name: 'GPT-5 Mini' },
      { id: 'gpt-5-nano', name: 'GPT-5 Nano' },
      { id: 'gpt-4.1', name: 'GPT-4.1' },
      { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini' },
      { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano' },
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'o3', name: 'o3' },
      { id: 'o4-mini', name: 'o4 Mini' },
    ],
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic',
    kind: 'anthropic',
    defaultModel: 'claude-fable-5',
    models: [
      { id: 'claude-fable-5', name: 'Claude Fable 5' },
      { id: 'claude-mythos-5', name: 'Claude Mythos 5' },
      { id: 'claude-opus-5', name: 'Claude Opus 5' },
      { id: 'claude-sonnet-5', name: 'Claude Sonnet 5' },
      { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5' },
    ],
  },
  google: {
    id: 'google',
    label: 'Google Gemini',
    kind: 'google',
    defaultModel: 'gemini-3.6-flash',
    models: [
      { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash' },
      { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash' },
      { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite' },
      { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro' },
      { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    ],
  },
  ollama: {
    id: 'ollama',
    label: 'Ollama (Local)',
    kind: 'ollama',
    defaultModel: 'qwen3:8b',
    defaultBaseURL: 'http://localhost:11434/v1',
    showBaseURL: true,
    models: [
      { id: 'qwen3.6:35b', name: 'Qwen 3.6 35B' },
      { id: 'qwen3.5:27b', name: 'Qwen 3.5 27B' },
      { id: 'qwen3:30b', name: 'Qwen 3 30B' },
      { id: 'gemma3:27b', name: 'Gemma 3 27B' },
      { id: 'gemma3:12b', name: 'Gemma 3 12B' },
      { id: 'llama3.3:70b', name: 'Llama 3.3 70B' },
      { id: 'llama3.2:3b', name: 'Llama 3.2 3B' },
      { id: 'llama3.1:8b', name: 'Llama 3.1 8B' },
      { id: 'qwen2.5:14b', name: 'Qwen 2.5 14B' },
      { id: 'qwen3:8b', name: 'Qwen 3 8B' },
      { id: 'deepseek-r1:8b', name: 'DeepSeek R1 8B' },
      { id: 'deepseek-r1:14b', name: 'DeepSeek R1 14B' },
      { id: 'mistral:7b', name: 'Mistral 7B' },
    ],
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    kind: 'openai',
    defaultModel: 'deepseek-v4-flash',
    defaultBaseURL: 'https://api.deepseek.com',
    showBaseURL: true,
    models: [
      { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash' },
      { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro' },
    ],
  },
  moonshotai: {
    id: 'moonshotai',
    label: 'Moonshot AI',
    kind: 'openai',
    defaultModel: 'kimi-k3',
    defaultBaseURL: 'https://api.moonshot.cn/v1',
    showBaseURL: true,
    models: [
      { id: 'kimi-k3', name: 'Kimi K3' },
      { id: 'kimi-k2.7-code-highspeed', name: 'Kimi K2.7 Code Highspeed' },
      { id: 'kimi-k2.7-code', name: 'Kimi K2.7 Code' },
      { id: 'kimi-k2.6', name: 'Kimi K2.6' },
    ],
  },
  'moonshotai-cn': {
    id: 'moonshotai-cn',
    label: 'Moonshot AI (China)',
    kind: 'openai',
    defaultModel: 'kimi-k3',
    defaultBaseURL: 'https://api.moonshot.cn/v1',
    showBaseURL: true,
    models: [
      { id: 'kimi-k3', name: 'Kimi K3' },
      { id: 'kimi-k2.7-code-highspeed', name: 'Kimi K2.7 Code Highspeed' },
      { id: 'kimi-k2.7-code', name: 'Kimi K2.7 Code' },
      { id: 'kimi-k2.6', name: 'Kimi K2.6' },
    ],
  },
  minimax: {
    id: 'minimax',
    label: 'MiniMax',
    kind: 'openai',
    defaultModel: 'MiniMax-M3',
    defaultBaseURL: 'https://api.minimax.io/v1',
    showBaseURL: true,
    models: [
      { id: 'MiniMax-M3', name: 'MiniMax M3' },
      { id: 'MiniMax-M2.7-highspeed', name: 'MiniMax M2.7 Highspeed' },
      { id: 'MiniMax-M2.7', name: 'MiniMax M2.7' },
      { id: 'MiniMax-M2.5-highspeed', name: 'MiniMax M2.5 Highspeed' },
      { id: 'MiniMax-M2.5', name: 'MiniMax M2.5' },
    ],
  },
  'minimax-cn': {
    id: 'minimax-cn',
    label: 'MiniMax (China)',
    kind: 'openai',
    defaultModel: 'MiniMax-M3',
    defaultBaseURL: 'https://api.minimax.io/v1',
    showBaseURL: true,
    models: [
      { id: 'MiniMax-M3', name: 'MiniMax M3' },
      { id: 'MiniMax-M2.7-highspeed', name: 'MiniMax M2.7 Highspeed' },
      { id: 'MiniMax-M2.7', name: 'MiniMax M2.7' },
      { id: 'MiniMax-M2.5-highspeed', name: 'MiniMax M2.5 Highspeed' },
      { id: 'MiniMax-M2.5', name: 'MiniMax M2.5' },
    ],
  },
  'kimi-coding': {
    id: 'kimi-coding',
    label: 'Kimi For Coding',
    kind: 'openai',
    defaultModel: 'kimi-k3',
    defaultBaseURL: 'https://api.moonshot.cn/v1',
    showBaseURL: true,
    models: [
      { id: 'kimi-k3', name: 'Kimi K3' },
      { id: 'kimi-k2.7-code-highspeed', name: 'Kimi K2.7 Code Highspeed' },
      { id: 'kimi-k2.7-code', name: 'Kimi K2.7 Code' },
      { id: 'kimi-k2.6', name: 'Kimi K2.6' },
    ],
  },
  'xiaomi-token-plan-cn': {
    id: 'xiaomi-token-plan-cn',
    label: 'Xiaomi MiMo Token Plan (China)',
    kind: 'openai',
    defaultModel: 'mimo-v2.5-pro',
    defaultBaseURL: 'https://api.xiaomimimo.com/v1',
    showBaseURL: true,
    models: [
      { id: 'mimo-v2.5', name: 'MiMo V2.5' },
      { id: 'mimo-v2.5-pro', name: 'MiMo V2.5 Pro' },
    ],
  },
};

export const AI_PROVIDER_OPTIONS: AIProviderOption[] = Object.values(AI_PROVIDER_DEFINITIONS).map(
  ({ id, label }) => ({ id, label }),
);

export const BUILT_IN_MODELS: Record<AIProvider, AIModel[]> = Object.fromEntries(
  Object.values(AI_PROVIDER_DEFINITIONS).map(definition => [definition.id, definition.models]),
) as Record<AIProvider, AIModel[]>;

export function getDefaultAIModel(provider: AIProvider): string {
  return AI_PROVIDER_DEFINITIONS[provider]?.defaultModel ?? '';
}

export function getDefaultAIBaseURL(provider: AIProvider): string | undefined {
  return AI_PROVIDER_DEFINITIONS[provider]?.defaultBaseURL;
}

export function shouldShowAIBaseURL(provider: AIProvider): boolean {
  return Boolean(AI_PROVIDER_DEFINITIONS[provider]?.showBaseURL);
}

export function getAIProviderDefinition(provider: AIProvider): AIProviderDefinition {
  return AI_PROVIDER_DEFINITIONS[provider];
}

const AI_CONFIG_KEY = 'promptEditor:aiConfig';

export function getAIConfig(): AIConfig | null {
  try {
    const stored = localStorage.getItem(AI_CONFIG_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as AIConfig;
  } catch {
    return null;
  }
}

export function saveAIConfig(config: AIConfig): void {
  localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));
}

export function isAIConfigured(): boolean {
  const config = getAIConfig();
  if (!config || !config.enabled) return false;
  if (config.provider === 'ollama') return true;
  return Boolean(config.apiKey?.trim());
}

// ─── Settings Panel ───────────────────────────────────────────────────────────

export interface AISettingsPanelOptions {
  onSave?: () => void;
  onCancel?: () => void;
}

export function mountAISettingsPanel(
  container: HTMLElement,
  options: AISettingsPanelOptions = {},
): void {
  const config = getAIConfig() ?? {
    provider: 'openai' as AIProvider,
    model: getDefaultAIModel('openai'),
    apiKey: '',
    enabled: true,
  };

  container.innerHTML = `
      <div class="ai-settings-body">
        <div class="ai-settings-field">
          <label>Provider</label>
          <select id="ai-provider-select">
            ${AI_PROVIDER_OPTIONS.map(option => `
              <option value="${option.id}"${config.provider === option.id ? ' selected' : ''}>${option.label}</option>
            `).join('')}
          </select>
        </div>
        <div class="ai-settings-field">
          <label>Model</label>
          <div class="ai-model-row">
            <select id="ai-model-select"></select>
            <input type="text" id="ai-model-custom" placeholder="or type custom model ID" value="${config.model}" />
          </div>
        </div>
        <div class="ai-settings-field" id="ai-apikey-field">
          <label>API Key</label>
          <div class="ai-apikey-row">
            <input type="password" id="ai-apikey-input" placeholder="sk-..." value="${config.apiKey ?? ''}" autocomplete="off" />
            <button id="ai-apikey-toggle" title="Show/hide">👁</button>
          </div>
        </div>
        <div class="ai-settings-field" id="ai-baseurl-field" style="display:none">
          <label>Base URL</label>
          <input type="text" id="ai-baseurl-input" placeholder="http://localhost:11434/v1" value="${config.baseURL ?? ''}" />
        </div>
        <div class="ai-settings-field ai-settings-toggle">
          <label>Enable AI features</label>
          <input type="checkbox" id="ai-enabled-toggle"${config.enabled ? ' checked' : ''} />
        </div>
        <div class="ai-usage-section" id="ai-usage-section">${renderAIUsageSection()}</div>
        <div id="ai-test-result" class="ai-test-result" style="display:none"></div>
      </div>
      <div class="ai-settings-footer">
        <button id="ai-test-btn" class="ai-btn-secondary">Test Connection</button>
        <div style="flex:1"></div>
        <button id="ai-cancel-btn" class="ai-btn-secondary">Cancel</button>
        <button id="ai-save-btn" class="ai-btn-primary">Save</button>
      </div>
  `;

  const providerSelect = container.querySelector('#ai-provider-select') as HTMLSelectElement;
  const modelSelect = container.querySelector('#ai-model-select') as HTMLSelectElement;
  const modelCustom = container.querySelector('#ai-model-custom') as HTMLInputElement;
  const apikeyField = container.querySelector('#ai-apikey-field') as HTMLElement;
  const baseurlField = container.querySelector('#ai-baseurl-field') as HTMLElement;
  const apikeyInput = container.querySelector('#ai-apikey-input') as HTMLInputElement;
  const baseurlInput = container.querySelector('#ai-baseurl-input') as HTMLInputElement;
  const usageSection = container.querySelector('#ai-usage-section') as HTMLElement;

  if (config.baseURL) {
    baseurlInput.value = config.baseURL;
  }

  function updateProviderUI() {
    const provider = providerSelect.value as AIProvider;
    const definition = getAIProviderDefinition(provider);
    const models = definition.models;
    const showBaseURL = shouldShowAIBaseURL(provider);

    modelSelect.innerHTML = models
      .map(m => `<option value="${m.id}">${m.name}</option>`)
      .join('');

    const current = modelCustom.value.trim();
    const match = models.find(m => m.id === current);
    const fallbackModel = models[0]?.id ?? '';
    modelSelect.value = match?.id ?? fallbackModel;
    if (!match) modelCustom.value = fallbackModel;

    apikeyField.style.display = provider === 'ollama' ? 'none' : '';
    baseurlField.style.display = showBaseURL ? '' : 'none';
    if (showBaseURL && !baseurlInput.value.trim()) {
      baseurlInput.value = getDefaultAIBaseURL(provider) ?? '';
    }
  }

  updateProviderUI();

  // Sync model select → custom input
  modelSelect.addEventListener('change', () => {
    modelCustom.value = modelSelect.value;
  });
  modelCustom.addEventListener('input', () => {
    const val = modelCustom.value.trim();
    const match = (BUILT_IN_MODELS[providerSelect.value as AIProvider] ?? []).find(m => m.id === val);
    if (match) modelSelect.value = match.id;
  });

  providerSelect.addEventListener('change', updateProviderUI);

  usageSection.addEventListener('click', event => {
    const target = event.target as HTMLElement;
    if (target.id !== 'ai-clear-usage') return;
    if (!window.confirm('Clear all local AI usage statistics?')) return;
    clearAIUsage();
    usageSection.innerHTML = renderAIUsageSection();
  });

  // API key visibility toggle
  container.querySelector('#ai-apikey-toggle')!.addEventListener('click', () => {
    apikeyInput.type = apikeyInput.type === 'password' ? 'text' : 'password';
  });

  // Test connection
  container.querySelector('#ai-test-btn')!.addEventListener('click', async () => {
    const testResult = container.querySelector('#ai-test-result') as HTMLElement;
    testResult.style.display = '';
    testResult.className = 'ai-test-result ai-test-loading';
    testResult.textContent = '⏳ Testing connection...';

    const testConfig: AIConfig = {
      provider: providerSelect.value as AIProvider,
      model: modelCustom.value.trim() || modelSelect.value,
      apiKey: apikeyInput.value.trim(),
      baseURL: shouldShowAIBaseURL(providerSelect.value as AIProvider)
        ? baseurlInput.value.trim() || getDefaultAIBaseURL(providerSelect.value as AIProvider)
        : undefined,
      enabled: true,
    };

    try {
      const { streamAIText } = await import('./ai-service');
      await new Promise<void>((resolve, reject) => {
        const ctrl = streamAIText(
          [{ role: 'user', content: 'Reply with exactly: OK' }],
          () => {},
          () => resolve(),
          (err) => reject(err),
          testConfig,
        );
        setTimeout(() => { ctrl.abort(); resolve(); }, 8000);
      });
      testResult.className = 'ai-test-result ai-test-success';
      testResult.textContent = '✅ Connection successful!';
    } catch (err: any) {
      testResult.className = 'ai-test-result ai-test-error';
      testResult.textContent = `❌ ${err?.message ?? 'Connection failed'}`;
    }
  });

  // Save
  container.querySelector('#ai-save-btn')!.addEventListener('click', () => {
    const newConfig: AIConfig = {
      provider: providerSelect.value as AIProvider,
      model: modelCustom.value.trim() || modelSelect.value,
      apiKey: apikeyInput.value.trim(),
      baseURL: shouldShowAIBaseURL(providerSelect.value as AIProvider)
        ? baseurlInput.value.trim() || getDefaultAIBaseURL(providerSelect.value as AIProvider)
        : undefined,
      enabled: (container.querySelector('#ai-enabled-toggle') as HTMLInputElement).checked,
    };
    saveAIConfig(newConfig);
    options.onSave?.();
  });

  container.querySelector('#ai-cancel-btn')!.addEventListener('click', () => options.onCancel?.());
}

function renderAIUsageSection(): string {
  const summary = getAIUsageSummary();
  if (summary.recordCount === 0) {
    return `<h3>Token usage</h3><div id="ai-usage-summary" class="ai-usage-empty">No usage recorded in the last 30 days.</div>`;
  }

  const { totals } = summary;
  const cacheRate = summary.cacheHitRate === null
    ? 'Cache data not reported by this provider.'
    : `${Math.round(summary.cacheHitRate * 100)}% cache hit rate`;
  const featureLabel: Record<string, string> = {
    enhance: 'Prompt Enhance',
    orchestration: 'Prompt Orchestration',
    autocomplete: 'AI Autocomplete',
  };
  const formatGroups = (groups: typeof summary.byFeature, label: (key: string) => string) => groups
    .map(group => `<li><span>${escapeHtml(label(group.key))}</span><strong>${formatTokenCount(group.totalTokens)}</strong></li>`)
    .join('');
  const dailyRows = summary.byDay.map(day => `
    <tr><td>${day.date}</td><td>${formatTokenCount(day.inputTokens)}</td><td>${formatTokenCount(day.outputTokens)}</td><td>${formatTokenCount(day.totalTokens)}</td></tr>`).join('');

  return `
    <div class="ai-usage-heading"><h3>Token usage</h3><button id="ai-clear-usage" class="ai-btn-secondary" type="button">Clear usage data</button></div>
    <div id="ai-usage-summary" class="ai-usage-summary">
      <span><strong>${formatTokenCount(totals.inputTokens)}</strong> input</span>
      <span><strong>${formatTokenCount(totals.outputTokens)}</strong> output</span>
      <span><strong>${formatTokenCount(totals.totalTokens)}</strong> total</span>
      <span><strong>${formatTokenCount(totals.cacheReadTokens)}</strong> cache read</span>
      <span>${cacheRate}</span>
    </div>
    <div class="ai-usage-breakdown">
      <div><h4>By feature</h4><ul>${formatGroups(summary.byFeature, key => featureLabel[key] ?? key)}</ul></div>
      <div><h4>By model</h4><ul>${formatGroups(summary.byModel, key => key)}</ul></div>
    </div>
    <div class="ai-usage-days"><h4>Daily usage</h4><div class="ai-usage-table-wrap"><table class="ai-usage-table"><thead><tr><th>Date</th><th>Input</th><th>Output</th><th>Total</th></tr></thead><tbody>${dailyRows}</tbody></table></div></div>`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
