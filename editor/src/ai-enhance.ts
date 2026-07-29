// AI Prompt Enhancement — side-by-side diff overlay with streaming output

import type { EditorView } from '@codemirror/view';
import { streamAIText } from './ai-service';
import { isAIConfigured, showAISettingsModal } from './ai-config';

const ENHANCE_SYSTEM_PROMPT = `You are an expert prompt engineer. Your task is to expand and improve the given prompt to make it:
- More specific and detailed
- Clearer in intent and scope
- Better structured (use headers, bullet points, or numbered lists where appropriate)
- More effective for AI assistants to understand and execute

Return ONLY the improved prompt text. Do not add any explanation, preamble, or commentary.`;

let enhanceOverlay: HTMLElement | null = null;

export function enhancePrompt(view: EditorView): void {
  const content = view.state.doc.toString().trim();
  if (!content) {
    showEnhanceToast('Write something first before enhancing.');
    return;
  }

  if (!isAIConfigured()) {
    showAISettingsModal();
    return;
  }

  if (enhanceOverlay) {
    enhanceOverlay.remove();
    enhanceOverlay = null;
  }

  const overlay = document.createElement('div');
  overlay.className = 'ai-enhance-overlay';
  overlay.innerHTML = `
    <div class="ai-enhance-modal">
      <div class="ai-enhance-header">
        <span class="ai-enhance-title">✨ AI Enhance Prompt</span>
        <div class="ai-enhance-header-actions">
          <span class="ai-enhance-status" id="ai-enhance-status">Generating...</span>
          <button class="ai-settings-close" id="ai-enhance-close">×</button>
        </div>
      </div>
      <div class="ai-enhance-body">
        <div class="ai-diff-panel">
          <div class="ai-diff-label">Original</div>
          <div class="ai-diff-content" id="ai-diff-original">${escapeHtml(content)}</div>
        </div>
        <div class="ai-diff-divider"></div>
        <div class="ai-diff-panel">
          <div class="ai-diff-label">
            Enhanced
            <span class="ai-enhance-cursor" id="ai-enhance-cursor">▌</span>
          </div>
          <div class="ai-diff-content ai-diff-enhanced" id="ai-diff-enhanced"></div>
        </div>
      </div>
      <div class="ai-enhance-footer">
        <button id="ai-enhance-regenerate" class="ai-btn-secondary" disabled>↺ Regenerate</button>
        <div style="flex:1"></div>
        <button id="ai-enhance-cancel" class="ai-btn-secondary">Cancel</button>
        <button id="ai-enhance-apply" class="ai-btn-primary" disabled>Apply →</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  enhanceOverlay = overlay;

  let accumulated = '';
  let abortCtrl: AbortController | null = null;

  const statusEl = overlay.querySelector('#ai-enhance-status') as HTMLElement;
  const enhancedEl = overlay.querySelector('#ai-diff-enhanced') as HTMLElement;
  const cursorEl = overlay.querySelector('#ai-enhance-cursor') as HTMLElement;
  const applyBtn = overlay.querySelector('#ai-enhance-apply') as HTMLButtonElement;
  const regenerateBtn = overlay.querySelector('#ai-enhance-regenerate') as HTMLButtonElement;

  function startGeneration() {
    accumulated = '';
    enhancedEl.textContent = '';
    statusEl.textContent = 'Generating...';
    statusEl.className = 'ai-enhance-status ai-status-generating';
    cursorEl.style.display = 'inline';
    applyBtn.disabled = true;
    regenerateBtn.disabled = true;

    abortCtrl = streamAIText(
      [
        { role: 'system', content: ENHANCE_SYSTEM_PROMPT },
        { role: 'user', content: content },
      ],
      (chunk) => {
        accumulated += chunk;
        enhancedEl.textContent = accumulated;
        // Auto-scroll to bottom
        enhancedEl.scrollTop = enhancedEl.scrollHeight;
      },
      () => {
        cursorEl.style.display = 'none';
        statusEl.textContent = '✓ Done';
        statusEl.className = 'ai-enhance-status ai-status-done';
        applyBtn.disabled = false;
        regenerateBtn.disabled = false;
        abortCtrl = null;
      },
      (err) => {
        cursorEl.style.display = 'none';
        statusEl.textContent = `✗ ${err.message}`;
        statusEl.className = 'ai-enhance-status ai-status-error';
        regenerateBtn.disabled = false;
        abortCtrl = null;
      },
    );
  }

  startGeneration();

  // Apply button
  applyBtn.addEventListener('click', () => {
    if (!accumulated.trim()) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: accumulated },
    });
    closeOverlay();
  });

  // Regenerate
  regenerateBtn.addEventListener('click', () => {
    if (abortCtrl) abortCtrl.abort();
    startGeneration();
  });

  // Cancel / close
  function closeOverlay() {
    if (abortCtrl) abortCtrl.abort();
    overlay.remove();
    if (enhanceOverlay === overlay) enhanceOverlay = null;
    view.focus();
  }

  overlay.querySelector('#ai-enhance-close')!.addEventListener('click', closeOverlay);
  overlay.querySelector('#ai-enhance-cancel')!.addEventListener('click', closeOverlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeOverlay(); });
  overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeOverlay(); });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showEnhanceToast(msg: string): void {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}
