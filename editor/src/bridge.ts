import { EditorView } from '@codemirror/view';
import { prepareContentForSend } from './image-paste';
import { fileReferenceManager } from './file-reference';
import { 
  formatConverter, 
  FormatOptions, 
  AgentFormat, 
  getRecommendedOptions,
  previewConversion 
} from './format-converter';
import { workspaceManager, Workspace } from './workspace-manager';
import { terminalContext, TerminalContextData, ShellIntegrationStatus } from './terminal-context';
import { historyStore, HistoryItem } from './history-store';
import { createNativeClient } from './platform/create-native-client';
import {
  NativeClientError,
  type DetectedAgent,
  type NativeClient,
} from './platform/native-client';

export type { DetectedAgent } from './platform/native-client';

// Target types for sending (can be agent ID like 'claude-12345')
type SendTarget = 'default' | 'claude' | 'codex' | 'kimi' | 'cursor' | 'copy' | string;

// Target configuration
interface TargetConfig {
  id: SendTarget;
  name: string;
  shortcut?: string;
}

// Available targets
const AVAILABLE_TARGETS: TargetConfig[] = [
  { id: 'default', name: 'Default Terminal', shortcut: '⌘↵' },
  { id: 'claude', name: 'Claude Code', shortcut: '⌘⇧1' },
  { id: 'codex', name: 'Codex CLI', shortcut: '⌘⇧2' },
  { id: 'kimi', name: 'Kimi CLI', shortcut: '⌘⇧3' },
  { id: 'cursor', name: 'Cursor', shortcut: '⌘⇧4' },
  { id: 'copy', name: 'Copy Only', shortcut: '⌘⇧C' },
];

const TARGET_STORAGE_KEY = 'promptEditor:defaultTarget';

function getDefaultTarget(): string {
  const saved = localStorage.getItem(TARGET_STORAGE_KEY);
  if (!saved) return 'default';
  
  // Check if it's a known target type
  if (AVAILABLE_TARGETS.find(t => t.id === saved)) {
    return saved;
  }
  
  // Check if it's an agent ID (format: type-PID)
  if (saved.includes('-')) {
    return saved;
  }
  
  return 'default';
}

function setDefaultTarget(target: string) {
  localStorage.setItem(TARGET_STORAGE_KEY, target);
}

interface NativeBridge {
  send: (target?: SendTarget) => Promise<void>;
  sendContent: (content: string, target?: SendTarget) => Promise<void>;
  copy: () => Promise<boolean>;
  copyToClipboard: (content: string) => Promise<boolean>;
  pasteToPrevious: () => Promise<{ success: boolean; message: string }>;
  openAccessibilitySettings: () => void;
  restartApp: () => void;
  hide: () => void;
  clear: () => void;
  showHistory: () => void;
  hideHistory: () => void;
  getContent: () => string;
  setContent: (text: string) => void;
  init: (view: EditorView) => void;
  getHistory: () => HistoryItem[];
  addToHistory: (content: string, name?: string) => void;
  saveToHistory: (content: string, name?: string) => void;
  loadFromHistory: (id: string) => void;
  deleteHistoryItem: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  updateHistoryItemName: (id: string, name: string) => Promise<void>;
  searchHistory: (query: string) => HistoryItem[];
  renderHistory: (items?: HistoryItem[]) => void;
  getAvailableTargets: () => TargetConfig[];
  getDefaultTarget: () => string;
  setDefaultTarget: (target: string) => void;
  // File reference methods
  scanFolder: (path: string) => Promise<void>;
  showFolderPicker: () => Promise<string | null>;
  getFileReferences: () => Array<{ match: string; path: string; file?: import('./file-reference').FileReference }>;
  readFile: (path: string) => Promise<string | null>;
  // Format conversion methods (Phase 3)
  convertForTarget: (content: string, target: AgentFormat) => Promise<string>;
  previewConversion: (content: string, target: AgentFormat) => string;
  setFormatOptions: (options: Partial<FormatOptions>) => void;
  getFormatOptions: () => FormatOptions;
  getAgentConfigs: () => Array<{ id: AgentFormat; name: string; supportsAtReference: boolean; defaultIncludeContent: boolean; description: string }>;
  // Workspace methods
  setWorkspace: (path: string, name?: string) => Promise<boolean>;
  getCurrentWorkspace: () => Workspace | null;
  switchWorkspace: () => Promise<boolean>;
  rescanWorkspace: () => Promise<boolean>;
  getRecentWorkspaces: () => Workspace[];
  // Running agents methods
  getRunningAgents: () => Promise<DetectedAgent[]>;
  onAgentsUpdated: ((agents: DetectedAgent[]) => void) | null;
  // Template methods
  showTemplates: () => void;
  hideTemplates: () => void;
  // Terminal context methods
  getTerminalContext: () => TerminalContextData;
  captureTerminal: (maxLines?: number) => Promise<TerminalContextData | null>;
  installShellIntegration: () => Promise<{ success: boolean; message: string }>;
  uninstallShellIntegration: () => Promise<{ success: boolean; message: string }>;
  getShellIntegrationStatus: () => Promise<ShellIntegrationStatus | null>;
  formatTerminalContext: () => string;
  onTerminalContextUpdate: ((context: TerminalContextData) => void) | null;
  // Prompt memory methods
  showPromptMemoryScanner: () => void;
}

let editorView: EditorView | null = null;
let selectedNativeClient: NativeClient | null = null;

function nativeClient(): NativeClient {
  selectedNativeClient ??= createNativeClient();
  return selectedNativeClient;
}

function logNativeError(context: string, error: unknown): void {
  if (error instanceof NativeClientError) {
    console.error(`${context}: [${error.code}] ${error.message}`);
  } else {
    console.error(`${context}: Native operation failed`);
  }
}

export const bridge: NativeBridge = {
  init(view: EditorView) {
    editorView = view;
    // Expose API to native shell
    (window as any).promptEditor = {
      getContent: () => bridge.getContent(),
      setContent: (text: string) => bridge.setContent(text),
      focus: () => view.focus(),
    };
    // Subscribe to terminal context updates and forward to bridge callback
    terminalContext.subscribe((ctx) => {
      if (bridge.onTerminalContextUpdate) {
        bridge.onTerminalContextUpdate(ctx);
      }
    });
  },

  getContent(): string {
    if (!editorView) return '';
    return editorView.state.doc.toString();
  },

  setContent(text: string) {
    if (!editorView) return;
    editorView.dispatch({
      changes: {
        from: 0,
        to: editorView.state.doc.length,
        insert: text,
      },
    });
  },

  async send(target?: SendTarget): Promise<void> {
    const content = bridge.getContent();
    await bridge.sendContent(content, target);
  },

  async sendContent(content: string, target?: string) {
    if (!content.trim()) return;
    
    const effectiveTarget = target || getDefaultTarget();
    
    // Check if target is an agent ID (contains hyphen with PID)
    let agentType = effectiveTarget;
    let agentInfo: DetectedAgent | undefined;
    
    const agents = (window as any).__runningAgents as DetectedAgent[] || [];
    
    if (agents.length > 0) {
      const matchedAgent = agents.find(a => a.id === effectiveTarget);
      if (matchedAgent) {
        agentType = matchedAgent.type;
        agentInfo = matchedAgent;
      }
    }
    
    // Keep send quiet; tests and production WKWebView should not expose prompt routing details.
    
    // 转换文件引用格式 (use agent type for format conversion)
    const convertedContent = await bridge.convertForTarget(content, agentType as AgentFormat);
    const resolvedContent = prepareContentForSend(convertedContent);
    
    bridge.addToHistory(content);
    localStorage.removeItem('promptEditor:draft');
    
    if (effectiveTarget === 'copy') {
      // Copy mode - just copy to clipboard without typing
      await bridge.copyToClipboard(resolvedContent);
    } else {
      // Send with agent info for precise targeting
      await nativeClient().send({
        content: resolvedContent,
        target: agentType,
        agentId: agentInfo?.id,
        pid: agentInfo?.pid,
        terminalApp: agentInfo?.terminalApp,
      });
    }
  },

  /**
   * 转换内容为指定 Agent 格式
   */
  async convertForTarget(content: string, target: AgentFormat): Promise<string> {
    // 根据目标 Agent 设置推荐选项
    const recommendedOptions = getRecommendedOptions(target);
    formatConverter.setOptions({ 
      format: target, 
      ...recommendedOptions,
    });
    
    return await formatConverter.convert(content, target);
  },

  /**
   * 预览转换结果
   */
  previewConversion(content: string, target: AgentFormat): string {
    return previewConversion(content, target);
  },

  /**
   * 设置格式转换选项
   */
  setFormatOptions(options: Partial<FormatOptions>) {
    formatConverter.setOptions(options);
  },

  /**
   * 获取当前格式转换选项
   */
  getFormatOptions(): FormatOptions {
    return formatConverter.getOptions();
  },

  /**
   * 获取支持的 Agent 格式列表
   */
  getAgentConfigs() {
    return formatConverter.getAllAgentConfigs();
  },

  async copy(): Promise<boolean> {
    const content = bridge.getContent();
    return await bridge.copyToClipboard(content);
  },

  async copyToClipboard(content: string): Promise<boolean> {
    if (!content.trim()) return false;
    const resolvedContent = prepareContentForSend(content);

    try {
      await nativeClient().writeClipboard(resolvedContent);
      return true;
    } catch (error) {
      logNativeError('Failed to copy', error);
      return false;
    }
  },

  async pasteToPrevious(): Promise<{ success: boolean; message: string }> {
    const content = bridge.getContent();
    if (!content.trim()) return { success: false, message: 'Nothing to paste' };

    const resolvedContent = prepareContentForSend(content);
    try {
      return await nativeClient().pasteToPrevious(resolvedContent);
    } catch (error) {
      if (error instanceof NativeClientError) {
        if (error.code === 'unsupported') {
          return { success: false, message: 'Paste to last position is only available on macOS' };
        }
        if (error.code === 'timeout') {
          return { success: false, message: 'No response from macOS paste service' };
        }
      }
      logNativeError('Paste to last position failed', error);
      return { success: false, message: 'Paste to last position failed' };
    }
  },

  openAccessibilitySettings() {
    void nativeClient().openAccessibilitySettings().catch((error) => {
      logNativeError('Failed to open accessibility settings', error);
    });
  },

  restartApp() {
    void nativeClient().restartApp().catch((error) => {
      logNativeError('Failed to restart app', error);
    });
  },

  getHistory(): HistoryItem[] {
    return historyStore.getHistory();
  },

  addToHistory(content: string, name?: string) {
    void historyStore.add(content, name).catch(error => console.error('Failed to add history:', error));
  },

  saveToHistory(content: string, name?: string) {
    // Save to history without sending (used by Save button)
    if (!content.trim()) return;
    void historyStore.add(content, name).then(() => {
      // Clear the editor
      bridge.setContent('');
      localStorage.removeItem('promptEditor:draft');
    }).catch(error => console.error('Failed to save history:', error));
  },

  loadFromHistory(id: string) {
    const history = historyStore.getHistory();
    const item = history.find(h => h.id === id);
    if (item && editorView) {
      bridge.setContent(item.content);
      bridge.hideHistory();
      editorView.focus();
    }
  },

  async deleteHistoryItem(id: string) {
    await historyStore.delete(id).catch(error => console.error('Failed to delete history:', error));
  },

  async toggleFavorite(id: string) {
    await historyStore.toggleFavorite(id).catch(error => console.error('Failed to update favorite:', error));
  },

  async updateHistoryItemName(id: string, name: string) {
    await historyStore.updateName(id, name).catch(error => console.error('Failed to rename history:', error));
  },

  searchHistory(query: string): HistoryItem[] {
    return historyStore.search(query);
  },

  hide() {
    void nativeClient().hideWindow().catch((error) => {
      logNativeError('Failed to hide window', error);
    });
  },

  getAvailableTargets() {
    return AVAILABLE_TARGETS;
  },

  getDefaultTarget() {
    return getDefaultTarget();
  },

  setDefaultTarget(target: string) {
    setDefaultTarget(target);
  },

  clear() {
    bridge.setContent('');
    localStorage.removeItem('promptEditor:draft');
    editorView?.focus();
  },

  // File Reference methods
  async scanFolder(path: string) {
    await fileReferenceManager.scanFolder(path);
  },

  async showFolderPicker(): Promise<string | null> {
    try {
      return await nativeClient().pickDirectory();
    } catch (error) {
      if (!(error instanceof NativeClientError && error.code === 'unsupported')) {
        logNativeError('Folder picker failed', error);
      }
      return null;
    }
  },

  getFileReferences() {
    const content = bridge.getContent();
    return fileReferenceManager.parseFileReferences(content);
  },
  
  /**
   * 读取文件内容
   */
  async readFile(path: string): Promise<string | null> {
    try {
      return await nativeClient().readFile(path);
    } catch (error) {
      if (!(error instanceof NativeClientError && error.code === 'unsupported')) {
        logNativeError('Read file failed', error);
      }
      return null;
    }
  },

  // Workspace methods
  async setWorkspace(path: string, name?: string): Promise<boolean> {
    return await workspaceManager.setWorkspace(path, name);
  },

  getCurrentWorkspace() {
    return workspaceManager.getCurrentWorkspace();
  },

  async switchWorkspace(): Promise<boolean> {
    return await workspaceManager.switchWorkspace();
  },

  async rescanWorkspace(): Promise<boolean> {
    return await workspaceManager.rescanWorkspace();
  },

  getRecentWorkspaces() {
    return workspaceManager.getRecentWorkspaces();
  },

  async getRunningAgents(): Promise<DetectedAgent[]> {
    try {
      return await nativeClient().listRunningAgents();
    } catch (error) {
      if (!(error instanceof NativeClientError && error.code === 'unsupported')) {
        logNativeError('Get running agents failed', error);
      }
      return [];
    }
  },

  onAgentsUpdated: null as ((agents: DetectedAgent[]) => void) | null,

  // Terminal context methods
  getTerminalContext() {
    return terminalContext.getCachedContext();
  },

  async captureTerminal(maxLines?: number) {
    return await terminalContext.capture(maxLines);
  },

  async installShellIntegration() {
    return await terminalContext.installShellIntegration();
  },

  async uninstallShellIntegration() {
    return await terminalContext.uninstallShellIntegration();
  },

  async getShellIntegrationStatus() {
    return await terminalContext.getShellIntegrationStatus();
  },

  formatTerminalContext() {
    return terminalContext.formatAsContext();
  },

  onTerminalContextUpdate: null as ((context: TerminalContextData) => void) | null,

  showTemplates() {
    const { showTemplatePanel } = require('./template');
    showTemplatePanel();
  },

  hideTemplates() {
    const { hideTemplatePanel } = require('./template');
    hideTemplatePanel();
  },

  showPromptMemoryScanner() {
    window.dispatchEvent(new CustomEvent('prompt-memory:open'));
  },

  showHistory() {
    const historyPanel = document.getElementById('history-panel');
    if (historyPanel) {
      historyPanel.classList.add('open');
      bridge.renderHistory();
    }
  },

  hideHistory() {
    const historyPanel = document.getElementById('history-panel');
    if (historyPanel) {
      historyPanel.classList.remove('open');
    }
  },

  renderHistory(items?: HistoryItem[]) {
    const historyList = document.getElementById('history-list');
    if (!historyList) return;

    const history = items || historyStore.getHistory();
    if (history.length === 0) {
      historyList.innerHTML = '<div class="history-empty">No history yet</div>';
      return;
    }

    historyList.innerHTML = history.map(item => {
      const date = new Date(item.timestamp);
      const timeStr = date.toLocaleString();
      const preview = item.content.slice(0, 100).replace(/\n/g, ' ');
      const hasMore = item.content.length > 100;
      const favoriteClass = item.isFavorite ? ' favorited' : '';
      const favoriteIcon = item.isFavorite ? '★' : '☆';
      // If name is empty, show first line as placeholder
      const displayName = item.name || item.content.split('\n')[0].slice(0, 50) || '(Untitled)';
      const isPlaceholder = !item.name;
      const placeholderClass = isPlaceholder ? ' placeholder' : '';
      return `
        <div class="history-item${favoriteClass}" data-id="${item.id}">
          <div class="history-item-header">
            <span class="history-item-name${placeholderClass}" contenteditable="true" data-id="${item.id}">${escapeHtml(displayName)}</span>
            <button class="history-item-favorite" data-id="${item.id}" title="Toggle Favorite">${favoriteIcon}</button>
          </div>
          <div class="history-item-preview">${escapeHtml(preview)}${hasMore ? '...' : ''}</div>
          <div class="history-item-time">${timeStr}</div>
          <button class="history-item-delete" data-id="${item.id}" title="Delete">×</button>
        </div>
      `;
    }).join('');

    // Add click handlers
    historyList.querySelectorAll('.history-item').forEach(el => {
      const itemEl = el as HTMLElement;
      const id = itemEl.dataset.id!;

      // Click on item to load
      itemEl.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('history-item-delete')) {
          e.stopPropagation();
          void bridge.deleteHistoryItem(id).then(() => bridge.renderHistory());
        } else if (target.classList.contains('history-item-favorite')) {
          e.stopPropagation();
          void bridge.toggleFavorite(id).then(() => bridge.renderHistory());
        } else if (!target.classList.contains('history-item-name')) {
          // Load item if not clicking on editable name
          bridge.loadFromHistory(id);
        }
      });

      // Name edit handler
      const nameEl = itemEl.querySelector('.history-item-name') as HTMLElement;
      if (nameEl) {
        nameEl.addEventListener('focus', () => {
          // Clear placeholder text on focus
          if (nameEl.classList.contains('placeholder')) {
            nameEl.textContent = '';
            nameEl.classList.remove('placeholder');
          }
        });
        nameEl.addEventListener('blur', () => {
          const newName = nameEl.textContent || '';
          void bridge.updateHistoryItemName(id, newName).then(() => bridge.renderHistory());
        });
        nameEl.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            nameEl.blur();
          }
        });
      }
    });
  },
};

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
