/**
 * File Reference Decoration - Phase 1 MVP
 * 在编辑器中高亮显示 @ 文件引用
 */

import { 
  Decoration, 
  DecorationSet, 
  ViewPlugin, 
  ViewUpdate, 
  EditorView,
  WidgetType,
} from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { fileReferenceManager } from './file-reference';

/**
 * 文件引用标记装饰（改变样式）
 */
const fileReferenceMark = Decoration.mark({
  class: 'cm-file-reference',
  inclusive: false,
});

/**
 * 无效的文件引用（文件不存在）
 */
const fileReferenceInvalidMark = Decoration.mark({
  class: 'cm-file-reference-invalid',
  inclusive: false,
});

/**
 * 装饰插件
 */
export const fileReferenceDecorator = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view);
    }

    update(update: ViewUpdate) {
      // 当文档变化或视口变化时重新计算装饰
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.buildDecorations(update.view);
      }
    }

    private buildDecorations(view: EditorView): DecorationSet {
      const builder = new RangeSetBuilder<Decoration>();
      const text = view.state.doc.toString();
      
      // 正则匹配 @path/to/file 或 @filename
      // 注意：不包含空格
      const regex = /@([^\s]+)/g;
      let match;

      while ((match = regex.exec(text)) !== null) {
        const from = match.index;
        const to = from + match[0].length;
        const path = match[1];

        // 检查文件是否存在
        const fileExists = fileReferenceManager.findByRelativePath(path) !== undefined;
        
        // 添加装饰
        const decoration = fileExists ? fileReferenceMark : fileReferenceInvalidMark;
        builder.add(from, to, decoration);
      }

      return builder.finish();
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

/**
 * 点击处理 - 点击文件引用可以打开文件选择器修改
 */
export const fileReferenceClickHandler = EditorView.domEventHandlers({
  click(event, view) {
    const target = event.target as HTMLElement;
    
    // 检查是否点击了文件引用
    if (target.classList.contains('cm-file-reference') || 
        target.classList.contains('cm-file-reference-invalid')) {
      
      // 获取点击位置
      const pos = view.posAtDOM(target);
      const line = view.state.doc.lineAt(pos);
      const lineText = line.text;
      
      // 找到 @ 引用
      const charIndex = pos - line.from;
      const beforeText = lineText.slice(0, charIndex + 1);
      const afterText = lineText.slice(charIndex);
      
      // 向前找 @
      const atIndex = beforeText.lastIndexOf('@');
      if (atIndex === -1) return false;
      
      // 向后找空格或行尾
      let endIndex = charIndex + 1;
      const spaceIndex = afterText.search(/\s/);
      if (spaceIndex !== -1) {
        endIndex = charIndex + 1 + spaceIndex;
      } else {
        endIndex = line.to;
      }
      
      const from = line.from + atIndex;
      const to = line.from + endIndex;
      const path = lineText.slice(atIndex + 1, endIndex);
      
      // 检查是否是 Command/Ctrl 点击（打开文件）
      if (event.metaKey || event.ctrlKey) {
        // Phase 1: 仅打印日志，后续可以实现打开文件
        console.log('Open file:', path);
        return true;
      }
      
      // 普通点击：打开文件选择器替换
      import('./file-picker').then(({ showFilePicker }) => {
        showFilePicker({
          view,
          onSelect: (file) => {
            view.dispatch({
              changes: {
                from,
                to,
                insert: `@${file.relativePath}`,
              },
            });
          },
        });
      });
      
      return true;
    }
    
    return false;
  },
});

/**
 * 鼠标悬停提示
 */
export const fileReferenceHover = EditorView.domEventHandlers({
  mouseover(event, view) {
    const target = event.target as HTMLElement;
    
    if (target.classList.contains('cm-file-reference') || 
        target.classList.contains('cm-file-reference-invalid')) {
      
      // 添加悬停效果
      target.classList.add('cm-file-reference-hover');
      
      // 可选：显示 tooltip
      const title = target.classList.contains('cm-file-reference-invalid') 
        ? 'File not found (click to replace)' 
        : 'File reference (click to change, Cmd+click to open)';
      target.setAttribute('title', title);
    }
  },
  mouseout(event) {
    const target = event.target as HTMLElement;
    target.classList.remove('cm-file-reference-hover');
  },
});

/**
 * 快捷键处理
 * Cmd/Ctrl+Shift+F 打开文件选择器
 */
export const filePickerKeymap = [
  {
    key: 'Mod-Shift-f',
    run: (view: EditorView) => {
      import('./file-picker').then(({ showFilePicker }) => {
        showFilePicker({ view });
      });
      return true;
    },
  },
  {
    key: 'Mod-Shift-5',  // Cmd/Ctrl+Shift+% (Shift+5 is %)
    run: (view: EditorView) => {
      // 在当前光标位置插入 @ 并触发自动完成
      const pos = view.state.selection.main.head;
      view.dispatch({
        changes: {
          from: pos,
          insert: '@',
        },
        selection: { anchor: pos + 1 },
      });
      
      // 触发自动完成
      import('@codemirror/autocomplete').then(({ startCompletion }) => {
        startCompletion(view);
      });
      
      return true;
    },
  },
];
