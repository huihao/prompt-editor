/**
 * 模版编辑器
 * 
 * 基于 CodeMirror 6 的专用模版编辑器，提供占位符高亮和编辑辅助
 * 
 * 支持的新语法：
 * - {{name}} - 基本变量
 * - {{name!}} - 必填
 * - {{name:textarea}} - 指定类型
 * - {{name:select=opt1,opt2}} - 带选项
 * - {{name=defaultValue}} - 默认值
 * - {{name#Label}} - 自定义标签
 * - {{name!:select=opt1,opt2=defaultValue#Label}} - 完整形式
 */

import { EditorView, ViewPlugin, ViewUpdate, Decoration, DecorationSet, WidgetType } from '@codemirror/view';
import { EditorState, Extension, StateEffect, StateField } from '@codemirror/state';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language';
import { autocompletion, CompletionContext, CompletionResult, Completion, closeBrackets } from '@codemirror/autocomplete';
import { keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { lightTheme, darkTheme } from '../theme';
import { formatVariableName } from './template-parser';

/** 占位符正则表达式 - 匹配完整的 {{...}} */
const PLACEHOLDER_REGEX = /\{\{\s*([^}]+)\s*\}\}/g;

/** 解析单个占位符 */
function parsePlaceholder(content: string): {
  name: string;
  required: boolean;
  type: string;
  hasOptions: boolean;
} | null {
  content = content.trim();
  
  // 解析必填标记
  const required = content.endsWith('!');
  if (required) {
    content = content.slice(0, -1).trim();
  }
  
  // 解析标签 (跳过)
  const hashIndex = content.lastIndexOf('#');
  if (hashIndex > 0) {
    content = content.slice(0, hashIndex).trim();
  }
  
  // 解析默认值 (跳过)
  const equalIndex = content.indexOf('=');
  if (equalIndex > 0) {
    content = content.slice(0, equalIndex).trim();
  }
  
  // 解析名称和类型
  let name: string;
  let type = 'text';
  let hasOptions = false;
  
  const colonIndex = content.indexOf(':');
  if (colonIndex > 0) {
    name = content.slice(0, colonIndex).trim();
    const typePart = content.slice(colonIndex + 1).trim();
    
    // 检查类型是否包含选项
    const typeEqualIndex = typePart.indexOf('=');
    if (typeEqualIndex > 0) {
      type = typePart.slice(0, typeEqualIndex).trim();
      hasOptions = true;
    } else {
      type = typePart;
    }
  } else {
    name = content.trim();
  }
  
  // 验证变量名
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    return null;
  }
  
  return { name, required, type, hasOptions };
}

/** 创建占位符装饰 */
function createPlaceholderDecorations(content: string): DecorationSet {
  const decorations: any[] = [];
  let match: RegExpExecArray | null;
  
  // 重置正则状态
  PLACEHOLDER_REGEX.lastIndex = 0;
  
  while ((match = PLACEHOLDER_REGEX.exec(content)) !== null) {
    const [fullMatch, innerContent] = match;
    const parsed = parsePlaceholder(innerContent);
    
    if (!parsed) continue;
    
    // 根据类型选择样式
    let className = 'cm-template-placeholder';
    if (parsed.required) {
      className += ' required';
    }
    if (parsed.type !== 'text') {
      className += ` type-${parsed.type}`;
    }
    
    // 构建标题提示
    let title = `Variable: ${parsed.name}`;
    if (parsed.type !== 'text') {
      title += `\nType: ${parsed.type}`;
    }
    if (parsed.required) {
      title += '\nRequired';
    }
    
    decorations.push(
      Decoration.mark({
        class: className,
        attributes: {
          'data-variable': parsed.name,
          'data-type': parsed.type,
          'title': title,
        },
      }).range(match.index, match.index + fullMatch.length)
    );
  }
  
  return Decoration.set(decorations, true);
}

/** 占位符装饰插件 */
const placeholderDecorator = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    
    constructor(view: EditorView) {
      this.decorations = createPlaceholderDecorations(view.state.doc.toString());
    }
    
    update(update: ViewUpdate) {
      if (update.docChanged) {
        this.decorations = createPlaceholderDecorations(update.state.doc.toString());
      }
    }
  },
  {
    decorations: v => v.decorations,
  }
);

/** 占位符自动完成 */
function placeholderCompletions(context: CompletionContext): CompletionResult | null {
  const before = context.matchBefore(/\{\{\s*([a-zA-Z_\:]*)$/);
  
  if (!before && !context.explicit) {
    return null;
  }
  
  const options: Completion[] = [
    // 常用变量名
    { label: 'name', type: 'variable', apply: 'name', detail: 'Variable name' },
    { label: 'description', type: 'variable', apply: 'description', detail: 'Description variable' },
    { label: 'content', type: 'variable', apply: 'content', detail: 'Content variable' },
    { label: 'type', type: 'variable', apply: 'type', detail: 'Type variable' },
    { label: 'language', type: 'variable', apply: 'language', detail: 'Language variable' },
    { label: 'code', type: 'variable', apply: 'code', detail: 'Code variable' },
    { label: 'detail', type: 'variable', apply: 'detail', detail: 'Detail level variable' },
    { label: 'style', type: 'variable', apply: 'style', detail: 'Style variable' },
    // 带类型的模板
    { 
      label: 'textarea', 
      type: 'type', 
      apply: 'name:textarea}}', 
      detail: 'Textarea type',
      boost: -1
    },
    { 
      label: 'select', 
      type: 'type', 
      apply: 'name:select=opt1,opt2}}', 
      detail: 'Select with options',
      boost: -1
    },
    { 
      label: 'multiselect', 
      type: 'type', 
      apply: 'name:multiselect=opt1,opt2}}', 
      detail: 'Multi-select with options',
      boost: -1
    },
    { 
      label: 'number', 
      type: 'type', 
      apply: 'name:number}}', 
      detail: 'Number type',
      boost: -1
    },
    { 
      label: 'required', 
      type: 'keyword', 
      apply: 'name!}}', 
      detail: 'Required variable',
      boost: -1
    },
  ];
  
  return {
    from: before ? before.from : context.pos,
    options,
    validFor: /^\{\{\s*\w*[:=!#]?\w*$/,
  };
}

/** 创建占位符自动完成扩展 */
const placeholderAutocomplete = autocompletion({
  override: [placeholderCompletions],
  defaultKeymap: true,
  closeOnBlur: false,
});

/** 双击选择占位符 */
const selectPlaceholderOnDoubleClick = EditorView.domEventHandlers({
  dblclick(event, view) {
    const target = event.target as HTMLElement;
    if (target.classList.contains('cm-template-placeholder')) {
      const variableName = target.getAttribute('data-variable');
      if (variableName) {
        // 查找并选择整个占位符
        const content = view.state.doc.toString();
        const regex = new RegExp(`\\{\\{[^}]*${variableName}[^}]*\\}\\}`, 'g');
        const match = regex.exec(content);
        
        if (match) {
          const from = match.index;
          const to = from + match[0].length;
          view.dispatch({
            selection: { anchor: from, head: to },
            scrollIntoView: true,
          });
          return true;
        }
      }
    }
    return false;
  },
});

/** 内容变化监听器 */
function contentChangeListener(onChange?: (content: string) => void): Extension {
  if (!onChange) return [];
  
  return EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      onChange(update.state.doc.toString());
    }
  });
}

/** 模版编辑器配置 */
export interface TemplateEditorConfig {
  /** 初始内容 */
  content?: string;
  /** 内容变化回调 */
  onChange?: (content: string) => void;
  /** 是否暗色主题 */
  isDark?: boolean;
}

/** 获取模版编辑器扩展 */
export function templateEditorExtensions(config: TemplateEditorConfig = {}): Extension[] {
  const isDark = config.isDark ?? window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  return [
    history(),
    bracketMatching(),
    closeBrackets(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    markdown({ base: markdownLanguage, codeLanguages: languages }),
    placeholderDecorator,
    placeholderAutocomplete,
    selectPlaceholderOnDoubleClick,
    contentChangeListener(config.onChange),
    isDark ? darkTheme : lightTheme,
    EditorView.lineWrapping,
    keymap.of([
      ...defaultKeymap,
      ...historyKeymap,
    ]),
  ];
}

/** 创建模版编辑器实例 */
export function createTemplateEditor(
  parent: HTMLElement,
  config: TemplateEditorConfig = {}
): EditorView {
  const extensions = templateEditorExtensions(config);
  
  const state = EditorState.create({
    doc: config.content ?? '',
    extensions,
  });
  
  const view = new EditorView({
    state,
    parent,
  });
  
  return view;
}

/** 提取模版中的变量名 */
export function extractTemplateVariables(content: string): string[] {
  const variables: string[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  
  PLACEHOLDER_REGEX.lastIndex = 0;
  
  while ((match = PLACEHOLDER_REGEX.exec(content)) !== null) {
    const parsed = parsePlaceholder(match[1]);
    if (parsed && !seen.has(parsed.name)) {
      seen.add(parsed.name);
      variables.push(parsed.name);
    }
  }
  
  return variables;
}
