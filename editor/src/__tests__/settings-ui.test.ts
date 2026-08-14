import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getLocale, setLocale } from '../i18n';
import { closeSettings, showSettings } from '../settings-ui';

describe('unified settings', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
    setLocale('en');
  });

  afterEach(() => closeSettings());

  it('opens General, AI Provider, and Prompt Writing tabs in one modal', () => {
    showSettings();

    expect(document.querySelector('.settings-modal')).not.toBeNull();
    expect(document.querySelector('[data-settings-tab="general"]')?.textContent).toContain('General');
    expect(document.querySelector('[data-settings-tab="ai"]')?.textContent).toContain('AI Provider');
    expect(document.querySelector('[data-settings-tab="prompts"]')?.textContent).toContain('Prompt Writing');
    expect(document.querySelector('#settings-locale')).not.toBeNull();

    document.querySelector<HTMLButtonElement>('[data-settings-tab="ai"]')!.click();
    expect(document.querySelector('#ai-provider-select')).not.toBeNull();
    expect(document.querySelector('[data-ai-prompt-editor]')).toBeNull();

    document.querySelector<HTMLButtonElement>('[data-settings-tab="prompts"]')!.click();
    expect(document.querySelectorAll('[data-ai-prompt-editor]')).toHaveLength(3);
    expect(document.querySelector('#ai-provider-select')).toBeNull();
  });

  it('changes and persists language from General settings', () => {
    showSettings();
    const select = document.querySelector<HTMLSelectElement>('#settings-locale')!;
    select.value = 'zh';
    select.dispatchEvent(new Event('change', { bubbles: true }));

    expect(getLocale()).toBe('zh');
    expect(localStorage.getItem('promptEditor:locale')).toBe('zh');
  });

  it('renders the current language immediately and can switch back to English', () => {
    setLocale('zh');
    showSettings();

    expect(document.querySelector('#settings-title')?.textContent).toBe('设置');
    expect(document.querySelector('[data-settings-tab="general"]')?.textContent?.trim()).toBe('通用');

    const select = document.querySelector<HTMLSelectElement>('#settings-locale')!;
    select.value = 'en';
    select.dispatchEvent(new Event('change', { bubbles: true }));

    expect(document.querySelector('#settings-title')?.textContent).toBe('Settings');
    expect(document.querySelector('[data-settings-tab="general"]')?.textContent?.trim()).toBe('General');
  });
});
