/**
 * 模板管理器 UI
 * 
 * 提供完整的模板管理界面：新增、编辑、删除模板
 */

import type { PromptTemplate, TemplateVariable, VariableType } from './template-types';
import { BUILTIN_CATEGORIES, generateId, createTemplate } from './template-types';
import { templateManager } from './template-manager';
import { dataSourceManager } from './data-source-manager';
import { syncVariables, formatVariableName } from './template-parser';
import { renderTemplate, previewTemplate, createDefaultValues } from './template-renderer';

/** 管理面板状态 */
interface ManagerState {
  isOpen: boolean;
  editingTemplate: PromptTemplate | null;
  isCreating: boolean;
}

/** 变量表单编辑状态 */
interface VariableEditState {
  id: string;
  name: string;
  type: VariableType;
  label: string;
  placeholder: string;
  defaultValue: string;
  required: boolean;
  options: string;
}

/** 模板管理 UI */
class TemplateManagerUI {
  private state: ManagerState = {
    isOpen: false,
    editingTemplate: null,
    isCreating: false,
  };

  private elements: {
    panel?: HTMLElement;
    list?: HTMLElement;
    editor?: HTMLElement;
    search?: HTMLInputElement;
  } = {};

  private variableForms: VariableEditState[] = [];

  /**
   * 初始化
   */
  init(): void {
    this.createPanel();
    this.attachEventListeners();
  }

  /**
   * 创建管理面板
   */
  private createPanel(): void {
    if (document.getElementById('template-manager-panel')) {
      this.elements.panel = document.getElementById('template-manager-panel') as HTMLElement;
      this.elements.list = document.getElementById('template-manager-list') as HTMLElement;
      this.elements.editor = document.getElementById('template-editor-form') as HTMLElement;
      this.elements.search = document.getElementById('template-manager-search') as HTMLInputElement;
      return;
    }

    const panel = document.createElement('div');
    panel.id = 'template-manager-panel';
    panel.className = 'modal full-screen';
    panel.innerHTML = `
      <div class="manager-panel">
        <div class="manager-sidebar">
          <div class="manager-header">
            <h3>📝 Template Manager</h3>
            <button id="btn-close-manager" class="icon-btn" title="Close">×</button>
          </div>
          <div class="manager-actions">
            <button id="btn-create-template" class="primary">+ New Template</button>
          </div>
          <div class="manager-search">
            <input type="text" id="template-manager-search" placeholder="Search templates..." />
          </div>
          <div class="manager-list" id="template-manager-list">
            <!-- Template list will be rendered here -->
          </div>
        </div>
        <div class="manager-content">
          <div id="template-editor-empty" class="editor-empty">
            <div class="empty-icon">📝</div>
            <div class="empty-text">Select a template to edit</div>
            <div class="empty-hint">or create a new template</div>
          </div>
          <div id="template-editor-form" class="template-editor" style="display: none;">
            <!-- Editor form will be rendered here -->
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    this.elements.panel = panel;
    this.elements.list = panel.querySelector('#template-manager-list') as HTMLElement;
    this.elements.editor = panel.querySelector('#template-editor-form') as HTMLElement;
    this.elements.search = panel.querySelector('#template-manager-search') as HTMLInputElement;

    this.renderTemplateList();
  }

  /**
   * 绑定事件监听器
   */
  private attachEventListeners(): void {
    // 关闭按钮
    document.getElementById('btn-close-manager')?.addEventListener('click', () => {
      this.close();
    });

    // 新建模板
    document.getElementById('btn-create-template')?.addEventListener('click', () => {
      this.createNewTemplate();
    });

    // 搜索
    this.elements.search?.addEventListener('input', (e) => {
      const query = (e.target as HTMLInputElement).value;
      this.renderTemplateList(query);
    });

    // ESC 关闭
    this.elements.panel?.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.close();
      }
    });

    // 监听模板变化
    templateManager.onChange(() => {
      if (this.state.isOpen) {
        this.renderTemplateList(this.elements.search?.value);
      }
    });
  }

  /**
   * 渲染模板列表
   */
  private renderTemplateList(searchQuery: string = ''): void {
    if (!this.elements.list) return;

    const templates = templateManager.searchTemplates(searchQuery);

    if (templates.length === 0) {
      this.elements.list.innerHTML = `
        <div class="manager-empty">
          <div class="empty-text">No templates found</div>
        </div>
      `;
      return;
    }

    this.elements.list.innerHTML = templates
      .map((template) => this.renderTemplateListItem(template))
      .join('');

    // 绑定事件
    this.elements.list.querySelectorAll('.template-list-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.id!;
        const template = templateManager.getTemplate(id);
        if (template) {
          this.editTemplate(template);
        }
      });
    });

    this.elements.list.querySelectorAll('.btn-delete-template').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (e.currentTarget as HTMLElement).dataset.id!;
        this.deleteTemplate(id);
      });
    });

    this.elements.list.querySelectorAll('.btn-duplicate-template').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (e.currentTarget as HTMLElement).dataset.id!;
        this.duplicateTemplate(id);
      });
    });
  }

  /**
   * 渲染列表项
   */
  private renderTemplateListItem(template: PromptTemplate): string {
    const category = BUILTIN_CATEGORIES.find((c) => c.id === template.category);
    const icon = category?.icon || '📄';

    return `
      <div class="template-list-item ${template.isBuiltin ? 'builtin' : ''}" data-id="${template.id}">
        <div class="item-icon">${icon}</div>
        <div class="item-info">
          <div class="item-name">${this.escapeHtml(template.name)}</div>
          <div class="item-meta">${template.variables.length} vars • ${template.isBuiltin ? 'Built-in' : 'Custom'}</div>
        </div>
        <div class="item-actions">
          <button class="btn-duplicate-template icon-btn-sm" data-id="${template.id}" title="Duplicate">📋</button>
          ${!template.isBuiltin ? `<button class="btn-delete-template icon-btn-sm" data-id="${template.id}" title="Delete">🗑️</button>` : ''}
        </div>
      </div>
    `;
  }

  /**
   * 创建新模板
   */
  private createNewTemplate(): void {
    const newTemplate: PromptTemplate = {
      id: generateId(),
      name: 'New Template',
      description: '',
      category: 'other',
      content: '请帮我{{action}}当前代码。',
      variables: [
        {
          id: 'action',
          name: 'Action',
          type: 'text',
          label: 'Action',
          defaultValue: '审查',
          required: true,
          order: 1,
        },
      ],
      tags: [],
      isBuiltin: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.state.isCreating = true;
    this.state.editingTemplate = newTemplate;
    this.variableForms = this.convertVariablesToForms(newTemplate.variables);
    this.renderEditor();
  }

  /**
   * 编辑模板
   */
  private editTemplate(template: PromptTemplate): void {
    this.state.isCreating = false;
    this.state.editingTemplate = { ...template };
    this.variableForms = this.convertVariablesToForms(template.variables);
    this.renderEditor();
  }

  /**
   * 删除模板
   */
  private deleteTemplate(id: string): void {
    const template = templateManager.getTemplate(id);
    if (!template || template.isBuiltin) return;

    if (confirm(`Are you sure you want to delete "${template.name}"?`)) {
      templateManager.deleteTemplate(id);
      if (this.state.editingTemplate?.id === id) {
        this.showEmptyState();
      }
    }
  }

  /**
   * 复制模板
   */
  private duplicateTemplate(id: string): void {
    const duplicated = templateManager.duplicateTemplate(id);
    if (duplicated) {
      this.renderTemplateList(this.elements.search?.value);
      this.editTemplate(duplicated);
    }
  }

  /**
   * 渲染编辑器
   */
  private renderEditor(): void {
    if (!this.elements.editor) return;

    const template = this.state.editingTemplate;
    if (!template) {
      this.showEmptyState();
      return;
    }

    document.getElementById('template-editor-empty')!.style.display = 'none';
    this.elements.editor.style.display = 'block';

    const categories = BUILTIN_CATEGORIES.filter((c) => c.id !== 'all');

    this.elements.editor.innerHTML = `
      <div class="editor-form">
        <div class="form-section">
          <h4>Basic Info</h4>
          <div class="form-row">
            <label>Template Name *</label>
            <input type="text" id="edit-name" value="${this.escapeHtml(template.name)}" placeholder="Enter template name" />
          </div>
          <div class="form-row">
            <label>Description</label>
            <input type="text" id="edit-description" value="${this.escapeHtml(template.description || '')}" placeholder="Brief description of what this template does" />
          </div>
          <div class="form-row">
            <label>Category</label>
            <select id="edit-category">
              ${categories
                .map(
                  (c) =>
                    `<option value="${c.id}" ${template.category === c.id ? 'selected' : ''}>${c.icon} ${c.name}</option>`
                )
                .join('')}
            </select>
          </div>
        </div>

        <div class="form-section">
          <h4>Template Content *</h4>
          <div class="form-row">
            <textarea id="edit-content" rows="10" placeholder="Enter template content. Use {{variableName}} for placeholders.">${this.escapeHtml(template.content)}</textarea>
            <div class="form-hint">Use {{variableName}} syntax for dynamic placeholders</div>
          </div>
        </div>

        <div class="form-section">
          <h4>Variables</h4>
          <div id="variables-list" class="variables-list">
            ${this.renderVariableForms()}
          </div>
          <button id="btn-add-variable" class="secondary">+ Add Variable</button>
        </div>

        <div class="form-section">
          <h4>Preview</h4>
          <pre id="template-preview" class="preview-box"></pre>
        </div>

        <div class="form-actions">
          <button id="btn-cancel-edit" class="secondary">Cancel</button>
          <button id="btn-save-template" class="primary">Save Template</button>
        </div>
      </div>
    `;

    this.attachEditorEventListeners();
    this.updatePreview();
  }

  /**
   * 渲染变量表单
   */
  private renderVariableForms(): string {
    if (this.variableForms.length === 0) {
      return '<div class="no-variables">No variables defined yet. Add variables that are used in the template content.</div>';
    }

    return this.variableForms
      .map((v, index) => `
        <div class="variable-form" data-index="${index}">
          <div class="variable-header">
            <span class="variable-title">${this.escapeHtml(v.id)}</span>
            <button class="btn-remove-variable icon-btn-sm" data-index="${index}" title="Remove">×</button>
          </div>
          <div class="variable-fields">
            <div class="field-row">
              <label>ID</label>
              <input type="text" class="var-id" value="${this.escapeHtml(v.id)}" placeholder="variableName" />
            </div>
            <div class="field-row">
              <label>Label</label>
              <input type="text" class="var-label" value="${this.escapeHtml(v.label)}" placeholder="Display Label" />
            </div>
            <div class="field-row">
              <label>Type</label>
              <select class="var-type">
                <option value="text" ${v.type === 'text' ? 'selected' : ''}>Text</option>
                <option value="textarea" ${v.type === 'textarea' ? 'selected' : ''}>Textarea</option>
                <option value="select" ${v.type === 'select' ? 'selected' : ''}>Select</option>
                <option value="multiselect" ${v.type === 'multiselect' ? 'selected' : ''}>Multi-select</option>
                <option value="number" ${v.type === 'number' ? 'selected' : ''}>Number</option>
              </select>
            </div>
            <div class="field-row">
              <label>Placeholder</label>
              <input type="text" class="var-placeholder" value="${this.escapeHtml(v.placeholder)}" placeholder="Placeholder text" />
            </div>
            <div class="field-row">
              <label>Default Value</label>
              <input type="text" class="var-default" value="${this.escapeHtml(v.defaultValue)}" placeholder="Default value" />
            </div>
            <div class="field-row options-row" style="${v.type === 'select' || v.type === 'multiselect' ? '' : 'display: none;'}">
              <label>Options (comma separated)</label>
              <input type="text" class="var-options" value="${this.escapeHtml(v.options)}" placeholder="option1, option2, option3" />
            </div>
            <div class="field-row checkbox-row">
              <label class="checkbox-label">
                <input type="checkbox" class="var-required" ${v.required ? 'checked' : ''} />
                Required
              </label>
            </div>
          </div>
        </div>
      `).join('');
  }

  /**
   * 绑定编辑器事件
   */
  private attachEditorEventListeners(): void {
    // 内容变化时更新变量和预览
    document.getElementById('edit-content')?.addEventListener('input', () => {
      this.syncVariablesFromContent();
    });

    // 添加变量
    document.getElementById('btn-add-variable')?.addEventListener('click', () => {
      this.variableForms.push({
        id: '',
        name: '',
        type: 'text',
        label: '',
        placeholder: '',
        defaultValue: '',
        required: false,
        options: '',
      });
      this.renderVariablesList();
    });

    // 删除变量
    document.querySelectorAll('.btn-remove-variable').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const index = parseInt((e.currentTarget as HTMLElement).dataset.index!);
        this.variableForms.splice(index, 1);
        this.renderVariablesList();
      });
    });

    // 变量类型变化时显示/隐藏选项
    document.querySelectorAll('.var-type').forEach((select) => {
      select.addEventListener('change', (e) => {
        const type = (e.target as HTMLSelectElement).value;
        const form = (e.target as HTMLElement).closest('.variable-form') as HTMLElement;
        const optionsRow = form.querySelector('.options-row') as HTMLElement;
        if (optionsRow) {
          optionsRow.style.display = type === 'select' || type === 'multiselect' ? '' : 'none';
        }
      });
    });

    // 变量表单变化时更新
    document.querySelectorAll('.variable-form input, .variable-form select').forEach((input) => {
      input.addEventListener('input', () => this.collectVariableForms());
      input.addEventListener('change', () => this.collectVariableForms());
    });

    // 取消
    document.getElementById('btn-cancel-edit')?.addEventListener('click', () => {
      this.showEmptyState();
    });

    // 保存
    document.getElementById('btn-save-template')?.addEventListener('click', () => {
      this.saveTemplate();
    });
  }

  /**
   * 从内容同步变量
   */
  private syncVariablesFromContent(): void {
    const content = (document.getElementById('edit-content') as HTMLTextAreaElement)?.value || '';
    const existingVars = this.variableForms.map((v) => ({
      id: v.id,
      name: v.name || v.id,
      type: v.type,
      label: v.label,
      placeholder: v.placeholder || undefined,
      defaultValue: v.defaultValue || undefined,
      required: v.required,
      options: v.options ? v.options.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
    }));

    // 使用 template-parser 的 syncVariables
    const synced = syncVariables(content, existingVars as any);

    // 更新表单
    this.variableForms = synced.map((v, index) => ({
      id: v.id,
      name: v.name,
      type: v.type,
      label: v.label,
      placeholder: v.placeholder || '',
      defaultValue: typeof v.defaultValue === 'string' ? v.defaultValue : '',
      required: v.required || false,
      options: v.options?.join(', ') || '',
    }));

    this.renderVariablesList();
    this.updatePreview();
  }

  /**
   * 收集变量表单数据
   */
  private collectVariableForms(): void {
    const forms = document.querySelectorAll('.variable-form');
    forms.forEach((form, index) => {
      if (index >= this.variableForms.length) return;

      const v = this.variableForms[index];
      v.id = (form.querySelector('.var-id') as HTMLInputElement)?.value || '';
      v.label = (form.querySelector('.var-label') as HTMLInputElement)?.value || '';
      v.type = (form.querySelector('.var-type') as HTMLSelectElement)?.value as VariableType;
      v.placeholder = (form.querySelector('.var-placeholder') as HTMLInputElement)?.value || '';
      v.defaultValue = (form.querySelector('.var-default') as HTMLInputElement)?.value || '';
      v.required = (form.querySelector('.var-required') as HTMLInputElement)?.checked || false;
      v.options = (form.querySelector('.var-options') as HTMLInputElement)?.value || '';
    });

    this.updatePreview();
  }

  /**
   * 渲染变量列表
   */
  private renderVariablesList(): void {
    const container = document.getElementById('variables-list');
    if (container) {
      container.innerHTML = this.renderVariableForms();
      // 重新绑定事件
      document.querySelectorAll('.btn-remove-variable').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const index = parseInt((e.currentTarget as HTMLElement).dataset.index!);
          this.variableForms.splice(index, 1);
          this.renderVariablesList();
        });
      });

      document.querySelectorAll('.var-type').forEach((select) => {
        select.addEventListener('change', (e) => {
          const type = (e.target as HTMLSelectElement).value;
          const form = (e.target as HTMLElement).closest('.variable-form') as HTMLElement;
          const optionsRow = form.querySelector('.options-row') as HTMLElement;
          if (optionsRow) {
            optionsRow.style.display = type === 'select' || type === 'multiselect' ? '' : 'none';
          }
        });
      });

      document.querySelectorAll('.variable-form input, .variable-form select').forEach((input) => {
        input.addEventListener('input', () => this.collectVariableForms());
        input.addEventListener('change', () => this.collectVariableForms());
      });
    }
  }

  /**
   * 更新预览
   */
  private updatePreview(): void {
    const previewEl = document.getElementById('template-preview');
    if (!previewEl || !this.state.editingTemplate) return;

    const template = this.buildTemplateFromForm();
    const values = createDefaultValues(template.variables);
    const preview = previewTemplate(template, values);

    previewEl.textContent = preview;
  }

  /**
   * 从表单构建模板
   */
  private buildTemplateFromForm(): PromptTemplate {
    const name = (document.getElementById('edit-name') as HTMLInputElement)?.value || 'Untitled';
    const description = (document.getElementById('edit-description') as HTMLInputElement)?.value || '';
    const category = (document.getElementById('edit-category') as HTMLSelectElement)?.value || 'other';
    const content = (document.getElementById('edit-content') as HTMLTextAreaElement)?.value || '';

    const variables: TemplateVariable[] = this.variableForms
      .filter((v) => v.id.trim())
      .map((v, index) => ({
        id: v.id.trim(),
        name: v.name || v.id,
        type: v.type,
        label: v.label || formatVariableName(v.id),
        placeholder: v.placeholder || undefined,
        defaultValue: v.defaultValue || undefined,
        required: v.required,
        options: v.options ? v.options.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
        order: index + 1,
      }));

    return {
      ...this.state.editingTemplate!,
      name,
      description,
      category,
      content,
      variables,
    };
  }

  /**
   * 保存模板
   */
  private saveTemplate(): void {
    const template = this.buildTemplateFromForm();

    // 验证
    if (!template.name.trim()) {
      alert('Template name is required');
      return;
    }
    if (!template.content.trim()) {
      alert('Template content is required');
      return;
    }

    // 保存
    const saved = templateManager.saveTemplate(template);

    this.state.isCreating = false;
    this.state.editingTemplate = saved;
    this.renderTemplateList(this.elements.search?.value);

    // 显示成功提示
    const btn = document.getElementById('btn-save-template') as HTMLButtonElement;
    if (btn) {
      const originalText = btn.textContent;
      btn.textContent = '✓ Saved';
      setTimeout(() => {
        btn.textContent = originalText;
      }, 1500);
    }
  }

  /**
   * 显示空状态
   */
  private showEmptyState(): void {
    this.state.editingTemplate = null;
    this.state.isCreating = false;

    document.getElementById('template-editor-empty')!.style.display = 'block';
    if (this.elements.editor) {
      this.elements.editor.style.display = 'none';
    }
  }

  /**
   * 转换变量为表单状态
   */
  private convertVariablesToForms(variables: TemplateVariable[]): VariableEditState[] {
    return variables.map((v) => ({
      id: v.id,
      name: v.name,
      type: v.type,
      label: v.label,
      placeholder: v.placeholder || '',
      defaultValue: typeof v.defaultValue === 'string' ? v.defaultValue : '',
      required: v.required || false,
      options: v.options?.join(', ') || '',
    }));
  }

  /**
   * HTML 转义
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 打开管理面板
   */
  open(): void {
    this.state.isOpen = true;
    this.elements.panel?.classList.add('show');
    this.renderTemplateList();
    this.showEmptyState();
  }

  /**
   * 关闭管理面板
   */
  close(): void {
    this.state.isOpen = false;
    this.elements.panel?.classList.remove('show');
  }

  /**
   * 切换面板
   */
  toggle(): void {
    if (this.state.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }
}

// 导出单例
export const templateManagerUI = new TemplateManagerUI();

// 导出便捷函数
export function initTemplateManagerUI(): void {
  templateManagerUI.init();
}

export function openTemplateManager(): void {
  templateManagerUI.open();
}

export function closeTemplateManager(): void {
  templateManagerUI.close();
}
