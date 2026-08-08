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
import { 
  templateEditMode, 
  isTemplateEditMode, 
  setTemplateEditMode, 
  fillTemplateAndExit,
  getFilledContent,
} from './template-edit-mode';
import { showSnippetWheel, hideSnippetWheel, isSnippetWheelVisible } from './snippet-wheel';
import { snippetManagerUI } from './snippet-manager-ui';
import type { Snippet } from './snippet-manager';
import { aiAutocomplete } from './ai-autocomplete';
import { enhancePrompt } from './ai-enhance';
import { showAISettingsModal } from './ai-config';
import { historyStore } from './history-store';
import { initPromptMemoryUI } from './prompt-memory-ui';
import { SEND_FEATURE_ENABLED, hideSendFeatureUI } from './send-feature';

const STORAGE_KEY = 'promptEditor:draft';

hideSendFeatureUI(document);

void historyStore.init().then(() => {
  bridge.renderHistory();
}).catch(error => console.error('Failed to initialize history store:', error));

// Diagnostic function for debugging
(window as any).diagnosticSnippetManager = () => {
  console.log("=== Snippet Manager Diagnostic ===");

  const logsBtn = document.getElementById('btn-logs');
  const overlay = document.querySelector('.snippet-manager-overlay');

  const report = {
    uiOpen: !!overlay,
    logsButtonExists: !!logsBtn,
    logsButtonHTML: logsBtn?.outerHTML,
    toolbarHTML: document.querySelector('.snippet-manager-toolbar')?.innerHTML?.substring(0, 200),
    currentView: snippetManagerUI['currentView'],
    overlayState: !!snippetManagerUI['overlay']
  };

  console.log("Diagnostic Report:", report);

  if (!logsBtn && overlay) {
    console.error("❌ Logs button NOT found, but UI is open!");
    console.log("Attempting to manually add logs button...");

    const toolbar = document.querySelector('.snippet-manager-toolbar');
    if (toolbar) {
      const spacer = toolbar.querySelector('.toolbar-spacer');
      if (spacer) {
        const logsButton = document.createElement('button');
        logsButton.className = 'btn btn-icon';
        logsButton.id = 'btn-logs';
        logsButton.title = 'View Logs';
        logsButton.textContent = '📋';
        logsButton.onclick = () => {
          console.log('[Manual] Logs button clicked');
          snippetManagerUI['showLogsView']();
        };
        spacer.after(logsButton);
        console.log("✓ Logs button manually added");
      }
    }
  }

  return report;
};

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
      ...(SEND_FEATURE_ENABLED ? [
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
      ] : []),
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
      ...(SEND_FEATURE_ENABLED ? [
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
      ] : []),
      {
        key: 'Escape',
        run: () => {
          // Check if snippet wheel is open
          if (isSnippetWheelVisible()) {
            hideSnippetWheel();
            return true;
          }
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
        key: 'Mod-Shift-s',
        run: () => {
          // Show snippet wheel (Cmd+Shift+S / Ctrl+Shift+S)
          showSnippetWheel(view, (snippet: Snippet) => {
            const { from } = view.state.selection.main;
            view.dispatch({
              changes: { from, insert: snippet.content }
            });
            showToast(`Inserted: ${snippet.name}`);
          });
          return true;
        },
      },
      {
        key: 'Mod-Shift-m',
        run: () => {
          // Toggle template edit mode
          const isActive = isTemplateEditMode(view.state);
          setTemplateEditMode(view, !isActive);
          updateTemplateModeButton();
          return true;
        },
      },
      {
        key: 'Mod-Shift-e',
        run: () => {
          enhancePrompt(view);
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
    ...templateEditMode(),
    ...aiAutocomplete(),
  ],
});

const view = new EditorView({
  state,
  parent: document.getElementById('editor-container')!,
});

// Expose to bridge
bridge.init(view);

const accessibilityBanner = document.getElementById('accessibility-permission-banner');
const accessibilityMessage = document.getElementById('accessibility-permission-message');
const openAccessibilitySettingsButton = document.getElementById('btn-open-accessibility-settings');
const restartAfterAccessibilityButton = document.getElementById('btn-restart-after-accessibility');

(window as any).promptEditorPermissionStatus = (trusted: boolean, requiresRestart: boolean) => {
  if (!accessibilityBanner || !accessibilityMessage) return;
  accessibilityBanner.hidden = trusted && !requiresRestart;
  if (trusted && requiresRestart) {
    accessibilityMessage.textContent = 'Accessibility permission is enabled. Restart Prompt Editor to apply it.';
    if (restartAfterAccessibilityButton) restartAfterAccessibilityButton.hidden = false;
    if (openAccessibilitySettingsButton) openAccessibilitySettingsButton.hidden = true;
  } else if (!trusted) {
    accessibilityMessage.textContent = 'Accessibility permission is required to paste into the previous app.';
    if (restartAfterAccessibilityButton) restartAfterAccessibilityButton.hidden = true;
    if (openAccessibilitySettingsButton) openAccessibilitySettingsButton.hidden = false;
  }
};

openAccessibilitySettingsButton?.addEventListener('click', () => bridge.openAccessibilitySettings());
restartAfterAccessibilityButton?.addEventListener('click', () => bridge.restartApp());

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
  
  // Sync confirm dialog selection with toolbar selection
  const toolbarSelect = document.getElementById('target-select') as HTMLSelectElement;
  if (toolbarSelect && confirmTargetSelect) {
    confirmTargetSelect.value = toolbarSelect.value;
  }
  
  // If current selection is not valid, fall back to default
  const currentValue = confirmTargetSelect.value;
  const agents = (window as any).__runningAgents || [];
  const isValidSelection = agents.some((a: any) => a.id === currentValue) || 
                           currentValue === 'default' || 
                           currentValue === 'copy';
  if (!isValidSelection) {
    confirmTargetSelect.value = 'default';
  }
  
  // 根据 Agent 设置默认的内联选项
  const agentConfigs = bridge.getAgentConfigs();
  const selectedConfig = agentConfigs.find(a => a.id === currentValue);
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

// Target select in toolbar - save the selected agent ID
const toolbarSelect = document.getElementById('target-select') as HTMLSelectElement;
toolbarSelect?.addEventListener('change', (e) => {
  const selectedValue = (e.target as HTMLSelectElement).value;
  // If it's an agent ID (contains hyphen with PID), extract the type for format conversion
  // but save the full ID for precise targeting
  if (selectedValue.includes('-')) {
    const agentType = selectedValue.split('-')[0];
    bridge.setDefaultTarget(selectedValue); // Save full agent ID
  } else {
    bridge.setDefaultTarget(selectedValue);
  }
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
document.getElementById('btn-paste-previous')?.addEventListener('click', async () => {
  const result = await bridge.pasteToPrevious();
  showToast(result.message);
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

// Clear workspace button
document.getElementById('btn-clear-workspace')?.addEventListener('click', async () => {
  bridge.setWorkspace('', '');
  updateWorkspaceBar();
  showToast('Workspace cleared');
});

// Workspace history dropdown
document.getElementById('workspace-history-select')?.addEventListener('change', async (e) => {
  const select = e.target as HTMLSelectElement;
  const path = select.value;
  if (!path) return;
  
  const success = await bridge.setWorkspace(path);
  if (success) {
    updateWorkspaceBar();
    showToast('Workspace changed');
  } else {
    showToast('Failed to set workspace');
  }
  // Reset select to default option
  select.value = '';
});

// Update workspace bar UI
function updateWorkspaceBar() {
  const workspace = bridge.getCurrentWorkspace();
  const workspaceCurrent = document.getElementById('workspace-current');
  const workspaceInfo = document.getElementById('workspace-info');
  
  if (workspaceCurrent) {
    if (workspace) {
      workspaceCurrent.textContent = `📂 ${workspace.name}`;
      workspaceCurrent.title = workspace.path;
    } else {
      workspaceCurrent.textContent = 'No workspace selected';
      workspaceCurrent.title = '';
    }
  }
  
  if (workspaceInfo) {
    if (workspace) {
      workspaceInfo.classList.add('has-workspace');
    } else {
      workspaceInfo.classList.remove('has-workspace');
    }
  }
  
  // Update workspace history dropdown
  updateWorkspaceHistoryDropdown();
}

// Update workspace history dropdown
function updateWorkspaceHistoryDropdown() {
  const select = document.getElementById('workspace-history-select') as HTMLSelectElement;
  if (!select) return;
  
  const recentWorkspaces = bridge.getRecentWorkspaces();
  const currentWorkspace = bridge.getCurrentWorkspace();
  
  // Clear existing options except the first one
  while (select.options.length > 1) {
    select.remove(1);
  }
  
  // Add recent workspaces
  if (recentWorkspaces.length > 0) {
    recentWorkspaces.forEach(ws => {
      const option = document.createElement('option');
      option.value = ws.path;
      option.textContent = `📁 ${ws.name}`;
      option.title = ws.path;
      if (currentWorkspace && currentWorkspace.path === ws.path) {
        option.selected = true;
      }
      select.appendChild(option);
    });
  } else {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No recent workspaces';
    option.disabled = true;
    select.appendChild(option);
  }
}

// Initialize workspace bar
updateWorkspaceBar();

// Initialize workspace history dropdown
updateWorkspaceHistoryDropdown();

// Save button in toolbar - directly save without dialog
document.getElementById('btn-save')!.addEventListener('click', () => {
  const content = bridge.getContent();
  if (!content.trim()) return;
  // Save with empty name - user can edit it later in the history list
  bridge.saveToHistory(content, '');
  resetHistoryNavigation();
});

// AI Enhance button
document.getElementById('btn-ai-enhance')?.addEventListener('click', () => {
  enhancePrompt(view);
});

// AI Settings button
document.getElementById('btn-ai-settings')?.addEventListener('click', () => {
  showAISettingsModal();
});

// Snippets button (CS-style wheel)
document.getElementById('btn-snippets')!.addEventListener('click', () => {
  showSnippetWheel(view, (snippet: Snippet) => {
    const { from } = view.state.selection.main;
    view.dispatch({
      changes: { from, insert: snippet.content }
    });
    showToast(`Inserted: ${snippet.name}`);
  });
});

// Snippet Manager - Shift+Click on snippets button
document.getElementById('btn-snippets')!.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  snippetManagerUI.open();
});

// Template button
document.getElementById('btn-templates')!.addEventListener('click', () => {
  showTemplatePanel();
});

// Template mode button
const templateModeBtn = document.getElementById('btn-template-mode')!;
const templateModeIndicator = document.getElementById('template-mode-indicator')!;

function updateTemplateModeButton(): void {
  const isActive = isTemplateEditMode(view.state);
  if (isActive) {
    templateModeBtn.classList.add('active');
    templateModeBtn.textContent = '🎨 Mode: ON';
    document.body.classList.add('template-mode-active');
    templateModeIndicator.classList.add('show');
  } else {
    templateModeBtn.classList.remove('active');
    templateModeBtn.textContent = '🎨 Mode';
    document.body.classList.remove('template-mode-active');
    templateModeIndicator.classList.remove('show');
  }
}

templateModeBtn.addEventListener('click', () => {
  const isActive = isTemplateEditMode(view.state);
  setTemplateEditMode(view, !isActive);
  updateTemplateModeButton();
});

// Fill template button (convert placeholders to values)
document.getElementById('btn-fill-template')?.addEventListener('click', () => {
  if (isTemplateEditMode(view.state)) {
    fillTemplateAndExit(view);
    updateTemplateModeButton();
    showToast('Template filled');
  }
});

// Exit template mode button
document.getElementById('btn-exit-template-mode')?.addEventListener('click', () => {
  setTemplateEditMode(view, false);
  updateTemplateModeButton();
});

// Initialize template UI
initTemplateUI(view);
initTemplateManagerUI();
initPromptMemoryUI();

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

// Update agent select dropdown with running agents
async function updateAgentSelect(agents?: any[]) {
  const toolbarSelect = document.getElementById('target-select') as HTMLSelectElement;
  const confirmSelect = document.getElementById('confirm-target') as HTMLSelectElement;
  
  if (!agents) {
    agents = await bridge.getRunningAgents();
  }
  
  // DEBUG: Log detected agents
  console.log('[updateAgentSelect] Detected agents:', agents);
  if (agents.length > 0) {
    showToast(`Detected ${agents.length} agents: ${agents.map((a: any) => `${a.type}(${a.terminalApp || '?'})`).join(', ')}`);
  }
  
  // Remember current selection before updating
  const toolbarCurrentValue = toolbarSelect?.value;
  const confirmCurrentValue = confirmSelect?.value;
  
  // Check if current selection is still valid (agent still exists)
  const currentAgentStillExists = agents.some((a: any) => a.id === toolbarCurrentValue);
  const selectionToKeep = currentAgentStillExists ? toolbarCurrentValue : null;
  
  // Store agents for later lookup
  (window as any).__runningAgents = agents;
  
  // Determine which value should be selected
  // Priority: 1) Keep current selection if still valid, 2) Use defaultTarget if valid, 3) 'default'
  const targetToSelect = selectionToKeep 
    || (agents.some((a: any) => a.id === bridge.getDefaultTarget()) ? bridge.getDefaultTarget() : null)
    || 'default';
  
  // Build options
  let options = '<option value="default">🖥️ Default Terminal</option>';
  
  if (agents.length > 0) {
    // Group agents by type
    const grouped = new Map<string, any[]>();
    for (const agent of agents) {
      const list = grouped.get(agent.type) || [];
      list.push(agent);
      grouped.set(agent.type, list);
    }
    
    // Add agents grouped by type
    for (const [type, typeAgents] of grouped) {
      if (typeAgents.length === 1) {
        // Single agent of this type
        const agent = typeAgents[0];
        const icon = getAgentIcon(agent.type);
        const selected = agent.id === targetToSelect ? ' selected' : '';
        const details = formatAgentDetails(agent);
        options += `<option value="${agent.id}"${selected}>${icon} ${agent.name}${details}</option>`;
      } else {
        // Multiple agents of same type - use optgroup
        options += `<optgroup label="${getAgentIcon(type)} ${getAgentTypeName(type)} (${typeAgents.length})">`;
        for (const agent of typeAgents) {
          const selected = agent.id === targetToSelect ? ' selected' : '';
          const details = formatAgentDetails(agent);
          options += `<option value="${agent.id}"${selected}>  ${agent.name}${details}</option>`;
        }
        options += '</optgroup>';
      }
    }
  }
  
  options += '<optgroup label="Other">';
  options += '<option value="copy">📋 Copy Only</option>';
  options += '</optgroup>';
  
  if (toolbarSelect) {
    toolbarSelect.innerHTML = options;
  }
  if (confirmSelect) {
    confirmSelect.innerHTML = options;
  }
}

function getAgentTypeName(type: string): string {
  const names: Record<string, string> = {
    claude: 'Claude Code',
    kimi: 'Kimi CLI',
    codex: 'Codex CLI',
    cursor: 'Cursor',
    warp: 'Warp',
    unknown: 'Unknown'
  };
  return names[type] || type;
}

function formatAgentDetails(agent: any): string {
  const parts: string[] = [];
  if (agent.workingDirectory) {
    parts.push(agent.workingDirectory);
  } else if (agent.terminalApp) {
    parts.push(agent.terminalApp);
  }
  if (parts.length > 0) {
    return ` — ${parts.join(' • ')}`;
  }
  return '';
}

function getAgentIcon(type: string): string {
  const icons: Record<string, string> = {
    claude: '🤖',
    kimi: '🌙',
    codex: '⚡',
    cursor: '💠',
    warp: '🌀',
    unknown: '🔹'
  };
  return icons[type] || '🔹';
}

// Refresh agents button (manual only)
document.getElementById('btn-refresh-agents')?.addEventListener('click', async () => {
  await updateAgentSelect();
  showToast('Agents refreshed');
});

// Initialize agent select on load (only once)
updateAgentSelect();

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

// Expose snippetManagerUI to global window for native access
(window as any).snippetManagerUI = snippetManagerUI;
