/**
 * Terminal Context Module
 * 
 * Provides access to terminal input/output context from running shells.
 * Supports two capture methods:
 * 1. Shell Integration Hooks - persistent context via Unix socket
 * 2. tmux capture-pane - on-demand capture for tmux sessions
 */

export interface TerminalContextData {
  currentDirectory: string | null;
  lastCommand: string | null;
  lastExitCode: number | null;
  recentOutput: string | null;
  lastUpdated: string | null; // ISO 8601
}

export interface ShellIntegrationStatus {
  zsh: boolean;
  bash: boolean;
  fish: boolean;
}

type TerminalContextCallback = (context: TerminalContextData) => void;

let currentContext: TerminalContextData = {
  currentDirectory: null,
  lastCommand: null,
  lastExitCode: null,
  recentOutput: null,
  lastUpdated: null,
};

const listeners: Set<TerminalContextCallback> = new Set();

// Internal callback exposed to native for push updates
function onUpdate(jsonString: string) {
  try {
    const parsed: TerminalContextData = JSON.parse(jsonString);
    currentContext = parsed;
    listeners.forEach(cb => cb(parsed));
  } catch (e) {
    console.error('[terminalContext] Failed to parse update:', e);
  }
}

// Expose to native side via global
if (typeof window !== 'undefined') {
  (window as any).terminalContext = {
    onUpdate,
    getContext: () => currentContext,
  };
}

function postToNative(action: string, data?: Record<string, unknown>): void {
  const message = { action, ...data };
  if (window.webkit?.messageHandlers?.promptEditor) {
    window.webkit.messageHandlers.promptEditor.postMessage(message);
    return;
  }
  console.log('[terminalContext]', message);
}

function createCallback<T>(resolve: (value: T) => void, timeoutMs: number = 5000): string {
  const name = `termCtxCb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  (window as any)[name] = (result: T, error?: string) => {
    delete (window as any)[name];
    if (error) {
      console.error('[terminalContext] Callback error:', error);
      resolve(null as T);
    } else {
      resolve(result);
    }
  };
  setTimeout(() => {
    if ((window as any)[name]) {
      delete (window as any)[name];
      resolve(null as T);
    }
  }, timeoutMs);
  return name;
}

export const terminalContext = {
  /**
   * Get the current accumulated terminal context (from shell hooks).
   * Returns immediately without a native round-trip.
   */
  getCachedContext(): TerminalContextData {
    return currentContext;
  },

  /**
   * Capture terminal context on-demand.
   * For tmux sessions, uses `tmux capture-pane`.
   * For shell hook users, returns the latest accumulated context.
   * 
   * @param maxLines Maximum lines to capture (default 500)
   */
  async capture(maxLines: number = 500): Promise<TerminalContextData | null> {
    return new Promise((resolve) => {
      const isNative = typeof window !== 'undefined' &&
        window.webkit?.messageHandlers?.promptEditor;

      if (!isNative) {
        console.log('[terminalContext] Not in native mode');
        resolve(null);
        return;
      }

      const callback = createCallback<TerminalContextData | null>(resolve, 3000);
      postToNative('captureTerminal', { maxLines, callback });
    });
  },

  /**
   * Install shell integration scripts into ~/.zshrc, ~/.bashrc, etc.
   * Returns success flag and message per shell.
   */
  async installShellIntegration(): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve) => {
      const isNative = typeof window !== 'undefined' &&
        window.webkit?.messageHandlers?.promptEditor;

      if (!isNative) {
        resolve({ success: false, message: 'Not running in native app' });
        return;
      }

      const callback = createCallback<{ success: boolean; message: string }>(resolve, 10000);
      postToNative('installShellIntegration', { callback });
    });
  },

  /**
   * Uninstall shell integration scripts from all shells.
   */
  async uninstallShellIntegration(): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve) => {
      const isNative = typeof window !== 'undefined' &&
        window.webkit?.messageHandlers?.promptEditor;

      if (!isNative) {
        resolve({ success: false, message: 'Not running in native app' });
        return;
      }

      const callback = createCallback<{ success: boolean; message: string }>(resolve, 10000);
      postToNative('uninstallShellIntegration', { callback });
    });
  },

  /**
   * Check installation status of shell integration per shell type.
   */
  async getShellIntegrationStatus(): Promise<ShellIntegrationStatus | null> {
    return new Promise((resolve) => {
      const isNative = typeof window !== 'undefined' &&
        window.webkit?.messageHandlers?.promptEditor;

      if (!isNative) {
        resolve(null);
        return;
      }

      const callback = createCallback<ShellIntegrationStatus | null>(resolve, 3000);
      postToNative('getShellIntegrationStatus', { callback });
    });
  },

  /**
   * Subscribe to terminal context updates (pushed from shell hooks via Unix socket).
   * Returns an unsubscribe function.
   */
  subscribe(callback: TerminalContextCallback): () => void {
    listeners.add(callback);
    // Immediately call with current context
    callback(currentContext);
    return () => {
      listeners.delete(callback);
    };
  },

  /**
   * Check if terminal context is available (has recent data from hooks).
   */
  isAvailable(): boolean {
    return currentContext.lastUpdated !== null &&
      (currentContext.recentOutput !== null || currentContext.currentDirectory !== null);
  },

  /**
   * Format terminal context as a markdown block for inclusion in prompts.
   * Includes CWD, last command, and recent output if available.
   */
  formatAsContext(ctx?: TerminalContextData): string {
    const c = ctx || currentContext;
    const parts: string[] = [];

    if (c.currentDirectory) {
      parts.push(`Current Directory: \`${c.currentDirectory}\``);
    }
    if (c.lastCommand) {
      const exitInfo = c.lastExitCode !== null ? ` (exit: ${c.lastExitCode})` : '';
      parts.push(`Last Command: \`\`\`\n${c.lastCommand}\n\`\`\`${exitInfo}`);
    }
    if (c.recentOutput) {
      const truncated = c.recentOutput.length > 8000
        ? c.recentOutput.slice(0, 8000) + '\n...[truncated]'
        : c.recentOutput;
      parts.push(`Terminal Output:\n\`\`\`\n${truncated}\n\`\`\``);
    }

    if (parts.length === 0) return '';
    return `## Terminal Context\n\n${parts.join('\n\n')}\n`;
  },

  /**
   * Clear cached terminal context.
   */
  clear() {
    currentContext = {
      currentDirectory: null,
      lastCommand: null,
      lastExitCode: null,
      recentOutput: null,
      lastUpdated: null,
    };
    listeners.forEach(cb => cb(currentContext));
  },
};
