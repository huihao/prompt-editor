/**
 * 内联模板编辑器
 * 
 * 允许用户直接在模板内容中填写或选择占位符的值
 * 将占位符渲染为可交互的控件（输入框、下拉选择等）
 */

import type { PromptTemplate, TemplateVariable, TemplateValues } from './template-types';
import { extractVariableDefinitions } from './template-parser';
import { renderTemplate } from './template-renderer';

/** 内联编辑器状态 */
interface InlineEditorState {
  template: PromptTemplate;
  values: TemplateValues;
  variables: TemplateVariable[];
}

/** 控件渲染选项 */
interface ControlRenderOptions {
  variable: TemplateVariable;
  value: string | string[] | number;
  onChange: (value: string | string[] | number) => void;
}

/**
 * 创建内联模板编辑器
 * @param container 容器元素
 * @param template 模板
 * @param onChange 值变化回调
 * @returns 编辑器控制对象
 */
export function createInlineTemplateEditor(
  container: HTMLElement,
  template: PromptTemplate,
  onChange?: (values: TemplateValues, preview: string) => void
): {
  getValues: () => TemplateValues;
  getPreview: () => string;
  validate: () => { valid: boolean; missing: string[] };
  render: () => void;
} {
  // 从内容解析变量
  const variables = extractVariableDefinitions(template.content);
  
  // 初始化默认值
  const values: TemplateValues = {};
  for (const v of variables) {
    if (v.defaultValue !== undefined) {
      values[v.id] = v.defaultValue;
    } else if (v.type === 'multiselect') {
      values[v.id] = [];
    } else if (v.type === 'checkbox') {
      values[v.id] = false;
    } else if (v.type === 'number') {
      values[v.id] = 0;
    } else {
      values[v.id] = '';
    }
  }

  const state: InlineEditorState = {
    template,
    values,
    variables,
  };

  /**
   * 渲染控件
   */
  function renderControl(options: ControlRenderOptions): HTMLElement {
    const { variable, value, onChange } = options;
    const wrapper = document.createElement('span');
    wrapper.className = `inline-control type-${variable.type}${variable.required ? ' required' : ''}`;
    wrapper.dataset.variable = variable.id;

    switch (variable.type) {
      case 'textarea':
        const textarea = document.createElement('textarea');
        textarea.placeholder = variable.label;
        textarea.value = String(value || '');
        textarea.rows = 3;
        textarea.addEventListener('input', (e) => {
          onChange((e.target as HTMLTextAreaElement).value);
        });
        wrapper.appendChild(textarea);
        break;

      case 'select':
        const select = document.createElement('select');
        const selectOptions = variable.options || [];
        if (selectOptions.length === 0) {
          const opt = document.createElement('option');
          opt.textContent = '无选项';
          opt.value = '';
          select.appendChild(opt);
        } else {
          for (const opt of selectOptions) {
            const option = document.createElement('option');
            option.value = opt;
            option.textContent = opt;
            if (value === opt) option.selected = true;
            select.appendChild(option);
          }
        }
        select.addEventListener('change', (e) => {
          onChange((e.target as HTMLSelectElement).value);
        });
        wrapper.appendChild(select);
        break;

      case 'multiselect':
        const multiWrapper = document.createElement('span');
        multiWrapper.className = 'multiselect-wrapper';
        const currentValues = Array.isArray(value) ? value : value ? [String(value)] : [];
        const multiOptions = variable.options || [];
        
        for (const opt of multiOptions) {
          const label = document.createElement('label');
          label.className = 'checkbox-option';
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.value = opt;
          checkbox.checked = currentValues.includes(opt);
          checkbox.addEventListener('change', () => {
            const checked = multiWrapper.querySelectorAll('input:checked');
            const newValues = Array.from(checked).map(cb => (cb as HTMLInputElement).value);
            onChange(newValues);
          });
          label.appendChild(checkbox);
          label.appendChild(document.createTextNode(opt));
          multiWrapper.appendChild(label);
        }
        wrapper.appendChild(multiWrapper);
        break;

      case 'number':
        const number = document.createElement('input');
        number.type = 'number';
        number.placeholder = variable.label;
        number.value = String(value || '0');
        number.addEventListener('input', (e) => {
          const val = parseFloat((e.target as HTMLInputElement).value) || 0;
          onChange(val);
        });
        wrapper.appendChild(number);
        break;

      case 'checkbox':
        const checkboxLabel = document.createElement('label');
        checkboxLabel.className = 'inline-checkbox-option';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = Boolean(value);
        checkbox.addEventListener('change', (e) => {
          onChange((e.target as HTMLInputElement).checked);
        });
        checkboxLabel.appendChild(checkbox);
        checkboxLabel.appendChild(document.createTextNode(variable.label));
        wrapper.appendChild(checkboxLabel);
        break;

      case 'radio':
        const radioWrapper = document.createElement('span');
        radioWrapper.className = 'radio-wrapper';
        const radioOptions = variable.options || [];
        const currentValue = String(value || '');
        
        for (const opt of radioOptions) {
          const label = document.createElement('label');
          label.className = 'radio-option';
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
          radioWrapper.appendChild(label);
        }
        wrapper.appendChild(radioWrapper);
        break;

      case 'text':
      default:
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = variable.label;
        input.value = String(value || '');
        input.addEventListener('input', (e) => {
          onChange((e.target as HTMLInputElement).value);
        });
        wrapper.appendChild(input);
        break;
    }

    return wrapper;
  }

  /**
   * 渲染整个编辑器
   */
  function render(): void {
    container.innerHTML = '';
    container.className = 'inline-template-editor';

    // 解析内容，将占位符替换为控件
    let content = template.content;
    const varMap = new Map(variables.map(v => [v.id, v]));
    
    // 使用正则匹配所有占位符
    const placeholderRegex = /\{\{\s*[^}]+\s*\}\}/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    
    // 创建文档片段
    const fragment = document.createDocumentFragment();
    
    placeholderRegex.lastIndex = 0;
    while ((match = placeholderRegex.exec(content)) !== null) {
      // 添加占位符前的文本
      if (match.index > lastIndex) {
        const textBefore = content.slice(lastIndex, match.index);
        fragment.appendChild(document.createTextNode(textBefore));
      }
      
      // 从占位符中提取变量名
      const innerMatch = match[0].match(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)[\s:!#=]/);
      const varName = innerMatch ? innerMatch[1] : null;
      
      if (varName && varMap.has(varName)) {
        const variable = varMap.get(varName)!;
        const control = renderControl({
          variable,
          value: state.values[variable.id],
          onChange: (newValue) => {
            state.values[variable.id] = newValue;
            if (onChange) {
              onChange(state.values, getPreview());
            }
          },
        });
        fragment.appendChild(control);
      } else {
        // 保留原样
        fragment.appendChild(document.createTextNode(match[0]));
      }
      
      lastIndex = match.index + match[0].length;
    }
    
    // 添加剩余文本
    if (lastIndex < content.length) {
      fragment.appendChild(document.createTextNode(content.slice(lastIndex)));
    }
    
    // 包装在 pre 中保持格式
    const pre = document.createElement('pre');
    pre.className = 'inline-template-content';
    pre.appendChild(fragment);
    container.appendChild(pre);

    // 添加预览区域
    const previewSection = document.createElement('div');
    previewSection.className = 'inline-template-preview-section';
    previewSection.innerHTML = '<label>Preview:</label>';
    const previewPre = document.createElement('pre');
    previewPre.className = 'inline-template-preview';
    previewPre.textContent = getPreview();
    previewSection.appendChild(previewPre);
    container.appendChild(previewSection);

    // 初始回调
    if (onChange) {
      onChange(state.values, getPreview());
    }
  }

  /**
   * 获取当前值
   */
  function getValues(): TemplateValues {
    return { ...state.values };
  }

  /**
   * 获取预览内容
   */
  function getPreview(): string {
    return renderTemplate(
      { ...template, variables: state.variables },
      state.values
    );
  }

  /**
   * 验证必填项
   */
  function validate(): { valid: boolean; missing: string[] } {
    const missing: string[] = [];
    for (const v of state.variables) {
      if (v.required) {
        const value = state.values[v.id];
        const isEmpty = value === undefined || value === '' || 
          (Array.isArray(value) && value.length === 0) ||
          (v.type === 'checkbox' && value === false);
        if (isEmpty) {
          missing.push(v.label);
        }
      }
    }
    return { valid: missing.length === 0, missing };
  }

  // 初始渲染
  render();

  return {
    getValues,
    getPreview,
    validate,
    render,
  };
}
