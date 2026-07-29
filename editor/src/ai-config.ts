// AI Provider Configuration & Settings Modal

export type AIProvider = 'openai' | 'anthropic' | 'google' | 'ollama';

export interface AIModel {
  id: string;
  name: string;
}

export interface AIConfig {
  provider: AIProvider;
  model: string;
  apiKey: string;
  baseURL?: string;
  enabled: boolean;
}

export const BUILT_IN_MODELS: Record<AIProvider, AIModel[]> = {
  openai: [
    { id: 'gpt-4.1', name: 'GPT-4.1' },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini' },
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'o3', name: 'o3' },
    { id: 'o3-mini', name: 'o3 Mini' },
    { id: 'o4-mini', name: 'o4 Mini' },
  ],
  anthropic: [
    { id: 'claude-opus-4-5', name: 'Claude Opus 4.5' },
    { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
    { id: 'claude-haiku-3-5', name: 'Claude Haiku 3.5' },
  ],
  google: [
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite' },
  ],
  ollama: [
    { id: 'llama3.1:8b', name: 'Llama 3.1 8B' },
    { id: 'llama3.3:70b', name: 'Llama 3.3 70B' },
    { id: 'qwen2.5:14b', name: 'Qwen 2.5 14B' },
    { id: 'qwen3:8b', name: 'Qwen 3 8B' },
    { id: 'deepseek-r1:8b', name: 'DeepSeek R1 8B' },
    { id: 'deepseek-r1:14b', name: 'DeepSeek R1 14B' },
    { id: 'mistral:7b', name: 'Mistral 7B' },
  ],
};

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

// ─── Settings Modal ───────────────────────────────────────────────────────────

let settingsOverlay: HTMLElement | null = null;

export function showAISettingsModal(): void {
  if (settingsOverlay) {
    settingsOverlay.remove();
    settingsOverlay = null;
  }

  const config = getAIConfig() ?? {
    provider: 'openai' as AIProvider,
    model: 'gpt-4o',
    apiKey: '',
    baseURL: 'http://localhost:11434/v1',
    enabled: true,
  };

  const overlay = document.createElement('div');
  overlay.className = 'ai-settings-overlay';
  overlay.innerHTML = `
    <div class="ai-settings-modal">
      <div class="ai-settings-header">
        <span class="ai-settings-title">✨ AI Settings</span>
        <button class="ai-settings-close" id="ai-settings-close">×</button>
      </div>
      <div class="ai-settings-body">
        <div class="ai-settings-field">
          <label>Provider</label>
          <select id="ai-provider-select">
            <option value="openai"${config.provider === 'openai' ? ' selected' : ''}>OpenAI</option>
            <option value="anthropic"${config.provider === 'anthropic' ? ' selected' : ''}>Anthropic</option>
            <option value="google"${config.provider === 'google' ? ' selected' : ''}>Google Gemini</option>
            <option value="ollama"${config.provider === 'ollama' ? ' selected' : ''}>Ollama (Local)</option>
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
          <input type="text" id="ai-baseurl-input" placeholder="http://localhost:11434/v1" value="${config.baseURL ?? 'http://localhost:11434/v1'}" />
        </div>
        <div class="ai-settings-field ai-settings-toggle">
          <label>Enable AI features</label>
          <input type="checkbox" id="ai-enabled-toggle"${config.enabled ? ' checked' : ''} />
        </div>
        <div id="ai-test-result" class="ai-test-result" style="display:none"></div>
      </div>
      <div class="ai-settings-footer">
        <button id="ai-test-btn" class="ai-btn-secondary">Test Connection</button>
        <div style="flex:1"></div>
        <button id="ai-cancel-btn" class="ai-btn-secondary">Cancel</button>
        <button id="ai-save-btn" class="ai-btn-primary">Save</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  settingsOverlay = overlay;

  const providerSelect = overlay.querySelector('#ai-provider-select') as HTMLSelectElement;
  const modelSelect = overlay.querySelector('#ai-model-select') as HTMLSelectElement;
  const modelCustom = overlay.querySelector('#ai-model-custom') as HTMLInputElement;
  const apikeyField = overlay.querySelector('#ai-apikey-field') as HTMLElement;
  const baseurlField = overlay.querySelector('#ai-baseurl-field') as HTMLElement;
  const apikeyInput = overlay.querySelector('#ai-apikey-input') as HTMLInputElement;
  const baseurlInput = overlay.querySelector('#ai-baseurl-input') as HTMLInputElement;

  function updateProviderUI() {
    const provider = providerSelect.value as AIProvider;
    const models = BUILT_IN_MODELS[provider];

    modelSelect.innerHTML = models
      .map(m => `<option value="${m.id}">${m.name}</option>`)
      .join('');

    // Try to keep current custom value selected
    const current = modelCustom.value.trim();
    const match = models.find(m => m.id === current);
    if (match) {
      modelSelect.value = match.id;
    } else {
      modelSelect.value = models[0]?.id ?? '';
      if (!current) modelCustom.value = models[0]?.id ?? '';
    }

    apikeyField.style.display = provider === 'ollama' ? 'none' : '';
    baseurlField.style.display = provider === 'ollama' ? '' : 'none';
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

  // API key visibility toggle
  overlay.querySelector('#ai-apikey-toggle')!.addEventListener('click', () => {
    apikeyInput.type = apikeyInput.type === 'password' ? 'text' : 'password';
  });

  // Test connection
  overlay.querySelector('#ai-test-btn')!.addEventListener('click', async () => {
    const testResult = overlay.querySelector('#ai-test-result') as HTMLElement;
    testResult.style.display = '';
    testResult.className = 'ai-test-result ai-test-loading';
    testResult.textContent = '⏳ Testing connection...';

    const testConfig: AIConfig = {
      provider: providerSelect.value as AIProvider,
      model: modelCustom.value.trim() || modelSelect.value,
      apiKey: apikeyInput.value.trim(),
      baseURL: baseurlInput.value.trim() || undefined,
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
  overlay.querySelector('#ai-save-btn')!.addEventListener('click', () => {
    const newConfig: AIConfig = {
      provider: providerSelect.value as AIProvider,
      model: modelCustom.value.trim() || modelSelect.value,
      apiKey: apikeyInput.value.trim(),
      baseURL: baseurlInput.value.trim() || undefined,
      enabled: (overlay.querySelector('#ai-enabled-toggle') as HTMLInputElement).checked,
    };
    saveAIConfig(newConfig);
    closeModal();
  });

  // Cancel / close
  function closeModal() {
    overlay.remove();
    if (settingsOverlay === overlay) settingsOverlay = null;
  }
  overlay.querySelector('#ai-settings-close')!.addEventListener('click', closeModal);
  overlay.querySelector('#ai-cancel-btn')!.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}
