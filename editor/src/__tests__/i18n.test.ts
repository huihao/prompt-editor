import { beforeEach, describe, expect, it } from 'vitest';
import { getLocale, initI18n, setLocale } from '../i18n';

describe('i18n', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '<button id="sample" title="History">History</button>';
  });

  it('defaults to English and translates the current document', () => {
    initI18n();
    expect(getLocale()).toBe('en');
    expect(document.querySelector('#sample')?.textContent).toBe('History');

    setLocale('zh');
    expect(document.querySelector('#sample')?.textContent).toBe('历史记录');
    expect(document.querySelector('#sample')?.getAttribute('title')).toBe('历史记录');
  });

  it('persists only supported locales', () => {
    setLocale('zh');
    expect(localStorage.getItem('promptEditor:locale')).toBe('zh');
    setLocale('fr' as never);
    expect(getLocale()).toBe('en');
  });
});
