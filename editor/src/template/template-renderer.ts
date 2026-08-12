/**
 * 模板渲染器
 * 
 * 负责渲染模板变量表单和最终模板内容
 */

import type {
  TemplateVariable,
  VariableType,
  PromptTemplate,
  TemplateValues,
  TemplateValue,
  DataSource,
  DataSourceItem,
} from './template-types';

/** 表单字段渲染选项 */
interface FieldRenderOptions {
  /** 字段ID前缀 */
  idPrefix?: string;
  /** 自定义CSS类 */
  className?: string;
  /** 是否禁用 */
  disabled?: boolean;
}

/** 渲染后的表单字段 */
interface RenderedField {
  /** HTML字符串 */
  html: string;
  /** 字段ID */
  fieldId: string;
  /** 变量定义 */
  variable: TemplateVariable;
}

/**
 * 渲染单个表单字段
 * @param variable 变量定义
 * @param options 渲染选项
 * @returns 渲染结果
 */
export function renderField(
  variable: TemplateVariable,
  options: FieldRenderOptions = {}
): RenderedField {
  const { idPrefix = 'var-', className = '', disabled = false } = options;
  const fieldId = `${idPrefix}${variable.id}`;
  const disabledAttr = disabled ? 'disabled' : '';
  const requiredAttr = variable.required ? 'required' : '';
  const placeholder = variable.placeholder
    ? `placeholder="${escapeHtml(variable.placeholder)}"`
    : '';

  let html = '';

  // 字段标签
  const labelHtml = `<label for="${fieldId}" class="field-label">
    ${escapeHtml(variable.label)}
    ${variable.required ? '<span class="required">*</span>' : ''}
  </label>`;

  // 根据类型渲染不同输入
  switch (variable.type) {
    case 'textarea':
      html = `${labelHtml}
        <textarea
          id="${fieldId}"
          name="${variable.id}"
          class="field-textarea ${className}"
          ${placeholder}
          ${requiredAttr}
          ${disabledAttr}
          rows="4"
        >${escapeHtml(String(variable.defaultValue ?? ''))}</textarea>`;
      break;

    case 'select':
      html = `${labelHtml}
        <select
          id="${fieldId}"
          name="${variable.id}"
          class="field-select ${className}"
          ${requiredAttr}
          ${disabledAttr}
        >
          ${renderSelectOptions(variable.options, variable.defaultValue as string)}
        </select>`;
      break;

    case 'multiselect':
      const currentValues = Array.isArray(variable.defaultValue) ? variable.defaultValue : variable.defaultValue ? [String(variable.defaultValue)] : [];
      const multiOptions = variable.options || [];
      const checkboxesHtml = multiOptions.map(opt => {
        const checked = currentValues.includes(opt) ? 'checked' : '';
        return `
          <label class="checkbox-option">
            <input type="checkbox" name="${variable.id}" value="${escapeHtml(opt)}" ${checked} ${disabledAttr} />
            ${escapeHtml(opt)}
          </label>
        `;
      }).join('');
      html = `${labelHtml}
        <div class="field-multiselect-checkboxes ${className}" ${requiredAttr}>
          ${checkboxesHtml}
        </div>`;
      break;

    case 'number':
      html = `${labelHtml}
        <input
          type="number"
          id="${fieldId}"
          name="${variable.id}"
          class="field-number ${className}"
          value="${escapeHtml(String(variable.defaultValue ?? ''))}"
          ${placeholder}
          ${requiredAttr}
          ${disabledAttr}
        />`;
      break;

    case 'checkbox':
      const checkboxChecked = variable.defaultValue === true || variable.defaultValue === 'true' ? 'checked' : '';
      html = `<div class="field-checkbox-wrapper ${className}">
        <label class="field-checkbox-label">
          <input
            type="checkbox"
            id="${fieldId}"
            name="${variable.id}"
            class="field-checkbox"
            ${checkboxChecked}
            ${disabledAttr}
          />
          <span class="checkbox-text">${escapeHtml(variable.label)}</span>
        </label>
      </div>`;
      break;

    case 'radio':
      const radioOptions = variable.options || [];
      const radioValue = String(variable.defaultValue || '');
      const radioButtonsHtml = radioOptions.map(opt => {
        const checked = radioValue === opt ? 'checked' : '';
        return `
          <label class="radio-option">
            <input type="radio" name="${variable.id}" value="${escapeHtml(opt)}" ${checked} ${disabledAttr} />
            ${escapeHtml(opt)}
          </label>
        `;
      }).join('');
      html = `${labelHtml}
        <div class="field-radio-group ${className}" ${requiredAttr}>
          ${radioButtonsHtml}
        </div>`;
      break;

    case 'text':
    default:
      html = `${labelHtml}
        <input
          type="text"
          id="${fieldId}"
          name="${variable.id}"
          class="field-input ${className}"
          value="${escapeHtml(String(variable.defaultValue ?? ''))}"
          ${placeholder}
          ${requiredAttr}
          ${disabledAttr}
        />`;
      break;
  }

  return {
    html: `<div class="form-field" data-variable="${variable.id}">${html}</div>`,
    fieldId,
    variable,
  };
}

/**
 * 渲染选择框选项
 * @param options 选项列表
 * @param selectedValue 选中的值
 * @returns HTML字符串
 */
function renderSelectOptions(
  options: string[] | undefined,
  selectedValue: string | string[] | undefined
): string {
  if (!options || options.length === 0) {
    return '<option value="">-- 无可用选项 --</option>';
  }

  const selectedSet = new Set(
    Array.isArray(selectedValue) ? selectedValue : selectedValue ? [selectedValue] : []
  );

  return options
    .map(opt => {
      const selected = selectedSet.has(opt) ? 'selected' : '';
      return `<option value="${escapeHtml(opt)}" ${selected}>${escapeHtml(opt)}</option>`;
    })
    .join('');
}

/**
 * 使用数据源渲染选择框选项
 * @param items 数据源项
 * @param selectedValue 选中的值
 * @returns HTML字符串
 */
function renderDataSourceOptions(
  items: DataSourceItem[],
  selectedValue: string | string[] | undefined
): string {
  if (!items || items.length === 0) {
    return '<option value="">-- 无可用选项 --</option>';
  }

  const selectedSet = new Set(
    Array.isArray(selectedValue) ? selectedValue : selectedValue ? [selectedValue] : []
  );

  return items
    .map(item => {
      const selected = selectedSet.has(item.value) ? 'selected' : '';
      const description = item.description
        ? ` title="${escapeHtml(item.description)}"`
        : '';
      return `<option value="${escapeHtml(item.value)}"${description} ${selected}>${escapeHtml(item.label)}</option>`;
    })
    .join('');
}

/**
 * 渲染完整表单
 * @param variables 变量定义列表
 * @param dataSources 数据源映射
 * @param options 渲染选项
 * @returns 表单HTML
 */
export function renderForm(
  variables: TemplateVariable[],
  dataSources: Map<string, DataSource> = new Map(),
  options: FieldRenderOptions = {}
): string {
  if (variables.length === 0) {
    return '<div class="template-no-vars">此模板无需填写变量</div>';
  }

  // 按 order 排序
  const sortedVars = [...variables].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const fields = sortedVars.map(variable => {
    // 如果变量有关联数据源，使用数据源选项
    if (variable.dataSourceId && dataSources.has(variable.dataSourceId)) {
      const ds = dataSources.get(variable.dataSourceId)!;
      const modifiedVar: TemplateVariable = {
        ...variable,
        options: ds.items.map(item => item.value),
      };
      return renderField(modifiedVar, options);
    }
    return renderField(variable, options);
  });

  return `
    <div class="template-form">
      ${fields.map(f => f.html).join('\n')}
    </div>
  `;
}

/**
 * 从表单元素收集值
 * @param container 表单容器元素
 * @param variables 变量定义列表
 * @returns 收集的值
 */
export function collectFormValues(
  container: HTMLElement,
  variables: TemplateVariable[]
): TemplateValues {
  const values: TemplateValues = {};

  for (const variable of variables) {
    const element = container.querySelector(`[name="${variable.id}"]`) as
      | HTMLInputElement
      | HTMLTextAreaElement
      | HTMLSelectElement
      | null;

    if (!element) continue;

    switch (variable.type) {
      case 'multiselect':
        // 收集所有选中的复选框
        const checkedBoxes = container.querySelectorAll(`input[name="${variable.id}"]:checked`);
        values[variable.id] = Array.from(checkedBoxes).map(cb => (cb as HTMLInputElement).value);
        break;

      case 'checkbox':
        const checkbox = container.querySelector(`input[type="checkbox"][name="${variable.id}"]`) as HTMLInputElement;
        values[variable.id] = checkbox ? checkbox.checked : false;
        break;

      case 'radio':
        const radio = container.querySelector(`input[type="radio"][name="${variable.id}"]:checked`) as HTMLInputElement;
        values[variable.id] = radio ? radio.value : '';
        break;

      case 'number':
        values[variable.id] = parseFloat((element as HTMLInputElement).value) || 0;
        break;

      default:
        values[variable.id] = element.value;
        break;
    }
  }

  return values;
}

/**
 * 验证表单值
 * @param values 表单值
 * @param variables 变量定义列表
 * @returns 验证结果
 */
export function validateFormValues(
  values: TemplateValues,
  variables: TemplateVariable[]
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  for (const variable of variables) {
    const value = values[variable.id];

    // 必填验证
    if (variable.required) {
      const isEmpty =
        value === undefined ||
        value === '' ||
        (Array.isArray(value) && value.length === 0) ||
        (variable.type === 'checkbox' && value === false);

      if (isEmpty) {
        errors[variable.id] = `${variable.label} 是必填项`;
        continue;
      }
    }

    // 正则验证
    if (variable.validation && value) {
      const regex = new RegExp(variable.validation);
      const testValue = Array.isArray(value) ? value.join(',') : String(value);
      if (!regex.test(testValue)) {
        errors[variable.id] = `${variable.label} 格式不正确`;
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * 渲染模板（替换变量为值）
 * @param template 模板对象
 * @param values 变量值
 * @returns 渲染后的内容
 */
export function renderTemplate(
  template: PromptTemplate,
  values: TemplateValues
): string {
  let content = template.content;

  // 按变量名长度降序排序，避免短变量名匹配长变量名的一部分
  const sortedVars = [...template.variables].sort(
    (a, b) => b.id.length - a.id.length
  );

  for (const variable of sortedVars) {
    const regex = new RegExp(`\\{\\{\\s*${variable.id}\\s*(:[^}]*)?\\}\\}`, 'g');
    const value = values[variable.id];

    let replacement: string;
    if (value === undefined) {
      replacement = ''; // 未填写的变量替换为空
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

/**
 * 预览模板（显示变量替换效果）
 * @param template 模板对象
 * @param values 变量值
 * @returns 预览内容
 */
export function previewTemplate(
  template: PromptTemplate,
  values: TemplateValues
): string {
  let content = template.content;

  const sortedVars = [...template.variables].sort(
    (a, b) => b.id.length - a.id.length
  );

  for (const variable of sortedVars) {
    const regex = new RegExp(`\\{\\{\\s*${variable.id}\\s*(:[^}]*)?\\}\\}`, 'g');
    const value = values[variable.id];

    let displayValue: string;
    if (value === undefined || value === '') {
      displayValue = `[${variable.name}]`;
    } else if (Array.isArray(value)) {
      displayValue = value.join(', ');
    } else if (typeof value === 'boolean') {
      displayValue = value ? '是' : '否';
    } else {
      displayValue = String(value);
    }

    content = content.replace(regex, displayValue);
  }

  return content;
}

/**
 * 获取默认值
 * @param variable 变量定义
 * @returns 默认值
 */
export function getDefaultValue(
  variable: TemplateVariable
): TemplateValue {
  if (variable.defaultValue !== undefined) {
    return variable.defaultValue;
  }

  // 根据类型返回合适的默认值
  switch (variable.type) {
    case 'multiselect':
      return [];
    case 'checkbox':
      return false;
    case 'number':
      return 0;
    default:
      return '';
  }
}

/**
 * 创建默认值对象
 * @param variables 变量定义列表
 * @returns 默认值对象
 */
export function createDefaultValues(
  variables: TemplateVariable[]
): TemplateValues {
  const values: TemplateValues = {};

  for (const variable of variables) {
    values[variable.id] = getDefaultValue(variable);
  }

  return values;
}

/**
 * HTML转义
 * @param text 原始文本
 * @returns 转义后的文本
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 检查模板是否需要填写变量
 * @param template 模板对象
 * @returns 是否需要填写
 */
export function needsUserInput(template: PromptTemplate): boolean {
  return template.variables.length > 0;
}

/**
 * 获取必填变量数量
 * @param template 模板对象
 * @returns 必填变量数
 */
export function getRequiredVariableCount(template: PromptTemplate): number {
  return template.variables.filter(v => v.required).length;
}

/**
 * 估算渲染后的内容长度
 * @param template 模板对象
 * @returns 估算长度
 */
export function estimateRenderedLength(template: PromptTemplate): number {
  let length = template.content.length;

  for (const variable of template.variables) {
    // 减去占位符长度
    const placeholderLength = variable.id.length + 4; // {{ }}
    length -= placeholderLength;

    // 加上估算的值长度
    const estimatedValueLength = variable.type === 'textarea' ? 200 : 50;
    length += estimatedValueLength;
  }

  return length;
}
