// AI Prompt Enhancement — side-by-side diff overlay with streaming output

import type { EditorView } from '@codemirror/view';
import { streamAIText } from './ai-service';
import { isAIConfigured } from './ai-config';
import { getAIPrompt } from './ai-prompts';
import { showSettings } from './settings-ui';
import { formatUsageLine } from './ai-usage';

let enhanceOverlay: HTMLElement | null = null;

interface EnhanceTarget {
  from: number;
  to: number;
  content: string;
}

export function getEnhanceTarget(view: EditorView): EnhanceTarget {
  const selection = view.state.selection.main;
  const from = selection.empty ? 0 : selection.from;
  const to = selection.empty ? view.state.doc.length : selection.to;
  const content = view.state.doc.sliceString(from, to);
  return { from, to, content };
}

export function enhancePrompt(view: EditorView): void {
  const target = getEnhanceTarget(view);
  const content = target.content.trim();
  if (!content) {
    showEnhanceToast('Write something first before enhancing.');
    return;
  }

  if (!isAIConfigured()) {
    showSettings('ai');
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
          <span class="ai-enhance-status" id="ai-enhance-status">Ready</span>
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
            <span class="ai-enhance-cursor" id="ai-enhance-cursor" style="display:none">▌</span>
          </div>
          <div class="ai-diff-content ai-diff-enhanced" id="ai-diff-enhanced"></div>
        </div>
      </div>
      <div class="ai-enhance-footer">
        <button id="ai-enhance-generate" class="ai-btn-secondary">Enhance</button>
        <span id="ai-enhance-usage" class="ai-usage-line" hidden></span>
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
  let renderFrame: number | null = null;

  const statusEl = overlay.querySelector('#ai-enhance-status') as HTMLElement;
  const enhancedEl = overlay.querySelector('#ai-diff-enhanced') as HTMLElement;
  const cursorEl = overlay.querySelector('#ai-enhance-cursor') as HTMLElement;
  const applyBtn = overlay.querySelector('#ai-enhance-apply') as HTMLButtonElement;
  const generateBtn = overlay.querySelector('#ai-enhance-generate') as HTMLButtonElement;
  const usageEl = overlay.querySelector('#ai-enhance-usage') as HTMLElement;

  function renderAccumulated(): void {
    enhancedEl.textContent = accumulated;
    enhancedEl.scrollTop = enhancedEl.scrollHeight;
  }

  function scheduleRender(): void {
    if (renderFrame !== null) return;
    renderFrame = requestAnimationFrame(() => {
      renderFrame = null;
      renderAccumulated();
    });
  }

  function flushRender(): void {
    if (renderFrame !== null) {
      cancelAnimationFrame(renderFrame);
      renderFrame = null;
    }
    renderAccumulated();
  }

  function waitForRender(): Promise<void> {
    return new Promise(resolve => {
      requestAnimationFrame(() => resolve());
    });
  }

  function startGeneration() {
    accumulated = '';
    enhancedEl.textContent = '';
    usageEl.hidden = true;
    usageEl.textContent = '';
    statusEl.textContent = 'Generating...';
    statusEl.className = 'ai-enhance-status ai-status-generating';
    cursorEl.style.display = 'inline';
    applyBtn.disabled = true;
    generateBtn.disabled = true;

    abortCtrl = streamAIText(
      [
        { role: 'system', content: getAIPrompt('enhance') },
        { role: 'user', content: content },
      ],
      async (chunk) => {
        accumulated += chunk;
        scheduleRender();
        await waitForRender();
      },
      (usage) => {
        flushRender();
        cursorEl.style.display = 'none';
        statusEl.textContent = '✓ Done';
        statusEl.className = 'ai-enhance-status ai-status-done';
        applyBtn.disabled = false;
        generateBtn.disabled = false;
        generateBtn.textContent = 'Regenerate';
        const usageLine = formatUsageLine(usage);
        if (usageLine) {
          usageEl.textContent = usageLine;
          usageEl.hidden = false;
        }
        abortCtrl = null;
      },
      (err) => {
        flushRender();
        cursorEl.style.display = 'none';
        statusEl.textContent = `✗ ${err.message}`;
        statusEl.className = 'ai-enhance-status ai-status-error';
        generateBtn.disabled = false;
        generateBtn.textContent = 'Regenerate';
        abortCtrl = null;
      },
      undefined,
      { feature: 'enhance' },
    );
  }

  // Apply button
  applyBtn.addEventListener('click', () => {
    if (!accumulated.trim()) return;
    view.dispatch({
      changes: { from: target.from, to: target.to, insert: accumulated },
    });
    closeOverlay();
  });

  generateBtn.addEventListener('click', () => {
    if (abortCtrl) abortCtrl.abort();
    startGeneration();
  });

  // Cancel / close
  function closeOverlay() {
    if (abortCtrl) abortCtrl.abort();
    if (renderFrame !== null) cancelAnimationFrame(renderFrame);
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
