/**
 * 模板编辑模式
 * 
 * 允许在编辑器中直接渲染占位符为可交互控件
 * 用户可以填写输入框、下拉选择等，并实时预览结果
 */

import { EditorView, ViewPlugin, ViewUpdate, Decoration, DecorationSet, WidgetType } from '@codemirror/view';

// 扩展 Window 接口
declare global {
  interface Window {
    templateModeView: EditorView | null;
  }
}
import { EditorState, Extension, StateField, StateEffect } from '@codemirror/state';
import { extractVariableDefinitions, replaceVariables } from './template/template-parser';
import type { TemplateVariable, TemplateValues } from './template/template-types';

/** 模板编辑模式状态 */
interface TemplateEditState {
  isActive: boolean;
  values: TemplateValues;
  variables: TemplateVariable[];
}

/** 切换模板编辑模式 */
export const toggleTemplateEditMode = StateEffect.define<boolean>();

/** 更新变量值 */
export const updateTemplateValues = StateEffect.define<TemplateValues>();

/** 重置模板值 */
export const resetTemplateValues = StateEffect.define<void>();

/** 模板编辑模式状态字段 */
const templateEditField = StateField.define<TemplateEditState>({
  create: () => ({
    isActive: false,
    values: {},
    variables: [],
  }),
  update(state, tr) {
    let newState = { ...state };
    
    for (const effect of tr.effects) {
      if (effect.is(toggleTemplateEditMode)) {
        newState.isActive = effect.value;
        if (effect.value) {
          // 激活时解析变量
          const content = tr.newDoc.toString();
          newState.variables = extractVariableDefinitions(content);
          // 初始化默认值
          newState.values = {};
          for (const v of newState.variables) {
            if (v.defaultValue !== undefined) {
              newState.values[v.id] = v.defaultValue;
            } else if (v.type === 'multiselect') {
              newState.values[v.id] = [];
            } else if (v.type === 'checkbox') {
              newState.values[v.id] = false;
            } else if (v.type === 'number') {
              newState.values[v.id] = 0;
            } else {
              newState.values[v.id] = '';
            }
          }
        }
      } else if (effect.is(updateTemplateValues)) {
        newState.values = { ...newState.values, ...effect.value };
      } else if (effect.is(resetTemplateValues)) {
        newState.values = {};
        newState.variables = [];
      }
    }
    
    return newState;
  },
});

/** 创建文本输入控件 */
function createTextInput(variable: TemplateVariable, value: string, onChange: (val: string) => void): HTMLElement {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'template-mode-input';
  input.placeholder = variable.label;
  input.value = value || '';
  if (variable.required) {
    input.classList.add('required');
  }
  input.addEventListener('input', () => onChange(input.value));
  return input;
}

/** 创建文本域控件 */
function createTextarea(variable: TemplateVariable, value: string, onChange: (val: string) => void): HTMLElement {
  const textarea = document.createElement('textarea');
  textarea.className = 'template-mode-textarea';
  textarea.placeholder = variable.label;
  textarea.value = value || '';
  textarea.rows = 3;
  if (variable.required) {
    textarea.classList.add('required');
  }
  textarea.addEventListener('input', () => onChange(textarea.value));
  return textarea;
}

/** 创建下拉选择控件 */
function createSelect(variable: TemplateVariable, value: string, onChange: (val: string) => void): HTMLElement {
  const select = document.createElement('select');
  select.className = 'template-mode-select';
  if (variable.required) {
    select.classList.add('required');
  }
  
  const options = variable.options || [];
  if (options.length === 0) {
    const opt = document.createElement('option');
    opt.textContent = '无选项';
    opt.value = '';
    select.appendChild(opt);
  } else {
    for (const opt of options) {
      const option = document.createElement('option');
      option.value = opt;
      option.textContent = opt;
      if (value === opt) option.selected = true;
      select.appendChild(option);
    }
  }
  
  select.addEventListener('change', () => onChange(select.value));
  return select;
}

/** 创建多选复选框组 */
function createMultiselect(variable: TemplateVariable, value: string[], onChange: (val: string[]) => void): HTMLElement {
  const wrapper = document.createElement('span');
  wrapper.className = 'template-mode-multiselect';
  
  const currentValues = Array.isArray(value) ? value : value ? [String(value)] : [];
  const options = variable.options || [];
  
  for (const opt of options) {
    const label = document.createElement('label');
    label.className = 'template-mode-checkbox';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = opt;
    checkbox.checked = currentValues.includes(opt);
    checkbox.addEventListener('change', () => {
      const checked = wrapper.querySelectorAll('input:checked');
      const newValues = Array.from(checked).map(cb => (cb as HTMLInputElement).value);
      onChange(newValues);
    });
    
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(opt));
    wrapper.appendChild(label);
  }
  
  return wrapper;
}

/** 创建数字输入控件 */
function createNumberInput(variable: TemplateVariable, value: number, onChange: (val: number) => void): HTMLElement {
  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'template-mode-input template-mode-number';
  input.placeholder = variable.label;
  input.value = String(value || '0');
  if (variable.required) {
    input.classList.add('required');
  }
  input.addEventListener('input', () => {
    const val = parseFloat(input.value) || 0;
    onChange(val);
  });
  return input;
}

/** 创建单个复选框控件 */
function createCheckbox(variable: TemplateVariable, value: boolean, onChange: (val: boolean) => void): HTMLElement {
  const label = document.createElement('label');
  label.className = 'template-mode-checkbox';
  
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = Boolean(value);
  checkbox.addEventListener('change', () => {
    onChange(checkbox.checked);
  });
  
  label.appendChild(checkbox);
  label.appendChild(document.createTextNode(variable.label));
  return label;
}

/** 创建单选按钮组 */
function createRadio(variable: TemplateVariable, value: string, onChange: (val: string) => void): HTMLElement {
  const wrapper = document.createElement('span');
  wrapper.className = 'template-mode-multiselect';
  
  const currentValue = String(value || '');
  const options = variable.options || [];
  
  for (const opt of options) {
    const label = document.createElement('label');
    label.className = 'template-mode-checkbox';
    
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = variable.id;
    radio.value = opt;
    radio.checked = currentValue === opt;
    radio.addEventListener('change', () => {
      if (radio.checked) {
        onChange(opt);
      }
    });
    
    label.appendChild(radio);
    label.appendChild(document.createTextNode(opt));
    wrapper.appendChild(label);
  }
  
  return wrapper;
}

/** 创建控件 Widget */
class TemplateControlWidget extends WidgetType {
  constructor(
    private variable: TemplateVariable,
    private value: string | string[] | number,
    private onChange: (val: string | string[] | number) => void
  ) {
    super();
  }

  toDOM(): HTMLElement {
    const wrapper = document.createElement('span');
    wrapper.className = 'template-mode-control-wrapper';
    
    let control: HTMLElement;
    switch (this.variable.type) {
      case 'textarea':
        control = createTextarea(this.variable, String(this.value || ''), this.onChange as (val: string) => void);
        break;
      case 'select':
        control = createSelect(this.variable, String(this.value || ''), this.onChange as (val: string) => void);
        break;
      case 'multiselect':
        control = createMultiselect(this.variable, Array.isArray(this.value) ? this.value : [], this.onChange as (val: string[]) => void);
        break;
      case 'number':
        control = createNumberInput(this.variable, Number(this.value) || 0, this.onChange as (val: number) => void);
        break;
      case 'checkbox':
        control = createCheckbox(this.variable, Boolean(this.value), this.onChange as (val: boolean) => void);
        break;
      case 'radio':
        control = createRadio(this.variable, String(this.value || ''), this.onChange as (val: string) => void);
        break;
      case 'text':
      default:
        control = createTextInput(this.variable, String(this.value || ''), this.onChange as (val: string) => void);
        break;
    }
    
    wrapper.appendChild(control);
    return wrapper;
  }

  eq(other: TemplateControlWidget): boolean {
    return this.variable.id === other.variable.id && 
           JSON.stringify(this.value) === JSON.stringify(other.value);
  }

  ignoreEvent(): boolean {
    return false;
  }
}

/** 创建装饰 */
function createTemplateDecorations(state: EditorState): DecorationSet {
  const editState = state.field(templateEditField);
  if (!editState.isActive) {
    return Decoration.none;
  }

  const decorations: any[] = [];
  const content = state.doc.toString();
  
  // 匹配占位符
  const placeholderRegex = /\{\{\s*[^}]+\s*\}\}/g;
  let match: RegExpExecArray | null;
  
  const varMap = new Map(editState.variables.map(v => [v.id, v]));
  
  placeholderRegex.lastIndex = 0;
  while ((match = placeholderRegex.exec(content)) !== null) {
    const innerMatch = match[0].match(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)[\s:!#=]/);
    const varName = innerMatch ? innerMatch[1] : null;
    
    if (varName && varMap.has(varName)) {
      const variable = varMap.get(varName)!;
      const value = editState.values[varName] ?? '';
      
      const widget = new TemplateControlWidget(
        variable,
        value,
        (newValue) => {
          // 更新值
          const view = window.templateModeView;
          if (view) {
            view.dispatch({
              effects: updateTemplateValues.of({ [varName]: newValue }),
            });
          }
        }
      );
      
      decorations.push(
        Decoration.widget({
          widget,
          side: -1,
        }).range(match.index, match.index + match[0].length)
      );
    }
  }
  
  return Decoration.set(decorations);
}

// 全局视图引用，用于控件回调
let templateModeView: EditorView | null = null;

/** 模板编辑模式插件 */
const templateEditModePlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    
    constructor(view: EditorView) {
      templateModeView = view;
      this.decorations = createTemplateDecorations(view.state);
    }
    
    update(update: ViewUpdate) {
      if (update.docChanged || update.state.field(templateEditField) !== update.startState.field(templateEditField)) {
        this.decorations = createTemplateDecorations(update.state);
      }
    }
  },
  {
    decorations: v => v.decorations,
  }
);

/** 获取模板编辑模式扩展 */
export function templateEditMode(): Extension[] {
  return [
    templateEditField,
    templateEditModePlugin,
  ];
}

/** 检查是否处于模板编辑模式 */
export function isTemplateEditMode(state: EditorState): boolean {
  return state.field(templateEditField).isActive;
}

/** 切换模板编辑模式 */
export function setTemplateEditMode(view: EditorView, active: boolean): void {
  view.dispatch({
    effects: toggleTemplateEditMode.of(active),
  });
}

/** 获取当前填充值 */
export function getTemplateValues(state: EditorState): TemplateValues {
  return { ...state.field(templateEditField).values };
}

/** 获取当前变量定义 */
export function getTemplateVariables(state: EditorState): TemplateVariable[] {
  return [...state.field(templateEditField).variables];
}

/** 获取填充后的内容 */
export function getFilledContent(state: EditorState): string {
  const editState = state.field(templateEditField);
  if (!editState.isActive) {
    return state.doc.toString();
  }
  
  let content = state.doc.toString();
  
  // 按变量名长度降序排序，避免短变量名匹配长变量名的一部分
  const sortedVars = [...editState.variables].sort(
    (a, b) => b.id.length - a.id.length
  );
  
  for (const variable of sortedVars) {
    const regex = new RegExp(`\\{\\{\\s*${variable.id}[^}]*\\}\\}`, 'g');
    const value = editState.values[variable.id];
    
    let replacement: string;
    if (value === undefined || value === '') {
      replacement = '';
    } else if (Array.isArray(value)) {
      replacement = value.join(', ');
    } else if (typeof value === 'boolean') {
      replacement = value ? '是' : '否';
    } else {
      replacement = String(value);
    }
    
    content = content.replace(regex, replacement);
  }
  
  return content;
}

/** 填充模板并退出编辑模式 */
export function fillTemplateAndExit(view: EditorView): void {
  const filled = getFilledContent(view.state);
  
  view.dispatch({
    changes: {
      from: 0,
      to: view.state.doc.length,
      insert: filled,
    },
    effects: [
      toggleTemplateEditMode.of(false),
      resetTemplateValues.of(undefined),
    ],
  });
}

// 暴露全局变量给控件回调
(window as any).templateModeView = null;
Object.defineProperty(window, 'templateModeView', {
  get: () => templateModeView,
  set: (val) => { templateModeView = val; },
});
