export const SEND_FEATURE_ENABLED = false;

export function hideSendFeatureUI(root: Document): void {
  if (SEND_FEATURE_ENABLED) return;

  for (const selector of ['#btn-send', '#target-select', '#btn-refresh-agents', '#confirm-dialog']) {
    root.querySelector<HTMLElement>(selector)?.setAttribute('hidden', '');
  }
}
