import { mountAISettingsPanel } from './ai-config';
import { applyTranslations, getLocale, setLocale } from './i18n';

export type SettingsTabId = 'general' | 'ai';

interface SettingsTab {
  id: SettingsTabId;
  label: string;
  render: (container: HTMLElement) => void;
}

let settingsOverlay: HTMLElement | null = null;

function renderGeneralSettings(container: HTMLElement): void {
  container.innerHTML = `
    <div class="settings-section">
      <div class="settings-field">
        <label for="settings-locale">Language</label>
        <select id="settings-locale" aria-label="Language">
          <option value="en">English</option>
          <option value="zh">Chinese</option>
        </select>
      </div>
    </div>
  `;

  const localeSelect = container.querySelector<HTMLSelectElement>('#settings-locale')!;
  localeSelect.value = getLocale();
  localeSelect.addEventListener('change', () => setLocale(localeSelect.value as 'en' | 'zh'));
}

const settingsTabs: SettingsTab[] = [
  { id: 'general', label: 'General', render: renderGeneralSettings },
  {
    id: 'ai',
    label: 'AI Provider',
    render: container => mountAISettingsPanel(container, {
      onSave: closeSettings,
      onCancel: closeSettings,
    }),
  },
];

export function closeSettings(): void {
  settingsOverlay?.remove();
  settingsOverlay = null;
}

export function showSettings(initialTab: SettingsTabId = 'general'): void {
  closeSettings();

  const overlay = document.createElement('div');
  overlay.className = 'settings-overlay';
  overlay.innerHTML = `
    <div class="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <header class="settings-header">
        <h2 id="settings-title">Settings</h2>
        <button class="settings-close" type="button" aria-label="Close" title="Close">×</button>
      </header>
      <div class="settings-layout">
        <nav class="settings-tabs" role="tablist" aria-label="Settings">
          ${settingsTabs.map(tab => `
            <button type="button" role="tab" data-settings-tab="${tab.id}">${tab.label}</button>
          `).join('')}
        </nav>
        <section class="settings-content" role="tabpanel"></section>
      </div>
    </div>
  `;

  const content = overlay.querySelector<HTMLElement>('.settings-content')!;
  const activateTab = (tabId: SettingsTabId): void => {
    const activeTab = settingsTabs.find(tab => tab.id === tabId) ?? settingsTabs[0];
    overlay.querySelectorAll<HTMLButtonElement>('[data-settings-tab]').forEach(button => {
      const isActive = button.dataset.settingsTab === activeTab.id;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-selected', String(isActive));
      button.tabIndex = isActive ? 0 : -1;
    });
    content.setAttribute('aria-label', activeTab.label);
    activeTab.render(content);
    applyTranslations(content);
  };

  overlay.querySelectorAll<HTMLButtonElement>('[data-settings-tab]').forEach(button => {
    button.addEventListener('click', () => activateTab(button.dataset.settingsTab as SettingsTabId));
  });
  overlay.querySelector<HTMLButtonElement>('.settings-close')!.addEventListener('click', closeSettings);
  overlay.addEventListener('click', event => {
    if (event.target === overlay) closeSettings();
  });
  overlay.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeSettings();
  });

  document.body.appendChild(overlay);
  settingsOverlay = overlay;
  activateTab(initialTab);
  applyTranslations(overlay);
  overlay.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();
}
