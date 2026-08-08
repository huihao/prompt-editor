import { describe, expect, it } from 'vitest';
import { SEND_FEATURE_ENABLED, hideSendFeatureUI } from '../send-feature';

describe('send feature visibility', () => {
  it('keeps terminal sending disabled', () => {
    expect(SEND_FEATURE_ENABLED).toBe(false);
  });

  it('hides terminal sending controls and confirmation dialog', () => {
    document.body.innerHTML = `
      <button id="btn-send"></button>
      <select id="target-select"></select>
      <button id="btn-refresh-agents"></button>
      <button id="btn-paste-previous"></button>
      <div id="confirm-dialog"></div>
    `;

    hideSendFeatureUI(document);

    expect((document.querySelector('#btn-send') as HTMLElement).hidden).toBe(true);
    expect((document.querySelector('#target-select') as HTMLElement).hidden).toBe(true);
    expect((document.querySelector('#btn-refresh-agents') as HTMLElement).hidden).toBe(true);
    expect((document.querySelector('#btn-paste-previous') as HTMLElement).hidden).toBe(false);
    expect((document.querySelector('#confirm-dialog') as HTMLElement).hidden).toBe(true);
  });
});
