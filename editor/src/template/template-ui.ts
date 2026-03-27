/**
 * 模板系统 UI 组件
 * 
 * 提供模板选择器、变量填写对话框等界面组件
 */

import type { EditorView } from '@codemirror/view';
import type { PromptTemplate, TemplateCategory, TemplateValues, DataSource } from './template-types';
import { BUILTIN_CATEGORIES } from './template-types';
import { templateManager } from './template-manager';
import { dataSourceManager } from './data-source-manager';
import { templateManagerUI } from './template-manager-ui';
import {
  renderForm,
  collectFormValues,
  validateFormValues,
  renderTemplate,
  previewTemplate,
  createDefaultValues,
} from './template-renderer';

/** 模板选择回调 */
type TemplateSelectCallback = (template: PromptTemplate, content: string) => void;

/** 取消回调 */
type CancelCallback = () => void;

/** UI 状态 */
interface UIState {
  currentCategory: string;
  searchQuery: string;
  selectedTemplate: PromptTemplate | null;
  isFormOpen: boolean;
}

/** 模板 UI 管理器 */
class TemplateUI {
  private state: UIState = {
    currentCategory: 'all',
    searchQuery: '',
    selectedTemplate: null,
    isFormOpen: false,
  };

  private elements: {
    panel?: HTMLElement;
    list?: HTMLElement;
    search?: HTMLInputElement;
    categories?: HTMLElement;
    formDialog?: HTMLElement;
    formFields?: HTMLElement;
    formPreview?: HTMLElement;
    formTitle?: HTMLElement;
  } = {};

  private callbacks: {
    onSelect?: TemplateSelectCallback;
    onCancel?: CancelCallback;
  } = {};

  private editorView: EditorView | null = null;
  private dataSourceCache: Map<string, DataSource> = new Map();

  /**
   * 初始化 UI
   */
  init(editorView?: EditorView): void {
    this.editorView = editorView || null;
    this.cacheDataSources();
    this.createPanel();
    this.createFormDialog();
    this.attachEventListeners();
  }

  /**
   * 缓存数据源以提高性能
   */
  private cacheDataSources(): void {
    this.dataSourceCache.clear();
    for (const ds of dataSourceManager.getAllDataSources()) {
      this.dataSourceCache.set(ds.id, ds);
    }
  }

  /**
   * 创建模板面板
   */
  private createPanel(): void {
    // 检查是否已存在
    if (document.getElementById('template-panel')) {
      this.elements.panel = document.getElementById('template-panel') as HTMLElement;
      this.elements.list = document.getElementById('template-list') as HTMLElement;
      this.elements.search = document.getElementById('template-search-input') as HTMLInputElement;
      this.elements.categories = document.getElementById('template-categories') as HTMLElement;
      return;
    }

    const panel = document.createElement('div');
    panel.id = 'template-panel';
    panel.className = 'side-panel';
    panel.innerHTML = `
      <div class="side-panel-header">
        <h3>📝 Templates</h3>
        <div class="header-actions">
          <button id="btn-manage-templates" class="icon-btn" title="Manage Templates">⚙️</button>
          <button id="btn-close-templates" class="icon-btn" title="Close">×</button>
        </div>
      </div>
      <div class="side-panel-search">
        <input type="text" id="template-search-input" placeholder="Search templates..." />
      </div>
      <div class="side-panel-filters" id="template-categories">
        <!-- Categories will be rendered here -->
      </div>
      <div class="side-panel-content" id="template-list">
        <!-- Templates will be rendered here -->
      </div>
    `;

    document.body.appendChild(panel);

    this.elements.panel = panel;
    this.elements.list = panel.querySelector('#template-list') as HTMLElement;
    this.elements.search = panel.querySelector('#template-search-input') as HTMLInputElement;
    this.elements.categories = panel.querySelector('#template-categories') as HTMLElement;

    this.renderCategories();
    this.renderTemplateList();
  }

  /**
   * 创建变量填写对话框
   */
  private createFormDialog(): void {
    if (document.getElementById('template-form-dialog')) {
      this.elements.formDialog = document.getElementById('template-form-dialog') as HTMLElement;
      this.elements.formFields = document.getElementById('template-form-fields') as HTMLElement;
      this.elements.formPreview = document.getElementById('template-form-preview') as HTMLElement;
      this.elements.formTitle = document.getElementById('template-form-title') as HTMLElement;
      return;
    }

    const dialog = document.createElement('div');
    dialog.id = 'template-form-dialog';
    dialog.className = 'modal';
    dialog.innerHTML = `
      <div class="modal-content template-form-content">
        <div class="modal-header">
          <h3 id="template-form-title">Fill Template</h3>
          <button class="modal-close" id="btn-close-template-form">×</button>
        </div>
        <div class="modal-body">
          <div id="template-form-fields" class="template-form-fields">
            <!-- Form fields will be rendered here -->
          </div>
          <div class="template-preview-section">
            <label>Preview:</label>
            <pre id="template-form-preview" class="template-preview"></pre>
          </div>
        </div>
        <div class="modal-actions">
          <button id="btn-cancel-template" class="secondary">Cancel</button>
          <button id="btn-insert-template" class="primary">Insert</button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    this.elements.formDialog = dialog;
    this.elements.formFields = dialog.querySelector('#template-form-fields') as HTMLElement;
    this.elements.formPreview = dialog.querySelector('#template-form-preview') as HTMLElement;
    this.elements.formTitle = dialog.querySelector('#template-form-title') as HTMLElement;
  }

  /**
   * 绑定事件监听器
   */
  private attachEventListeners(): void {
    // 搜索
    this.elements.search?.addEventListener('input', (e) => {
      this.state.searchQuery = (e.target as HTMLInputElement).value;
      this.renderTemplateList();
    });

    // 关闭面板
    document.getElementById('btn-close-templates')?.addEventListener('click', () => {
      this.hidePanel();
    });

    // 管理模板按钮
    document.getElementById('btn-manage-templates')?.addEventListener('click', () => {
      this.showManagePanel();
    });

    // 表单对话框按钮
    document.getElementById('btn-cancel-template')?.addEventListener('click', () => {
      this.closeFormDialog();
    });

    document.getElementById('btn-close-template-form')?.addEventListener('click', () => {
      this.closeFormDialog();
    });

    document.getElementById('btn-insert-template')?.addEventListener('click', () => {
      this.insertTemplate();
    });

    // 表单输入实时更新预览
    this.elements.formFields?.addEventListener('input', () => {
      this.updatePreview();
    });

    // ESC 关闭对话框
    this.elements.formDialog?.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeFormDialog();
      }
    });

    // 监听数据源变化
    dataSourceManager.onChange(() => {
      this.cacheDataSources();
    });

    // 监听模板变化
    templateManager.onChange(() => {
      this.renderTemplateList();
    });
  }

  /**
   * 渲染分类筛选按钮
   */
  private renderCategories(): void {
    if (!this.elements.categories) return;

    const categories = templateManager.getCategoriesWithCount();

    this.elements.categories.innerHTML = categories
      .map(
        cat => `
          <button
            class="category-btn ${cat.id === this.state.currentCategory ? 'active' : ''}"
            data-category="${cat.id}"
          >
            <span class="category-icon">${cat.icon || '📁'}</span>
            <span class="category-name">${cat.name}</span>
            <span class="category-count">${cat.count}</span>
          </button>
        `
      )
      .join('');

    // 绑定点击事件
    this.elements.categories.querySelectorAll('.category-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const category = (e.currentTarget as HTMLElement).dataset.category!;
        this.state.currentCategory = category;
        this.renderCategories();
        this.renderTemplateList();
      });
    });
  }

  /**
   * 渲染模板列表
   */
  private renderTemplateList(): void {
    if (!this.elements.list) return;

    const templates = templateManager.getTemplates({
      category: this.state.currentCategory === 'all' ? undefined : this.state.currentCategory,
      keyword: this.state.searchQuery,
    });

    if (templates.length === 0) {
      this.elements.list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📝</div>
          <div class="empty-text">No templates found</div>
          ${this.state.searchQuery ? '<div class="empty-hint">Try a different search</div>' : ''}
        </div>
      `;
      return;
    }

    this.elements.list.innerHTML = templates
      .map((template) => this.renderTemplateCard(template))
      .join('');

    // 绑定卡片点击事件
    this.elements.list.querySelectorAll('.template-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.id!;
        const template = templateManager.getTemplate(id);
        if (template) {
          this.selectTemplate(template);
        }
      });
    });
  }

  /**
   * 渲染单个模板卡片
   */
  private renderTemplateCard(template: PromptTemplate): string {
    const category = BUILTIN_CATEGORIES.find((c) => c.id === template.category);
    const categoryIcon = category?.icon || '📄';
    const varCount = template.variables.length;
    const varLabel = varCount === 0 ? 'No variables' : `${varCount} variable${varCount > 1 ? 's' : ''}`;

    return `
      <div class="template-card" data-id="${template.id}">
        <div class="template-card-header">
          <span class="template-icon">${categoryIcon}</span>
          <span class="template-name">${this.escapeHtml(template.name)}</span>
          ${template.isBuiltin ? '<span class="template-badge builtin">Built-in</span>' : ''}
        </div>
        ${template.description ? `<div class="template-desc">${this.escapeHtml(template.description)}</div>` : ''}
        <div class="template-card-footer">
          <span class="template-vars">${varLabel}</span>
          ${template.tags ? template.tags.map((tag) => `<span class="template-tag">${this.escapeHtml(tag)}</span>`).join('') : ''}
        </div>
      </div>
    `;
  }

  /**
   * 选择模板
   */
  private selectTemplate(template: PromptTemplate): void {
    this.state.selectedTemplate = template;

    if (template.variables.length === 0) {
      // 无变量，直接插入
      const content = renderTemplate(template, {});
      this.insertContent(content);
      this.hidePanel();
    } else {
      // 显示变量填写对话框
      this.showFormDialog(template);
    }
  }

  /**
   * 显示变量填写对话框
   */
  private showFormDialog(template: PromptTemplate): void {
    if (!this.elements.formDialog || !this.elements.formFields || !this.elements.formTitle) return;

    this.state.isFormOpen = true;
    this.elements.formTitle.textContent = template.name;

    // 渲染表单
    const formHtml = renderForm(template.variables, this.dataSourceCache);
    this.elements.formFields.innerHTML = formHtml;

    // 初始化预览
    this.updatePreview();

    // 显示对话框
    this.elements.formDialog.classList.add('show');

    // 聚焦第一个输入
    const firstInput = this.elements.formFields.querySelector('input, textarea, select') as HTMLElement;
    if (firstInput) {
      setTimeout(() => firstInput.focus(), 100);
    }
  }

  /**
   * 关闭表单对话框
   */
  private closeFormDialog(): void {
    if (!this.elements.formDialog) return;

    this.state.isFormOpen = false;
    this.state.selectedTemplate = null;
    this.elements.formDialog.classList.remove('show');

    // 恢复焦点到编辑器
    if (this.editorView) {
      this.editorView.focus();
    }

    if (this.callbacks.onCancel) {
      this.callbacks.onCancel();
    }
  }

  /**
   * 更新预览
   */
  private updatePreview(): void {
    if (!this.state.selectedTemplate || !this.elements.formFields || !this.elements.formPreview) return;

    const values = collectFormValues(this.elements.formFields, this.state.selectedTemplate.variables);
    const preview = previewTemplate(this.state.selectedTemplate, values);

    this.elements.formPreview.textContent = preview;
  }

  /**
   * 插入模板内容
   */
  private insertTemplate(): void {
    if (!this.state.selectedTemplate || !this.elements.formFields) return;

    const template = this.state.selectedTemplate;
    const values = collectFormValues(this.elements.formFields, template.variables);

    // 验证
    const validation = validateFormValues(values, template.variables);
    if (!validation.valid) {
      // 显示验证错误
      const firstErrorField = Object.keys(validation.errors)[0];
      const fieldElement = this.elements.formFields.querySelector(`[name="${firstErrorField}"]`) as HTMLElement;
      if (fieldElement) {
        fieldElement.focus();
        fieldElement.classList.add('error');
        setTimeout(() => fieldElement.classList.remove('error'), 3000);
      }
      return;
    }

    const content = renderTemplate(template, values);
    this.insertContent(content);

    this.closeFormDialog();
    this.hidePanel();

    if (this.callbacks.onSelect) {
      this.callbacks.onSelect(template, content);
    }
  }

  /**
   * 插入内容到编辑器
   */
  private insertContent(content: string): void {
    if (!this.editorView) return;

    const view = this.editorView;
    const selection = view.state.selection.main;

    view.dispatch({
      changes: {
        from: selection.from,
        to: selection.to,
        insert: content,
      },
    });

    view.focus();
  }

  /**
   * 显示模板管理面板
   */
  private showManagePanel(): void {
    templateManagerUI.open();
  }

  /**
   * 显示模板面板
   */
  showPanel(): void {
    if (!this.elements.panel) return;

    this.elements.panel.classList.add('open');
    this.renderTemplateList();

    // 聚焦搜索框
    setTimeout(() => {
      this.elements.search?.focus();
    }, 100);
  }

  /**
   * 隐藏模板面板
   */
  hidePanel(): void {
    if (!this.elements.panel) return;

    this.elements.panel.classList.remove('open');

    // 恢复焦点
    if (this.editorView) {
      this.editorView.focus();
    }
  }

  /**
   * 切换面板显示状态
   */
  togglePanel(): void {
    if (this.elements.panel?.classList.contains('open')) {
      this.hidePanel();
    } else {
      this.showPanel();
    }
  }

  /**
   * 设置回调
   */
  onSelect(callback: TemplateSelectCallback): void {
    this.callbacks.onSelect = callback;
  }

  onCancel(callback: CancelCallback): void {
    this.callbacks.onCancel = callback;
  }

  /**
   * 销毁 UI
   */
  destroy(): void {
    this.elements.panel?.remove();
    this.elements.formDialog?.remove();
    this.elements = {};
  }

  /**
   * HTML 转义
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// 导出单例
export const templateUI = new TemplateUI();

// 导出便捷函数
export function initTemplateUI(editorView?: EditorView): void {
  templateUI.init(editorView);
}

export function showTemplatePanel(): void {
  templateUI.showPanel();
}

export function hideTemplatePanel(): void {
  templateUI.hidePanel();
}

export function toggleTemplatePanel(): void {
  templateUI.togglePanel();
}

export function destroyTemplateUI(): void {
  templateUI.destroy();
}
