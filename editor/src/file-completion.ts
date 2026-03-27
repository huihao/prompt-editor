/**
 * File Reference Completion - Phase 1 MVP
 * CodeMirror 6 自动完成扩展
 */

import { 
  CompletionContext, 
  CompletionResult, 
  CompletionSource,
  completeFromList,
} from '@codemirror/autocomplete';
import { EditorView } from '@codemirror/view';
import { fileReferenceManager, FileReference } from './file-reference';

/**
 * 创建文件预览元素
 */
function createFilePreview(file: FileReference): HTMLElement {
  const div = document.createElement('div');
  div.className = 'file-completion-preview';
  
  const icon = file.isDirectory ? '📁' : getFileIcon(file.name);
  
  div.innerHTML = `
    <div class="file-preview-header">
      <span class="file-preview-icon">${icon}</span>
      <span class="file-preview-name">${escapeHtml(file.name)}</span>
    </div>
    <div class="file-preview-path">${escapeHtml(file.relativePath)}</div>
  `;
  
  return div;
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
 * 文件引用自动完成源
 */
export const fileReferenceCompletion: CompletionSource = (context: CompletionContext): CompletionResult | null => {
  // 匹配 @ 开头的输入
  // 支持 @filename 或 @/path/to/file
  const before = context.matchBefore(/@[^\s]*/);
  
  if (!before) {
    return null;
  }
  
  // 如果没有输入内容且不是显式触发，不显示
  if (before.text === '@' && !context.explicit) {
    return null;
  }
  
  const query = before.text.slice(1); // 去掉 @
  
  // 如果没有文件缓存，显示提示
  const allFiles = fileReferenceManager.getAllFiles();
  if (allFiles.length === 0) {
    return {
      from: before.from,
      options: [{
        label: '@Scan folder first...',
        type: 'text',
        apply: () => {
          // 触发文件夹扫描
          import('./file-picker').then(({ showFilePicker }) => {
            showFilePicker();
          });
        },
      }],
      validFor: /^@[^\s]*$/,
    };
  }
  
  // 搜索文件
  const files = query ? fileReferenceManager.searchFiles(query) : allFiles.slice(0, 10);
  
  // 限制结果数量
  const limitedFiles = files.slice(0, 20);
  
  return {
    from: before.from,
    options: limitedFiles.map(file => ({
      label: `@${file.relativePath}`,
      displayLabel: file.name,
      detail: file.relativePath,
      type: file.isDirectory ? 'folder' : 'file',
      info: () => createFilePreview(file),
      apply: (view, completion, from, to) => {
        // 使用我们的管理器插入，确保格式一致
        fileReferenceManager.insertFileReference(view, file, from, to);
      },
    })),
    validFor: /^@[^\s]*$/,
  };
};

/**
 * 显式触发文件选择器的命令
 */
export function triggerFilePicker(view: EditorView): boolean {
  const pos = view.state.selection.main.head;
  
  // 检查光标前是否已经有 @
  const line = view.state.doc.lineAt(pos);
  const beforeText = line.text.slice(0, pos - line.from);
  const hasAt = beforeText.endsWith('@') || /@[^\s]*$/.test(beforeText);
  
  if (!hasAt) {
    // 插入 @
    view.dispatch({
      changes: {
        from: pos,
        insert: '@',
      },
      selection: { anchor: pos + 1 },
    });
  }
  
  // 触发自动完成
  const completion = fileReferenceCompletion;
  if (typeof completion === 'function') {
    // 使用 startCompletion 命令
    import('@codemirror/autocomplete').then(({ startCompletion }) => {
      startCompletion(view);
    });
  }
  
  return true;
}
