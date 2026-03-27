/**
 * File Picker - Phase 1 MVP
 * 文件选择弹窗 UI
 */

import { fileReferenceManager, FileReference } from './file-reference';
import { workspaceManager } from './workspace-manager';
import { EditorView } from '@codemirror/view';

let currentPicker: FilePicker | null = null;

export class FilePicker {
  private container: HTMLElement | null = null;
  private input: HTMLInputElement | null = null;
  private list: HTMLElement | null = null;
  private currentFiles: FileReference[] = [];
  private selectedIndex = 0;
  private onSelect?: (file: FileReference) => void;
  private view?: EditorView;

  constructor(options?: { 
    onSelect?: (file: FileReference) => void;
    view?: EditorView;
  }) {
    this.onSelect = options?.onSelect;
    this.view = options?.view;
  }

  /**
   * 创建 UI
   */
  private createUI() {
    // 获取工作空间信息
    const workspace = workspaceManager.getCurrentWorkspace();
    const workspaceInfo = workspace 
      ? `<div class="file-picker-workspace" title="${workspace.path}">📂 ${workspace.name}</div>`
      : `<div class="file-picker-workspace file-picker-workspace-empty">No workspace selected</div>`;

    // 创建遮罩层
    this.container = document.createElement('div');
    this.container.className = 'file-picker-overlay';
    this.container.innerHTML = `
      <div class="file-picker">
        ${workspaceInfo}
        <div class="file-picker-header">
          <input type="text" class="file-picker-input" placeholder="Search files... (type @ in editor for quick access)" />
          <button class="file-picker-scan" title="Scan Folder / Change Workspace">📁</button>
        </div>
        <div class="file-picker-list"></div>
        <div class="file-picker-footer">
          <span class="file-picker-hint">↑↓ Navigate</span>
          <span class="file-picker-hint">↵ Select</span>
          <span class="file-picker-hint">Esc Close</span>
        </div>
      </div>
    `;

    this.input = this.container.querySelector('.file-picker-input') as HTMLInputElement;
    this.list = this.container.querySelector('.file-picker-list') as HTMLElement;

    this.setupEventHandlers();
    
    // 初始显示所有文件
    this.refreshList();
  }

  /**
   * 设置事件处理
   */
  private setupEventHandlers() {
    if (!this.input || !this.container) return;

    // 输入搜索
    this.input.addEventListener('input', () => {
      this.performSearch();
    });

    // 键盘导航
    this.input.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          this.selectedIndex = Math.min(this.selectedIndex + 1, this.currentFiles.length - 1);
          this.updateSelection();
          this.scrollToSelected();
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
          this.updateSelection();
          this.scrollToSelected();
          break;
        case 'Enter':
          e.preventDefault();
          if (this.currentFiles[this.selectedIndex]) {
            this.selectFile(this.currentFiles[this.selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          this.hide();
          break;
      }
    });

    // 点击遮罩层关闭
    this.container.addEventListener('click', (e) => {
      if (e.target === this.container) {
        this.hide();
      }
    });

    // 扫描按钮
    const scanBtn = this.container.querySelector('.file-picker-scan');
    scanBtn?.addEventListener('click', () => {
      this.handleScanFolder();
    });
  }

  /**
   * 执行搜索
   */
  private performSearch() {
    const query = this.input?.value || '';
    
    if (!query.trim()) {
      // 显示所有文件
      this.currentFiles = fileReferenceManager.getAllFiles();
    } else {
      // 搜索
      this.currentFiles = fileReferenceManager.searchFiles(query);
    }
    
    this.selectedIndex = 0;
    this.renderList();
  }

  /**
   * 刷新列表
   */
  private refreshList() {
    this.currentFiles = fileReferenceManager.getAllFiles();
    this.selectedIndex = 0;
    this.renderList();
  }

  /**
   * 渲染列表
   */
  private renderList() {
    if (!this.list) return;

    if (this.currentFiles.length === 0) {
      this.list.innerHTML = `
        <div class="file-picker-empty">
          <div class="file-picker-empty-icon">📂</div>
          <div>No files scanned yet</div>
          <div class="file-picker-empty-hint">Click 📁 to scan a folder</div>
        </div>
      `;
      return;
    }

    this.list.innerHTML = this.currentFiles.map((file, i) => {
      const icon = file.isDirectory ? '📁' : getFileIcon(file.name);
      const selected = i === this.selectedIndex ? ' selected' : '';
      
      return `
        <div class="file-picker-item${selected}" data-index="${i}">
          <span class="file-picker-icon">${icon}</span>
          <span class="file-picker-name">${escapeHtml(file.name)}</span>
          <span class="file-picker-path">${escapeHtml(file.relativePath)}</span>
        </div>
      `;
    }).join('');

    // 添加点击处理
    this.list.querySelectorAll('.file-picker-item').forEach(el => {
      el.addEventListener('click', () => {
        const index = parseInt(el.getAttribute('data-index') || '0');
        this.selectFile(this.currentFiles[index]);
      });

      el.addEventListener('mouseenter', () => {
        const index = parseInt(el.getAttribute('data-index') || '0');
        this.selectedIndex = index;
        this.updateSelection();
      });
    });
  }

  /**
   * 更新选中状态
   */
  private updateSelection() {
    if (!this.list) return;
    
    this.list.querySelectorAll('.file-picker-item').forEach((el, i) => {
      if (i === this.selectedIndex) {
        el.classList.add('selected');
      } else {
        el.classList.remove('selected');
      }
    });
  }

  /**
   * 滚动到选中项
   */
  private scrollToSelected() {
    const selected = this.list?.querySelector('.file-picker-item.selected');
    selected?.scrollIntoView({ block: 'nearest' });
  }

  /**
   * 选择文件
   */
  private selectFile(file: FileReference) {
    if (this.onSelect) {
      this.onSelect(file);
    } else if (this.view) {
      // 插入到编辑器
      const pos = this.view.state.selection.main.head;
      fileReferenceManager.insertFileReference(this.view, file, pos);
    }
    this.hide();
  }

  /**
   * 处理扫描文件夹（Phase 2: 使用原生文件夹选择器）
   */
  private async handleScanFolder() {
    try {
      // 显示加载状态
      if (this.input) {
        this.input.placeholder = 'Opening folder picker...';
        this.input.disabled = true;
      }
      
      // 调用原生文件夹选择器
      const folderPath = await this.showNativeFolderPicker();
      
      if (!folderPath) {
        // 用户取消了选择
        if (this.input) {
          this.input.placeholder = 'Search files...';
          this.input.disabled = false;
          this.input.focus();
        }
        return;
      }
      
      // 显示扫描状态
      if (this.input) {
        this.input.placeholder = `Scanning ${folderPath}...`;
      }
      
      // 扫描文件夹
      await fileReferenceManager.scanFolder(folderPath);
      
      // 恢复并刷新
      if (this.input) {
        this.input.placeholder = 'Search files...';
        this.input.disabled = false;
        this.input.focus();
      }
      
      this.refreshList();
      
      // 显示成功提示
      const count = fileReferenceManager.getAllFiles().length;
      this.showToast(`Scanned ${count} files`);
      
    } catch (e) {
      console.error('Failed to scan folder:', e);
      if (this.input) {
        this.input.placeholder = 'Search files...';
        this.input.disabled = false;
      }
      this.showToast('Failed to scan folder');
    }
  }
  
  /**
   * 显示原生文件夹选择器
   */
  private async showNativeFolderPicker(): Promise<string | null> {
    return new Promise((resolve) => {
      // 检查原生支持
      const isNative = typeof window !== 'undefined' && 
        (window.webkit?.messageHandlers?.promptEditor || 
         (window as any).__TAURI__ ||
         (window as any).promptEditorNative);
      
      if (!isNative) {
        // Fallback: 使用模拟路径
        const mockPaths = [
          '/Users/user/project',
          '/home/user/project',
          'C:\\Users\\user\\project',
        ];
        resolve(mockPaths[Math.floor(Math.random() * mockPaths.length)]);
        return;
      }
      
      // 设置回调
      const callbackName = `folderCallback_${Date.now()}`;
      (window as any)[callbackName] = (result: string | null, error?: string) => {
        delete (window as any)[callbackName];
        if (error) {
          console.error('Folder picker error:', error);
          resolve(null);
        } else {
          resolve(result);
        }
      };
      
      // 发送消息到原生端
      if (window.webkit?.messageHandlers?.promptEditor) {
        // macOS WKWebView
        window.webkit.messageHandlers.promptEditor.postMessage({
          action: 'showFolderPicker',
          callback: callbackName,
        });
      } else if ((window as any).__TAURI__) {
        // Tauri
        (window as any).__TAURI__.invoke('pick_folder')
          .then((result: string | null) => (window as any)[callbackName](result))
          .catch((err: Error) => (window as any)[callbackName](null, err.message));
      } else {
        resolve(null);
      }
      
      // 超时处理
      setTimeout(() => {
        if ((window as any)[callbackName]) {
          delete (window as any)[callbackName];
          resolve(null);
        }
      }, 60000); // 60秒超时，给用户足够时间选择
    });
  }
  
  /**
   * 显示 Toast 提示
   */
  private showToast(message: string) {
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = message;
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
      }, 2000);
    }
  }

  /**
   * 显示弹窗
   */
  show() {
    if (currentPicker) {
      currentPicker.hide();
    }
    
    this.createUI();
    document.body.appendChild(this.container!);
    
    // 聚焦输入框
    setTimeout(() => this.input?.focus(), 10);
    
    currentPicker = this;
  }

  /**
   * 隐藏弹窗
   */
  hide() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    
    if (currentPicker === this) {
      currentPicker = null;
    }
    
    // 恢复编辑器焦点
    this.view?.focus();
  }
}

/**
 * 显示文件选择器
 */
export function showFilePicker(options?: { 
  onSelect?: (file: FileReference) => void;
  view?: EditorView;
}): FilePicker {
  const picker = new FilePicker(options);
  picker.show();
  return picker;
}

/**
 * 根据文件名获取图标
 */
function getFileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const iconMap: Record<string, string> = {
    'ts': '📘',
    'tsx': '⚛️',
    'js': '📜',
    'jsx': '⚛️',
    'json': '📋',
    'md': '📝',
    'css': '🎨',
    'scss': '🎨',
    'html': '🌐',
    'py': '🐍',
    'rs': '🦀',
    'go': '🔵',
    'java': '☕',
    'swift': '🐦',
  };
  return iconMap[ext || ''] || '📄';
}

/**
 * HTML 转义
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 隐藏当前文件选择器
 */
export function hideFilePicker() {
  currentPicker?.hide();
}
