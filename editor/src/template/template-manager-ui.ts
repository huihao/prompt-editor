/**
 * 模板管理器 UI
 * 
 * 提供完整的模板管理界面：新增、编辑、删除模板
 * 变量定义完全从模板内容解析，无需手动设置
 */

import type { PromptTemplate, TemplateVariable } from './template-types';
import { BUILTIN_CATEGORIES, generateId } from './template-types';
import { templateManager } from './template-manager';
import { extractVariableDefinitions } from './template-parser';
import { renderTemplate, previewTemplate, createDefaultValues } from './template-renderer';
import { createTemplateEditor } from './template-editor';
import type { EditorView } from '@codemirror/view';

/** 管理面板状态 */
interface ManagerState {
  isOpen: boolean;
  editingTemplate: PromptTemplate | null;
  isCreating: boolean;
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

  private editorView: EditorView | null = null;

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
      content: '请帮我{{action!:select=审查,重构,优化,解释=审查}}当前代码。',
      variables: [],
      tags: [],
      isBuiltin: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.state.isCreating = true;
    this.state.editingTemplate = newTemplate;
    this.renderEditor();
  }

  /**
   * 编辑模板
   */
  private editTemplate(template: PromptTemplate): void {
    this.state.isCreating = false;
    this.state.editingTemplate = { ...template };
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
            <div id="template-content-editor" class="template-editor-container"></div>
            <div class="form-hint">
              Use placeholders like: 
              <code>{{name}}</code>, 
              <code>{{name!}}</code> (required), 
              <code>{{name:textarea}}</code>, 
              <code>{{name:select=opt1,opt2}}</code>, 
              <code>{{name=default}}</code>, 
              <code>{{name#Label}}</code>
            </div>
          </div>
        </div>

        <div class="form-section">
          <h4>Variables</h4>
          <div id="variables-preview" class="variables-preview">
            <!-- Variables will be auto-detected from content -->
          </div>
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

    this.initCodeMirrorEditor();
    this.updateVariablesPreview();
    this.updatePreview();
    this.attachEditorEventListeners();

    // 自动聚焦到第一个输入框
    setTimeout(() => {
      document.getElementById('edit-name')?.focus();
    }, 50);
  }

  /**
   * 初始化 CodeMirror 编辑器
   */
  private initCodeMirrorEditor(): void {
    const container = document.getElementById('template-content-editor');
    if (!container) return;

    // 清理旧编辑器
    if (this.editorView) {
      this.editorView.destroy();
      this.editorView = null;
    }

    const template = this.state.editingTemplate;
    if (!template) return;

    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    this.editorView = createTemplateEditor(container, {
      content: template.content,
      isDark,
      onChange: () => {
        this.updateVariablesPreview();
        this.updatePreview();
      },
    });
  }

  /**
   * 更新变量预览（从内容自动解析）
   */
  private updateVariablesPreview(): void {
    const container = document.getElementById('variables-preview');
    if (!container || !this.editorView) return;

    const content = this.editorView.state.doc.toString();
    const variables = extractVariableDefinitions(content);

    if (variables.length === 0) {
      container.innerHTML = '<div class="no-variables">No variables found. Add placeholders like {{name}} in the content.</div>';
      return;
    }

    container.innerHTML = variables.map(v => this.renderVariablePreview(v)).join('');
  }

  /**
   * 渲染变量预览项
   */
  private renderVariablePreview(v: TemplateVariable): string {
    const typeIcons: Record<string, string> = {
      text: '📝',
      textarea: '📄',
      select: '📋',
      multiselect: '☑️',
      number: '🔢',
    };
    
    const typeLabel = v.type === 'text' ? '' : ` (${v.type})`;
    const requiredBadge = v.required ? '<span class="var-badge required">required</span>' : '';
    const defaultValue = v.defaultValue !== undefined 
      ? `<span class="var-default">= ${Array.isArray(v.defaultValue) ? v.defaultValue.join(', ') : v.defaultValue}</span>`
      : '';
    const options = v.options && v.options.length > 0
      ? `<span class="var-options">[${v.options.join(', ')}]</span>`
      : '';

    return `
      <div class="variable-preview-item">
        <span class="var-icon">${typeIcons[v.type] || '📝'}</span>
        <span class="var-name">{{${v.id}}}</span>
        <span class="var-label">${this.escapeHtml(v.label)}</span>
        ${typeLabel}
        ${requiredBadge}
        ${defaultValue}
        ${options}
      </div>
    `;
  }

  /**
   * 绑定编辑器事件
   */
  private attachEditorEventListeners(): void {
    // 取消
    document.getElementById('btn-cancel-edit')?.addEventListener('click', () => {
      this.showEmptyState();
    });

    // 保存
    document.getElementById('btn-save-template')?.addEventListener('click', () => {
      this.saveTemplate();
    });

    // 绑定输入框事件，实时同步到状态
    const nameInput = document.getElementById('edit-name') as HTMLInputElement;
    const descInput = document.getElementById('edit-description') as HTMLInputElement;
    const categorySelect = document.getElementById('edit-category') as HTMLSelectElement;

    nameInput?.addEventListener('input', (e) => {
      if (this.state.editingTemplate) {
        this.state.editingTemplate.name = (e.target as HTMLInputElement).value;
      }
    });

    descInput?.addEventListener('input', (e) => {
      if (this.state.editingTemplate) {
        this.state.editingTemplate.description = (e.target as HTMLInputElement).value;
      }
    });

    categorySelect?.addEventListener('change', (e) => {
      if (this.state.editingTemplate) {
        this.state.editingTemplate.category = (e.target as HTMLSelectElement).value;
      }
    });
  }

  /**
   * 更新预览
   */
  private updatePreview(): void {
    const previewEl = document.getElementById('template-preview');
    if (!previewEl || !this.editorView) return;

    const content = this.editorView.state.doc.toString();
    const variables = extractVariableDefinitions(content);
    const template: PromptTemplate = {
      ...this.state.editingTemplate!,
      content,
      variables,
    };
    
    const values = createDefaultValues(variables);
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
    const content = this.editorView?.state?.doc?.toString() || '';
    
    // 从内容自动解析变量
    const variables = extractVariableDefinitions(content);

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

    // 清理 CodeMirror 编辑器
    if (this.editorView) {
      this.editorView.destroy();
      this.editorView = null;
    }

    document.getElementById('template-editor-empty')!.style.display = 'block';
    if (this.elements.editor) {
      this.elements.editor.style.display = 'none';
    }
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
