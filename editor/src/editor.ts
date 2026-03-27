import { EditorView, keymap, placeholder } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
} from '@codemirror/language';
import { autocompletion, closeBrackets } from '@codemirror/autocomplete';
import { lightTheme, darkTheme } from './theme';
import { bridge } from './bridge';
import { imagePasteHandler, cleanupUnusedImages, prepareContentForSend } from './image-paste';
import { fileReferenceCompletion, triggerFilePicker } from './file-completion';
import { 
  fileReferenceDecorator, 
  fileReferenceClickHandler, 
  fileReferenceHover,
  filePickerKeymap 
} from './file-decoration';
import { showFilePicker } from './file-picker';
import { fileReferenceManager } from './file-reference';
import { initTemplateUI, showTemplatePanel, hideTemplatePanel, initTemplateManagerUI } from './template';

const STORAGE_KEY = 'promptEditor:draft';

// Restore saved draft
const savedDraft = localStorage.getItem(STORAGE_KEY) ?? '';

// Debounced auto-save
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const autoSave = EditorView.updateListener.of((update) => {
  if (!update.docChanged) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const content = update.state.doc.toString();
    localStorage.setItem(STORAGE_KEY, content);
    // Clean up unused images periodically
    if (Math.random() < 0.1) { // 10% chance
      cleanupUnusedImages(content);
    }
  }, 300);
});

// History navigation state
let historyIndex = -1; // -1 means current draft, 0 means most recent history item
let currentDraft = savedDraft;

function navigateHistory(view: EditorView, direction: 'up' | 'down'): boolean {
  const history = bridge.getHistory();
  if (history.length === 0) return false;

  if (direction === 'up') {
    // Navigate to older history
    if (historyIndex < history.length - 1) {
      if (historyIndex === -1) {
        // Save current draft before navigating away
        currentDraft = view.state.doc.toString();
      }
      historyIndex++;
      bridge.setContent(history[historyIndex].content);
      return true;
    }
  } else {
    // Navigate to newer history
    if (historyIndex > -1) {
      historyIndex--;
      if (historyIndex === -1) {
        // Back to current draft
        bridge.setContent(currentDraft);
      } else {
        bridge.setContent(history[historyIndex].content);
      }
      return true;
    }
  }
  return false;
}

function resetHistoryNavigation() {
  historyIndex = -1;
  currentDraft = '';
}

const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

const state = EditorState.create({
  doc: savedDraft,
  extensions: [
    history(),
    bracketMatching(),
    closeBrackets(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    markdown({ base: markdownLanguage, codeLanguages: languages }),
    // File reference extensions
    autocompletion({
      override: [fileReferenceCompletion],
      defaultKeymap: true,
      closeOnBlur: false,
    }),
    fileReferenceDecorator,
    fileReferenceClickHandler,
    fileReferenceHover,
    keymap.of([
      ...defaultKeymap,
      ...historyKeymap,
      ...filePickerKeymap,
      {
        key: 'Mod-Enter',
        run: () => {
          const content = bridge.getContent();
          if (!content.trim()) return true;
          showConfirmDialog(content);
          return true;
        },
      },
      {
        key: 'Mod-Shift-Enter',
        run: () => {
          // Quick send to default target without confirmation
          const content = bridge.getContent();
          if (!content.trim()) return true;
          bridge.send().catch((e: Error) => console.error('Send failed:', e));
          resetHistoryNavigation();
          return true;
        },
      },
      {
        key: 'Mod-Shift-KeyC',
        run: () => {
          // Copy to clipboard shortcut (Cmd+Shift+C)
          bridge.copy().then(success => {
            showToast(success ? 'Copied to clipboard!' : 'Failed to copy');
          });
          return true;
        },
      },
      {
        key: 'Mod-Shift-1',
        run: () => {
          // Send to Claude
          const content = bridge.getContent();
          if (!content.trim()) return true;
          bridge.send('claude').catch((e: Error) => console.error('Send failed:', e));
          resetHistoryNavigation();
          showToast('Sent to Claude Code');
          return true;
        },
      },
      {
        key: 'Mod-Shift-2',
        run: () => {
          // Send to Codex
          const content = bridge.getContent();
          if (!content.trim()) return true;
          bridge.send('codex').catch((e: Error) => console.error('Send failed:', e));
          resetHistoryNavigation();
          showToast('Sent to Codex CLI');
          return true;
        },
      },
      {
        key: 'Mod-Shift-3',
        run: () => {
          // Send to Kimi
          const content = bridge.getContent();
          if (!content.trim()) return true;
          bridge.send('kimi').catch((e: Error) => console.error('Send failed:', e));
          resetHistoryNavigation();
          showToast('Sent to Kimi CLI');
          return true;
        },
      },
      {
        key: 'Mod-Shift-4',
        run: () => {
          // Send to Cursor
          const content = bridge.getContent();
          if (!content.trim()) return true;
          bridge.send('cursor').catch((e: Error) => console.error('Send failed:', e));
          resetHistoryNavigation();
          showToast('Sent to Cursor');
          return true;
        },
      },
      {
        key: 'Escape',
        run: () => {
          // Check if template panel is open
          const templatePanel = document.getElementById('template-panel');
          if (templatePanel?.classList.contains('open')) {
            hideTemplatePanel();
            return true;
          }
          bridge.hide();
          return true;
        },
      },
      {
        key: 'Mod-Shift-t',
        run: () => {
          showTemplatePanel();
          return true;
        },
      },
      {
        key: 'ArrowUp',
        run: (view) => {
          // Only trigger at first line start
          const state = view.state;
          const selection = state.selection.main;
          const line = state.doc.lineAt(selection.from);
          const isFirstLine = line.number === 1;
          const isAtLineStart = selection.from === line.from && selection.to === line.from;
          if (isFirstLine && isAtLineStart) {
            return navigateHistory(view, 'up');
          }
          return false;
        },
      },
      {
        key: 'ArrowDown',
        run: (view) => {
          // Only trigger at last line end
          const state = view.state;
          const selection = state.selection.main;
          const line = state.doc.lineAt(selection.from);
          const isLastLine = line.number === state.doc.lines;
          const isAtLineEnd = selection.from === line.to && selection.to === line.to;
          if (isLastLine && isAtLineEnd) {
            return navigateHistory(view, 'down');
          }
          return false;
        },
      },
    ]),
    placeholder('Write your prompt here... (Markdown supported, @ to reference files)'),
    isDark ? darkTheme : lightTheme,
    EditorView.lineWrapping,
    autoSave,
    imagePasteHandler(),
  ],
});

const view = new EditorView({
  state,
  parent: document.getElementById('editor-container')!,
});

// Expose to bridge
bridge.init(view);

// Toast notification
function showToast(message: string) {
  const toast = document.getElementById('toast')!;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2000);
}

// Send confirmation dialog
const confirmDialog = document.getElementById('confirm-dialog')!;
const confirmPreview = document.getElementById('confirm-preview')!;
const confirmTargetSelect = document.getElementById('confirm-target') as HTMLSelectElement;
const confirmInlineFiles = document.getElementById('confirm-inline-files') as HTMLInputElement;
const btnCancelSend = document.getElementById('btn-cancel-send')!;
const btnConfirmSend = document.getElementById('btn-confirm-send')!;
let pendingSendContent = '';
let pendingConvertedContent = '';

async function showConfirmDialog(content: string) {
  pendingSendContent = content;
  
  // Populate target select
  const targets = bridge.getAvailableTargets();
  const currentTarget = bridge.getDefaultTarget();
  confirmTargetSelect.innerHTML = targets.map(t => 
    `<option value="${t.id}"${t.id === currentTarget ? ' selected' : ''}>${t.name}</option>`
  ).join('');
  
  // 根据 Agent 设置默认的内联选项
  const agentConfigs = bridge.getAgentConfigs();
  const selectedConfig = agentConfigs.find(a => a.id === currentTarget);
  if (confirmInlineFiles && selectedConfig) {
    confirmInlineFiles.checked = selectedConfig.defaultIncludeContent;
  }
  
  // 预览转换后的内容
  await updatePreview();
  
  confirmDialog.classList.add('show');
  btnConfirmSend.focus();
}

async function updatePreview() {
  if (!pendingSendContent) return;
  
  const target = confirmTargetSelect.value as any;
  const inlineFiles = confirmInlineFiles?.checked ?? false;
  
  // 设置格式转换选项
  bridge.setFormatOptions({ 
    format: target,
    includeContent: inlineFiles 
  });
  
  // 转换内容
  pendingConvertedContent = await bridge.convertForTarget(pendingSendContent, target);
  
  // 显示预览
  const preview = pendingConvertedContent.slice(0, 500) + 
    (pendingConvertedContent.length > 500 ? '\n...' : '');
  confirmPreview.textContent = preview;
}

function hideConfirmDialog() {
  confirmDialog.classList.remove('show');
  pendingSendContent = '';
  view.focus();
}

async function confirmSend() {
  if (pendingSendContent) {
    const target = confirmTargetSelect.value as any;
    const inlineFiles = confirmInlineFiles?.checked ?? false;
    
    // 设置格式转换选项
    bridge.setFormatOptions({ 
      format: target,
      includeContent: inlineFiles 
    });
    
    await bridge.sendContent(pendingSendContent, target);
    bridge.setDefaultTarget(target);
    resetHistoryNavigation();
    hideConfirmDialog();
  }
}

btnCancelSend.addEventListener('click', hideConfirmDialog);
btnConfirmSend.addEventListener('click', () => confirmSend());

// Handle target change - update preview
confirmTargetSelect.addEventListener('change', async () => {
  const target = confirmTargetSelect.value as any;
  const agentConfigs = bridge.getAgentConfigs();
  const selectedConfig = agentConfigs.find(a => a.id === target);
  
  // Update inline checkbox based on agent preference
  if (confirmInlineFiles && selectedConfig) {
    confirmInlineFiles.checked = selectedConfig.defaultIncludeContent;
  }
  
  await updatePreview();
});

// Handle inline files checkbox change
if (confirmInlineFiles) {
  confirmInlineFiles.addEventListener('change', () => updatePreview());
}

// Handle Enter/Escape in dialog
confirmDialog.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    await confirmSend();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    hideConfirmDialog();
  }
});

// Target select in toolbar
document.getElementById('target-select')!.addEventListener('change', (e) => {
  const target = (e.target as HTMLSelectElement).value as any;
  bridge.setDefaultTarget(target);
});

// Toolbar buttons
document.getElementById('btn-send')!.addEventListener('click', () => {
  const content = bridge.getContent();
  if (!content.trim()) return;
  showConfirmDialog(content);
});
document.getElementById('btn-copy')!.addEventListener('click', async () => {
  const success = await bridge.copy();
  showToast(success ? 'Copied to clipboard!' : 'Failed to copy');
});
document.getElementById('btn-clear')!.addEventListener('click', () => {
  bridge.clear();
  resetHistoryNavigation();
});
document.getElementById('btn-history')!.addEventListener('click', () => bridge.showHistory());
document.getElementById('btn-close-history')!.addEventListener('click', () => bridge.hideHistory());

// File reference button
document.getElementById('btn-files')?.addEventListener('click', () => {
  showFilePicker({ view });
});

// Workspace buttons
document.getElementById('btn-workspace')?.addEventListener('click', async () => {
  const success = await bridge.switchWorkspace();
  if (success) {
    updateWorkspaceBar();
    showToast('Workspace changed');
  }
});

document.getElementById('btn-switch-workspace')?.addEventListener('click', async () => {
  const success = await bridge.switchWorkspace();
  if (success) {
    updateWorkspaceBar();
    showToast('Workspace changed');
  }
});

document.getElementById('btn-rescan-workspace')?.addEventListener('click', async () => {
  const success = await bridge.rescanWorkspace();
  if (success) {
    showToast('Workspace rescanned');
  } else {
    showToast('No workspace selected');
  }
});

// Update workspace bar UI
function updateWorkspaceBar() {
  const workspace = bridge.getCurrentWorkspace();
  const workspaceInfo = document.getElementById('workspace-info');
  if (workspaceInfo) {
    if (workspace) {
      workspaceInfo.textContent = `📂 ${workspace.name} (${workspace.path})`;
      workspaceInfo.classList.add('has-workspace');
    } else {
      workspaceInfo.textContent = 'No workspace selected';
      workspaceInfo.classList.remove('has-workspace');
    }
  }
}

// Initialize workspace bar
updateWorkspaceBar();

// Save button in toolbar - directly save without dialog
document.getElementById('btn-save')!.addEventListener('click', () => {
  const content = bridge.getContent();
  if (!content.trim()) return;
  // Save with empty name - user can edit it later in the history list
  bridge.saveToHistory(content, '');
  resetHistoryNavigation();
});

// Template button
document.getElementById('btn-templates')!.addEventListener('click', () => {
  showTemplatePanel();
});

// Initialize template UI
initTemplateUI(view);
initTemplateManagerUI();

// History search and filters
const searchInput = document.getElementById('search-input') as HTMLInputElement;
const filterAllBtn = document.getElementById('filter-all')!;
const filterFavoritesBtn = document.getElementById('filter-favorites')!;
let currentFilter: 'all' | 'favorites' = 'all';

function updateHistoryDisplay() {
  const query = searchInput.value;
  let items = bridge.searchHistory(query);
  
  if (currentFilter === 'favorites') {
    items = items.filter(item => item.isFavorite);
  }
  
  bridge.renderHistory(items);
}

searchInput.addEventListener('input', updateHistoryDisplay);

filterAllBtn.addEventListener('click', () => {
  currentFilter = 'all';
  filterAllBtn.classList.add('active');
  filterFavoritesBtn.classList.remove('active');
  updateHistoryDisplay();
});

filterFavoritesBtn.addEventListener('click', () => {
  currentFilter = 'favorites';
  filterFavoritesBtn.classList.add('active');
  filterAllBtn.classList.remove('active');
  updateHistoryDisplay();
});

// Initialize target select
const targets = bridge.getAvailableTargets();
const defaultTarget = bridge.getDefaultTarget();
const toolbarSelect = document.getElementById('target-select') as HTMLSelectElement;
if (toolbarSelect) {
  toolbarSelect.innerHTML = targets
    .filter(t => t.id !== 'copy')
    .map(t => `<option value="${t.id}"${t.id === defaultTarget ? ' selected' : ''}>${t.name}</option>`)
    .join('');
}

// Focus editor on load
view.focus();

// Global keyboard shortcut handler (as fallback for CodeMirror keymap)
document.addEventListener('keydown', async (e) => {
  // Cmd+Shift+C / Ctrl+Shift+C for copy entire content
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'c' || e.key === 'C')) {
    e.preventDefault();
    const success = await bridge.copy();
    showToast(success ? 'Copied to clipboard!' : 'Failed to copy');
  }
});

// Ensure copy/cut/paste work in WebView
document.addEventListener('copy', (e) => {
  // Let the browser handle the copy event for selected text
  // This ensures Cmd+C works for text selection
  console.log('Copy event triggered');
});

document.addEventListener('cut', (e) => {
  console.log('Cut event triggered');
});

document.addEventListener('paste', (e) => {
  console.log('Paste event triggered');
});
