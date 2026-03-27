/**
 * File Reference Manager - Phase 1 MVP
 * 管理文件引用、扫描和存储
 * 所有路径都相对于当前工作空间
 */

import { EditorView } from '@codemirror/view';
import { workspaceManager } from './workspace-manager';

export interface FileReference {
  id: string;
  path: string;
  relativePath: string;
  name: string;
  isDirectory: boolean;
  lastModified: number;
}

interface FileReferenceData {
  watchedFolders: string[];
  files: FileReference[];
}

const STORAGE_KEY = 'promptEditor:fileReferences:v1';

class FileReferenceManager {
  private scannedFiles: Map<string, FileReference> = new Map();
  private watchedFolders: Set<string> = new Set();
  private isInitialized = false;

  constructor() {
    this.loadFromStorage();
  }

  /**
   * 从 LocalStorage 加载缓存
   */
  private loadFromStorage() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed: FileReferenceData = JSON.parse(data);
        this.watchedFolders = new Set(parsed.watchedFolders || []);
        (parsed.files || []).forEach(f => this.scannedFiles.set(f.path, f));
      }
    } catch (e) {
      console.error('Failed to load file references:', e);
    }
    this.isInitialized = true;
  }

  /**
   * 保存到 LocalStorage
   */
  private saveToStorage() {
    try {
      const data: FileReferenceData = {
        watchedFolders: Array.from(this.watchedFolders),
        files: Array.from(this.scannedFiles.values()),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save file references:', e);
    }
  }

  /**
   * 扫描指定文件夹（Phase 2: 通过原生桥接调用 Rust API）
   */
  async scanFolder(folderPath: string): Promise<FileReference[]> {
    try {
      // 尝试调用原生 API
      const files = await this.invokeNativeScan(folderPath);
      
      if (files && files.length > 0) {
        // 添加到缓存
        files.forEach(f => this.scannedFiles.set(f.path, f));
        this.watchedFolders.add(folderPath);
        this.saveToStorage();
        return files;
      }
    } catch (e) {
      console.warn('Native scan failed, falling back to mock:', e);
    }
    
    // Fallback: 使用模拟数据
    return this.getMockFiles(folderPath);
  }
  
  /**
   * 调用原生扫描 API
   */
  private async invokeNativeScan(folderPath: string): Promise<FileReference[]> {
    return new Promise((resolve, reject) => {
      // 检查是否支持原生桥接
      const isNative = typeof window !== 'undefined' && 
        (window.webkit?.messageHandlers?.promptEditor || 
         (window as any).__TAURI__ ||
         (window as any).promptEditorNative);
      
      if (!isNative) {
        reject(new Error('Native bridge not available'));
        return;
      }
      
      // 设置回调
      const callbackName = `scanCallback_${Date.now()}`;
      (window as any)[callbackName] = (result: string | null, error?: string) => {
        delete (window as any)[callbackName];
        if (error) {
          reject(new Error(error));
        } else if (result) {
          try {
            const files: FileReference[] = JSON.parse(result);
            resolve(files);
          } catch (e) {
            reject(new Error('Invalid JSON response'));
          }
        } else {
          resolve([]);
        }
      };
      
      // 发送消息到原生端
      if (window.webkit?.messageHandlers?.promptEditor) {
        // macOS WKWebView
        window.webkit.messageHandlers.promptEditor.postMessage({
          action: 'scanDirectory',
          path: folderPath,
          callback: callbackName,
        });
      } else if ((window as any).__TAURI__) {
        // Tauri
        (window as any).__TAURI__.invoke('scan_directory', { path: folderPath })
          .then((result: string) => (window as any)[callbackName](result))
          .catch((err: Error) => (window as any)[callbackName](null, err.message));
      } else {
        reject(new Error('No native bridge available'));
      }
      
      // 超时处理
      setTimeout(() => {
        if ((window as any)[callbackName]) {
          delete (window as any)[callbackName];
          reject(new Error('Scan timeout'));
        }
      }, 10000);
    });
  }
  
  /**
   * 获取模拟文件（Fallback）
   */
  private getMockFiles(folderPath: string): FileReference[] {
    const mockFiles: FileReference[] = [
      {
        id: '1',
        path: `${folderPath}/README.md`,
        relativePath: 'README.md',
        name: 'README.md',
        isDirectory: false,
        lastModified: Date.now(),
      },
      {
        id: '2',
        path: `${folderPath}/package.json`,
        relativePath: 'package.json',
        name: 'package.json',
        isDirectory: false,
        lastModified: Date.now(),
      },
      {
        id: '3',
        path: `${folderPath}/src/main.ts`,
        relativePath: 'src/main.ts',
        name: 'main.ts',
        isDirectory: false,
        lastModified: Date.now(),
      },
    ];

    mockFiles.forEach(f => this.scannedFiles.set(f.path, f));
    this.watchedFolders.add(folderPath);
    this.saveToStorage();

    return mockFiles;
  }

  /**
   * 搜索文件（用于 @ 自动完成）
   * 优先搜索工作空间内的文件
   */
  searchFiles(query: string): FileReference[] {
    const results: FileReference[] = [];
    const lowerQuery = query.toLowerCase();
    const workspacePath = workspaceManager.getCurrentPath();

    for (const file of this.scannedFiles.values()) {
      // 如果有工作空间，只显示工作空间内的文件
      if (workspacePath && !workspaceManager.isInWorkspace(file.path)) {
        continue;
      }
      
      // 使用相对于工作空间的路径进行匹配
      const searchPath = workspacePath 
        ? workspaceManager.getRelativePath(file.path)
        : file.relativePath;
      
      if (file.name.toLowerCase().includes(lowerQuery) ||
          searchPath.toLowerCase().includes(lowerQuery)) {
        results.push({
          ...file,
          relativePath: searchPath,
        });
      }
    }

    // 排序：精确匹配优先，然后按名称长度
    return results.sort((a, b) => {
      const aExact = a.name.toLowerCase() === lowerQuery;
      const bExact = b.name.toLowerCase() === lowerQuery;
      if (aExact && !bExact) return -1;
      if (bExact && !aExact) return 1;
      
      const aStarts = a.name.toLowerCase().startsWith(lowerQuery);
      const bStarts = b.name.toLowerCase().startsWith(lowerQuery);
      if (aStarts && !bStarts) return -1;
      if (bStarts && !aStarts) return 1;
      
      return a.name.length - b.name.length;
    });
  }

  /**
   * 获取所有已扫描的文件
   * 如果有工作空间，只返回工作空间内的文件
   */
  getAllFiles(): FileReference[] {
    const files = Array.from(this.scannedFiles.values());
    const workspacePath = workspaceManager.getCurrentPath();
    
    if (!workspacePath) {
      return files;
    }
    
    // 只返回工作空间内的文件，并更新相对路径
    return files
      .filter(file => workspaceManager.isInWorkspace(file.path))
      .map(file => ({
        ...file,
        relativePath: workspaceManager.getRelativePath(file.path),
      }));
  }

  /**
   * 检查文件是否存在
   */
  hasFile(path: string): boolean {
    return this.scannedFiles.has(path);
  }

  /**
   * 通过相对路径查找文件（相对于工作空间）
   */
  findByRelativePath(relativePath: string): FileReference | undefined {
    // 首先尝试直接匹配
    for (const file of this.scannedFiles.values()) {
      if (file.relativePath === relativePath) {
        return file;
      }
    }
    
    // 如果没有找到，尝试使用工作空间计算绝对路径后匹配
    const workspacePath = workspaceManager.getCurrentPath();
    if (workspacePath) {
      const absolutePath = workspaceManager.getAbsolutePath(relativePath);
      const file = this.scannedFiles.get(absolutePath);
      if (file) return file;
    }
    
    return undefined;
  }
  
  /**
   * 获取相对于工作空间的文件列表
   */
  getFilesRelativeToWorkspace(): FileReference[] {
    const files = Array.from(this.scannedFiles.values());
    const workspacePath = workspaceManager.getCurrentPath();
    
    if (!workspacePath) {
      // 没有工作空间，返回原始列表
      return files;
    }
    
    // 过滤并更新相对路径
    return files
      .filter(file => workspaceManager.isInWorkspace(file.path))
      .map(file => ({
        ...file,
        relativePath: workspaceManager.getRelativePath(file.path),
      }));
  }

  /**
   * 通过路径获取文件
   */
  getFile(path: string): FileReference | undefined {
    return this.scannedFiles.get(path);
  }

  /**
   * 在编辑器中插入文件引用
   * 路径相对于当前工作空间
   */
  insertFileReference(view: EditorView, file: FileReference, from: number, to?: number) {
    // 使用工作目录计算相对路径
    const relativePath = workspaceManager.getRelativePath(file.path);
    const referenceText = `@${relativePath}`;
    const insertTo = to ?? from;
    
    view.dispatch({
      changes: {
        from,
        to: insertTo,
        insert: referenceText + ' ',
      },
      selection: {
        anchor: from + referenceText.length + 1,
      },
    });
  }

  /**
   * 解析内容中的所有文件引用
   */
  parseFileReferences(content: string): Array<{ match: string; path: string; file?: FileReference }> {
    const refs: Array<{ match: string; path: string; file?: FileReference }> = [];
    // 匹配 @path/to/file 或 @filename（不包含空格）
    const regex = /@([^\s]+)/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      const fullMatch = match[0];
      const path = match[1];
      const file = this.findByRelativePath(path);
      
      refs.push({
        match: fullMatch,
        path,
        file,
      });
    }

    return refs;
  }

  /**
   * 获取已监视的文件夹
   */
  getWatchedFolders(): string[] {
    return Array.from(this.watchedFolders);
  }

  /**
   * 添加自定义文件（手动输入路径）
   */
  addCustomFile(path: string, name: string): FileReference {
    const file: FileReference = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      path,
      relativePath: path,
      name,
      isDirectory: false,
      lastModified: Date.now(),
    };
    
    this.scannedFiles.set(path, file);
    this.saveToStorage();
    return file;
  }

  /**
   * 清空缓存
   */
  clearCache() {
    this.scannedFiles.clear();
    this.watchedFolders.clear();
    this.saveToStorage();
  }
}

// 导出单例
export const fileReferenceManager = new FileReferenceManager();
