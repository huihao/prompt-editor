/**
 * 模板表单对话框
 * 
 * 弹窗形式填写模板占位符
 * 将占位符渲染为表单字段（输入框、下拉框、复选框等）
 */

import type { PromptTemplate, TemplateVariable, TemplateValues } from './template-types';
import { extractVariableDefinitions } from './template-parser';
import { renderTemplate } from './template-renderer';

/** 表单对话框选项 */
interface FormDialogOptions {
  template: PromptTemplate;
  onSubmit: (values: TemplateValues, renderedContent: string) => void;
  onCancel?: () => void;
}

/** 表单字段状态 */
interface FormFieldState {
  variable: TemplateVariable;
  value: string | string[] | number | boolean;
}

/** 创建模板表单对话框 */
export function createTemplateFormDialog(options: FormDialogOptions): {
  open: () => void;
  close: () => void;
  destroy: () => void;
} {
  const { template, onSubmit, onCancel } = options;
  
  // 解析模板变量
  const variables = extractVariableDefinitions(template.content);
  
  // 初始化字段状态
  const fieldStates: Map<string, FormFieldState> = new Map();
  for (const v of variables) {
    let defaultValue: string | string[] | number | boolean;
    if (v.defaultValue !== undefined) {
      defaultValue = v.defaultValue;
    } else if (v.type === 'multiselect') {
      defaultValue = [];
    } else if (v.type === 'checkbox') {
      defaultValue = false;
    } else if (v.type === 'number') {
      defaultValue = 0;
    } else {
      defaultValue = '';
    }
    fieldStates.set(v.id, { variable: v, value: defaultValue });
  }
  
  // 创建对话框元素
  let dialog: HTMLElement | null = null;
  let formContainer: HTMLElement | null = null;
  let previewElement: HTMLElement | null = null;
  
  /**
   * 创建对话框DOM
   */
  function createDialog(): void {
    if (dialog) return;
    
    dialog = document.createElement('div');
    dialog.className = 'template-form-dialog modal';
    dialog.innerHTML = `
      <div class="modal-content template-form-modal-content">
        <div class="modal-header">
          <h3>${escapeHtml(template.name)}</h3>
          <button class="modal-close" id="btn-close-form">×</button>
        </div>
        <div class="modal-body">
          ${template.description ? `<p class="template-form-description">${escapeHtml(template.description)}</p>` : ''}
          <div class="template-form-fields-container">
            <div id="template-form-fields" class="template-form-fields-list"></div>
          </div>
          <div class="template-form-preview-section">
            <label>Preview:</label>
            <pre id="template-form-preview" class="template-form-preview-content"></pre>
          </div>
        </div>
        <div class="modal-actions">
          <button id="btn-form-cancel" class="secondary">Cancel</button>
          <button id="btn-form-submit" class="primary">Insert</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(dialog);
    
    formContainer = dialog.querySelector('#template-form-fields');
    previewElement = dialog.querySelector('#template-form-preview');
    
    // 绑定事件
    dialog.querySelector('#btn-close-form')?.addEventListener('click', close);
    dialog.querySelector('#btn-form-cancel')?.addEventListener('click', close);
    dialog.querySelector('#btn-form-submit')?.addEventListener('click', handleSubmit);
    
    // 点击遮罩关闭
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        close();
      }
    });
    
    // ESC关闭
    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        close();
      }
    });
    
    // 渲染表单字段
    renderFormFields();
    updatePreview();
  }
  
  /**
   * 渲染表单字段
   */
  function renderFormFields(): void {
    if (!formContainer) return;
    
    if (variables.length === 0) {
      formContainer.innerHTML = '<div class="no-fields-message">This template has no variables to fill.</div>';
      return;
    }
    
    formContainer.innerHTML = variables.map(v => renderFormField(v)).join('');
    
    // 绑定字段事件
    for (const v of variables) {
      bindFieldEvents(v);
    }
  }
  
  /**
   * 渲染单个表单字段
   */
  function renderFormField(variable: TemplateVariable): string {
    const state = fieldStates.get(variable.id)!;
    const requiredMark = variable.required ? '<span class="required-mark">*</span>' : '';
    const fieldId = `field-${variable.id}`;
    
    let fieldHtml = '';
    
    switch (variable.type) {
      case 'textarea':
        fieldHtml = `
          <textarea
            id="${fieldId}"
            name="${variable.id}"
            class="form-textarea"
            rows="4"
            placeholder="${escapeHtml(variable.placeholder || '')}"
          >${escapeHtml(String(state.value))}</textarea>
        `;
        break;
        
      case 'select':
        const options = variable.options || [];
        fieldHtml = `
          <select id="${fieldId}" name="${variable.id}" class="form-select">
            ${options.map(opt => `
              <option value="${escapeHtml(opt)}" ${state.value === opt ? 'selected' : ''}>
                ${escapeHtml(opt)}
              </option>
            `).join('')}
          </select>
        `;
        break;
        
      case 'multiselect':
        const multiOptions = variable.options || [];
        const currentValues = Array.isArray(state.value) ? state.value : [];
        fieldHtml = `
          <div class="form-multiselect" id="${fieldId}">
            ${multiOptions.map(opt => `
              <label class="checkbox-option">
                <input 
                  type="checkbox" 
                  name="${variable.id}" 
                  value="${escapeHtml(opt)}"
                  ${currentValues.includes(opt) ? 'checked' : ''}
                />
                <span>${escapeHtml(opt)}</span>
              </label>
            `).join('')}
          </div>
        `;
        break;
        
      case 'checkbox':
        const checked = state.value ? 'checked' : '';
        fieldHtml = `
          <label class="form-checkbox-label">
            <input 
              type="checkbox" 
              id="${fieldId}" 
              name="${variable.id}"
              ${checked}
            />
            <span class="checkbox-text">${escapeHtml(variable.label)}</span>
          </label>
        `;
        break;
        
      case 'radio':
        const radioOptions = variable.options || [];
        const currentValue = String(state.value || '');
        fieldHtml = `
          <div class="form-radio-group" id="${fieldId}">
            ${radioOptions.map(opt => `
              <label class="radio-option">
                <input 
                  type="radio" 
                  name="${variable.id}" 
                  value="${escapeHtml(opt)}"
                  ${currentValue === opt ? 'checked' : ''}
                />
                <span>${escapeHtml(opt)}</span>
              </label>
            `).join('')}
          </div>
        `;
        break;
        
      case 'number':
        fieldHtml = `
          <input
            type="number"
            id="${fieldId}"
            name="${variable.id}"
            class="form-input form-number"
            value="${escapeHtml(String(state.value))}"
            placeholder="${escapeHtml(variable.placeholder || '')}"
          />
        `;
        break;
        
      case 'text':
      default:
        fieldHtml = `
          <input
            type="text"
            id="${fieldId}"
            name="${variable.id}"
            class="form-input"
            value="${escapeHtml(String(state.value))}"
            placeholder="${escapeHtml(variable.placeholder || '')}"
          />
        `;
        break;
    }
    
    // 复选框类型不需要额外的label
    const labelHtml = variable.type === 'checkbox' 
      ? '' 
      : `<label class="field-label" for="${fieldId}">${escapeHtml(variable.label)}${requiredMark}</label>`;
    
    return `
      <div class="form-field-item" data-field="${variable.id}">
        ${labelHtml}
        ${fieldHtml}
        ${variable.placeholder && variable.type !== 'checkbox' ? `<span class="field-hint">${escapeHtml(variable.placeholder)}</span>` : ''}
      </div>
    `;
  }
  
  /**
   * 绑定字段事件
   */
  function bindFieldEvents(variable: TemplateVariable): void {
    const fieldId = `field-${variable.id}`;
    const state = fieldStates.get(variable.id)!;
    
    switch (variable.type) {
      case 'textarea':
      case 'text':
      case 'number':
        const input = document.getElementById(fieldId) as HTMLInputElement | HTMLTextAreaElement;
        if (input) {
          input.addEventListener('input', () => {
            state.value = variable.type === 'number' 
              ? (parseFloat(input.value) || 0) 
              : input.value;
            updatePreview();
          });
        }
        break;
        
      case 'select':
        const select = document.getElementById(fieldId) as HTMLSelectElement;
        if (select) {
          select.addEventListener('change', () => {
            state.value = select.value;
            updatePreview();
          });
        }
        break;
        
      case 'checkbox':
        const checkbox = document.getElementById(fieldId) as HTMLInputElement;
        if (checkbox) {
          checkbox.addEventListener('change', () => {
            state.value = checkbox.checked;
            updatePreview();
          });
        }
        break;
        
      case 'multiselect':
        const multiContainer = document.getElementById(fieldId);
        if (multiContainer) {
          const checkboxes = multiContainer.querySelectorAll('input[type="checkbox"]');
          checkboxes.forEach(cb => {
            cb.addEventListener('change', () => {
              const checked = multiContainer.querySelectorAll('input:checked');
              state.value = Array.from(checked).map(c => (c as HTMLInputElement).value);
              updatePreview();
            });
          });
        }
        break;
        
      case 'radio':
        const radioContainer = document.getElementById(fieldId);
        if (radioContainer) {
          const radios = radioContainer.querySelectorAll('input[type="radio"]');
          radios.forEach(r => {
            r.addEventListener('change', () => {
              if ((r as HTMLInputElement).checked) {
                state.value = (r as HTMLInputElement).value;
                updatePreview();
              }
            });
          });
        }
        break;
    }
  }
  
  /**
   * 更新预览
   */
  function updatePreview(): void {
    if (!previewElement) return;
    
    const values: TemplateValues = {};
    for (const [id, state] of fieldStates) {
      values[id] = state.value;
    }
    
    const rendered = renderTemplate(
      { ...template, variables },
      values
    );
    
    previewElement.textContent = rendered;
  }
  
  /**
   * 获取当前所有值
   */
  function getCurrentValues(): TemplateValues {
    const values: TemplateValues = {};
    for (const [id, state] of fieldStates) {
      values[id] = state.value;
    }
    return values;
  }
  
  /**
   * 验证表单
   */
  function validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    for (const v of variables) {
      if (v.required) {
        const state = fieldStates.get(v.id)!;
        const value = state.value;
        
        const isEmpty = 
          value === undefined || 
          value === '' || 
          (Array.isArray(value) && value.length === 0) ||
          (typeof value === 'boolean' && value === false);
        
        if (isEmpty) {
          errors.push(v.label);
          // 高亮错误字段
          const fieldItem = document.querySelector(`[data-field="${v.id}"]`);
          fieldItem?.classList.add('has-error');
        }
      }
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  /**
   * 处理提交
   */
  function handleSubmit(): void {
    const validation = validate();
    if (!validation.valid) {
      alert(`Please fill in required fields: ${validation.errors.join(', ')}`);
      return;
    }
    
    const values = getCurrentValues();
    const rendered = renderTemplate(
      { ...template, variables },
      values
    );
    
    onSubmit(values, rendered);
    close();
  }
  
  /**
   * 打开对话框
   */
  function open(): void {
    createDialog();
    dialog?.classList.add('show');
    
    // 聚焦第一个输入
    setTimeout(() => {
      const firstInput = dialog?.querySelector('input, textarea, select') as HTMLElement;
      firstInput?.focus();
    }, 100);
  }
  
  /**
   * 关闭对话框
   */
  function close(): void {
    if (onCancel) {
      onCancel();
    }
    dialog?.classList.remove('show');
  }
  
  /**
   * 销毁对话框
   */
  function destroy(): void {
    dialog?.remove();
    dialog = null;
    formContainer = null;
    previewElement = null;
  }
  
  /**
   * HTML转义
   */
  function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  return {
    open,
    close,
    destroy,
  };
}

/** 打开模板表单对话框的便捷函数 */
export function openTemplateFormDialog(
  template: PromptTemplate,
  onSubmit: (values: TemplateValues, renderedContent: string) => void,
  onCancel?: () => void
): { close: () => void } {
  const dialog = createTemplateFormDialog({ template, onSubmit, onCancel });
  dialog.open();
  return { close: dialog.close };
}
