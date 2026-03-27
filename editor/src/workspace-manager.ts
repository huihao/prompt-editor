/**
 * Workspace Manager - 工作空间管理
 * 管理当前工作目录，所有文件引用都相对于工作目录
 */

import { fileReferenceManager } from './file-reference';

const WORKSPACE_STORAGE_KEY = 'promptEditor:workspace:v1';
const RECENT_WORKSPACES_KEY = 'promptEditor:recentWorkspaces:v1';
const MAX_RECENT_WORKSPACES = 10;

export interface Workspace {
  path: string;
  name: string;
  lastUsed: number;
}

class WorkspaceManager {
  private currentWorkspace: Workspace | null = null;
  private recentWorkspaces: Workspace[] = [];

  constructor() {
    this.loadFromStorage();
  }

  /**
   * 从 LocalStorage 加载
   */
  private loadFromStorage() {
    try {
      // 加载当前工作空间
      const workspaceData = localStorage.getItem(WORKSPACE_STORAGE_KEY);
      if (workspaceData) {
        this.currentWorkspace = JSON.parse(workspaceData);
      }

      // 加载最近工作空间列表
      const recentData = localStorage.getItem(RECENT_WORKSPACES_KEY);
      if (recentData) {
        this.recentWorkspaces = JSON.parse(recentData);
      }
    } catch (e) {
      console.error('Failed to load workspace:', e);
    }
  }

  /**
   * 保存到 LocalStorage
   */
  private saveToStorage() {
    try {
      if (this.currentWorkspace) {
        localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(this.currentWorkspace));
      } else {
        localStorage.removeItem(WORKSPACE_STORAGE_KEY);
      }
      localStorage.setItem(RECENT_WORKSPACES_KEY, JSON.stringify(this.recentWorkspaces));
    } catch (e) {
      console.error('Failed to save workspace:', e);
    }
  }

  /**
   * 设置当前工作空间
   */
  async setWorkspace(path: string, name?: string): Promise<boolean> {
    if (!path || path.trim() === '') {
      this.clearWorkspace();
      return false;
    }

    const workspaceName = name || this.extractNameFromPath(path);
    
    this.currentWorkspace = {
      path: path.trim(),
      name: workspaceName,
      lastUsed: Date.now(),
    };

    // 添加到最近列表
    this.addToRecent(this.currentWorkspace);

    // 保存
    this.saveToStorage();

    // 自动扫描工作目录
    try {
      await fileReferenceManager.scanFolder(path);
      console.log(`Workspace set to: ${path}`);
      return true;
    } catch (e) {
      console.error('Failed to scan workspace:', e);
      return false;
    }
  }

  /**
   * 获取当前工作空间
   */
  getCurrentWorkspace(): Workspace | null {
    return this.currentWorkspace;
  }

  /**
   * 获取当前工作目录路径
   */
  getCurrentPath(): string | null {
    return this.currentWorkspace?.path || null;
  }

  /**
   * 清除当前工作空间
   */
  clearWorkspace() {
    this.currentWorkspace = null;
    localStorage.removeItem(WORKSPACE_STORAGE_KEY);
    this.saveToStorage();
  }

  /**
   * 获取最近工作空间列表
   */
  getRecentWorkspaces(): Workspace[] {
    return [...this.recentWorkspaces].sort((a, b) => b.lastUsed - a.lastUsed);
  }

  /**
   * 从路径提取名称
   */
  private extractNameFromPath(path: string): string {
    // 移除末尾的斜杠
    path = path.replace(/[/\\]+$/, '');
    
    // 获取最后一部分
    const parts = path.split(/[/\\]/);
    return parts[parts.length - 1] || 'Unknown';
  }

  /**
   * 添加到最近列表
   */
  private addToRecent(workspace: Workspace) {
    // 移除重复项
    this.recentWorkspaces = this.recentWorkspaces.filter(
      w => w.path !== workspace.path
    );

    // 添加到开头
    this.recentWorkspaces.unshift(workspace);

    // 限制数量
    if (this.recentWorkspaces.length > MAX_RECENT_WORKSPACES) {
      this.recentWorkspaces = this.recentWorkspaces.slice(0, MAX_RECENT_WORKSPACES);
    }
  }

  /**
   * 从最近列表移除
   */
  removeFromRecent(path: string) {
    this.recentWorkspaces = this.recentWorkspaces.filter(w => w.path !== path);
    this.saveToStorage();
  }

  /**
   * 计算相对路径（相对于工作目录）
   */
  getRelativePath(absolutePath: string): string {
    const workspacePath = this.currentWorkspace?.path;
    if (!workspacePath) {
      return absolutePath;
    }

    // 标准化路径分隔符
    const normalizedWorkspace = workspacePath.replace(/\\/g, '/');
    const normalizedPath = absolutePath.replace(/\\/g, '/');

    // 如果路径以工作目录开头，移除它
    if (normalizedPath.startsWith(normalizedWorkspace + '/')) {
      return normalizedPath.substring(normalizedWorkspace.length + 1);
    }

    // 如果路径等于工作目录，返回空字符串或 .
    if (normalizedPath === normalizedWorkspace) {
      return '.';
    }

    return absolutePath;
  }

  /**
   * 计算绝对路径
   */
  getAbsolutePath(relativePath: string): string {
    const workspacePath = this.currentWorkspace?.path;
    if (!workspacePath) {
      return relativePath;
    }

    if (relativePath === '.' || relativePath === './') {
      return workspacePath;
    }

    // 移除开头的 ./
    const cleanPath = relativePath.replace(/^\.\//, '');

    // 组合路径
    const separator = workspacePath.includes('\\') ? '\\' : '/';
    return workspacePath + separator + cleanPath;
  }

  /**
   * 检查路径是否在工作空间内
   */
  isInWorkspace(path: string): boolean {
    const workspacePath = this.currentWorkspace?.path;
    if (!workspacePath) {
      return false;
    }

    const normalizedWorkspace = workspacePath.replace(/\\/g, '/').toLowerCase();
    const normalizedPath = path.replace(/\\/g, '/').toLowerCase();

    return normalizedPath.startsWith(normalizedWorkspace);
  }

  /**
   * 格式化显示路径（短名称）
   */
  getDisplayPath(path: string, maxLength: number = 30): string {
    const relativePath = this.getRelativePath(path);
    
    if (relativePath.length <= maxLength) {
      return relativePath;
    }

    // 截断显示
    const parts = relativePath.split(/[/\\]/);
    if (parts.length > 2) {
      return '.../' + parts.slice(-2).join('/');
    }

    return relativePath.substring(0, maxLength - 3) + '...';
  }

  /**
   * 打开工作空间选择器（原生）
   */
  async showWorkspacePicker(): Promise<string | null> {
    return new Promise((resolve) => {
      const isNative = typeof window !== 'undefined' && 
        (window.webkit?.messageHandlers?.promptEditor || 
         (window as any).__TAURI__);

      if (!isNative) {
        // Fallback: 使用 prompt
        const path = prompt('Enter workspace path:');
        resolve(path);
        return;
      }

      const callbackName = `workspaceCallback_${Date.now()}`;
      (window as any)[callbackName] = (result: string | null, error?: string) => {
        delete (window as any)[callbackName];
        if (error) {
          console.error('Workspace picker error:', error);
          resolve(null);
        } else {
          resolve(result);
        }
      };

      if (window.webkit?.messageHandlers?.promptEditor) {
        window.webkit.messageHandlers.promptEditor.postMessage({
          action: 'showFolderPicker',
          callback: callbackName,
        });
      } else if ((window as any).__TAURI__) {
        (window as any).__TAURI__.invoke('pick_folder')
          .then((result: string | null) => (window as any)[callbackName](result))
          .catch((err: Error) => (window as any)[callbackName](null, err.message));
      }

      setTimeout(() => {
        if ((window as any)[callbackName]) {
          delete (window as any)[callbackName];
          resolve(null);
        }
      }, 60000);
    });
  }

  /**
   * 切换工作空间
   */
  async switchWorkspace(): Promise<boolean> {
    const path = await this.showWorkspacePicker();
    if (path) {
      return await this.setWorkspace(path);
    }
    return false;
  }

  /**
   * 重新扫描当前工作空间
   */
  async rescanWorkspace(): Promise<boolean> {
    const path = this.currentWorkspace?.path;
    if (!path) {
      return false;
    }

    try {
      await fileReferenceManager.scanFolder(path);
      return true;
    } catch (e) {
      console.error('Failed to rescan workspace:', e);
      return false;
    }
  }
}

// 导出单例
export const workspaceManager = new WorkspaceManager();

// 导出便捷函数
export function getWorkspacePath(): string | null {
  return workspaceManager.getCurrentPath();
}

export function getRelativePath(absolutePath: string): string {
  return workspaceManager.getRelativePath(absolutePath);
}

export function isInWorkspace(path: string): boolean {
  return workspaceManager.isInWorkspace(path);
}
