// Snippet Manager UI - Refactored for reliability
// 完全重构版本 - 解决保存问题

import { snippetManager, Snippet, Category } from './snippet-manager';
import logger from './logger';

export class SnippetManagerUI {
  private overlay: HTMLElement | null = null;
  private container: HTMLElement | null = null;
  private currentView: 'list' | 'edit-snippet' | 'edit-category' | 'logs' = 'list';
  private editingItem: Snippet | Category | null = null;
  private selectedCategoryId: string | null = null;

  constructor() {
    // 绑定方法到实例
    this.close = this.close.bind(this);
    this.handleEscape = this.handleEscape.bind(this);

    // 全局错误捕获
    this.setupGlobalErrorHandling();
  }

  // ==================== 全局错误捕获 ====================
  private setupGlobalErrorHandling(): void {
    // 捕获未处理的 Promise 错误
    window.addEventListener('unhandledrejection', (event) => {
      logger.error('SnippetManagerUI', 'Unhandled Promise rejection', {
        reason: String(event.reason),
        stack: event.reason?.stack || '(no stack)'
      });
      event.preventDefault();
    });

    // 捕获全局 JavaScript 错误
    window.addEventListener('error', (event) => {
      logger.error('SnippetManagerUI', 'Global JavaScript error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });
  }

  // ==================== 公共 API ====================

  open(): void {
    logger.info('SnippetManagerUI', 'open() called');

    if (this.overlay) {
      logger.warn('SnippetManagerUI', 'Panel already open');
      return;
    }

    snippetManager.loadData()
      .then(() => {
        logger.info('SnippetManagerUI', 'Data loaded, creating overlay');
        this.createOverlay();
        this.showListView();
      })
      .catch(error => {
        logger.error('SnippetManagerUI', 'Failed to load data on open', { error: String(error) });
      });
  }

  close(): void {
    logger.info('SnippetManagerUI', 'close() called');

    if (!this.overlay) return;

    document.removeEventListener('keydown', this.handleEscape);
    this.overlay.remove();
    this.overlay = null;
    this.container = null;
    this.currentView = 'list';
    this.editingItem = null;
  }

  isOpen(): boolean {
    return !!this.overlay;
  }

  // ==================== Overlay 创建 ====================

  private createOverlay(): void {
    logger.info('SnippetManagerUI', 'createOverlay() called');

    this.overlay = document.createElement('div');
    this.overlay.className = 'snippet-manager-overlay';
    this.overlay.innerHTML = `
      <div class="snippet-manager-modal">
        <div class="snippet-manager-header">
          <h3>📝 Snippet Manager (v2 - Refactored)</h3>
          <button class="snippet-manager-close" title="Close">&times;</button>
        </div>
        <div class="snippet-manager-body"></div>
      </div>
    `;

    document.body.appendChild(this.overlay);
    this.container = this.overlay.querySelector('.snippet-manager-body') as HTMLElement;

    logger.info('SnippetManagerUI', 'Overlay created and appended to body');

    // 关闭按钮
    const closeBtn = this.overlay.querySelector('.snippet-manager-close') as HTMLElement;
    if (closeBtn) {
      closeBtn.addEventListener('click', this.close);
      logger.info('SnippetManagerUI', 'Close button event bound');
    }

    // 点击外部关闭
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        logger.info('SnippetManagerUI', 'Clicked outside modal, closing');
        this.close();
      }
    });

    // ESC 键
    document.addEventListener('keydown', this.handleEscape);

    // 拖拽
    this.setupDragging();
  }

  private setupDragging(): void {
    // 保持原有拖拽逻辑
    const modal = this.overlay?.querySelector('.snippet-manager-modal') as HTMLElement;
    const header = this.overlay?.querySelector('.snippet-manager-header') as HTMLElement;

    if (!modal || !header) return;

    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;

    const centerModal = () => {
      const rect = modal.getBoundingClientRect();
      const overlayRect = this.overlay!.getBoundingClientRect();
      initialLeft = (overlayRect.width - rect.width) / 2;
      initialTop = (overlayRect.height - rect.height) / 2;
      modal.style.position = 'absolute';
      modal.style.left = `${initialLeft}px`;
      modal.style.top = `${initialTop}px`;
      modal.style.transform = 'none';
      modal.style.margin = '0';
    };

    setTimeout(centerModal, 0);

    header.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement).closest('.snippet-manager-close')) return;

      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;

      const rect = modal.getBoundingClientRect();
      const overlayRect = this.overlay!.getBoundingClientRect();
      initialLeft = rect.left - overlayRect.left;
      initialTop = rect.top - overlayRect.top;

      modal.style.transition = 'none';
      document.body.style.cursor = 'grabbing';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      modal.style.left = `${initialLeft + deltaX}px`;
      modal.style.top = `${initialTop + deltaY}px`;
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        modal.style.transition = '';
        document.body.style.cursor = '';
      }
    });
  }

  private handleEscape(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      if (this.currentView !== 'list') {
        this.showListView();
      } else {
        this.close();
      }
    }
  }

  // ==================== 列表视图 ====================

  private showListView(): void {
    logger.info('SnippetManagerUI', 'showListView() called');
    this.currentView = 'list';
    this.editingItem = null;

    const categories = snippetManager.getCategories();
    logger.info('SnippetManagerUI', 'Categories loaded', { count: categories.length });

    this.container!.innerHTML = `
      <div class="snippet-manager-toolbar">
        <button class="btn btn-primary" id="btn-add-category">📁 New Category</button>
        <button class="btn btn-secondary" id="btn-add-snippet">📝 New Snippet</button>
        <div class="toolbar-spacer"></div>
        <button class="btn btn-icon" id="btn-logs" title="View Logs">📋</button>
        <button class="btn btn-icon" id="btn-export" title="Export">📤</button>
        <button class="btn btn-icon" id="btn-import" title="Import">📥</button>
        <button class="btn btn-icon" id="btn-reset" title="Reset to Default">🔄</button>
      </div>
      <div class="snippet-manager-search">
        <input type="text" id="snippet-search" placeholder="Search snippets..." />
      </div>
      <div class="snippet-manager-content">
        ${this.renderCategoryTree(categories)}
      </div>
      <input type="file" id="import-file" accept=".json" style="display:none" />
    `;

    logger.info('SnippetManagerUI', 'List view HTML rendered');
    this.bindListEvents();
  }

  private renderCategoryTree(categories: Category[], level = 0): string {
    if (categories.length === 0) {
      return '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">No categories yet</div></div>';
    }

    return categories.map(cat => {
      const indent = level * 20;
      const subcats = cat.subcategories || [];
      const snippets = cat.snippets || [];

      return `
        <div class="category-tree-item" style="margin-left: ${indent}px">
          <div class="tree-item-header" data-category-id="${cat.id}">
            <span class="tree-toggle">${subcats.length > 0 ? '▼' : ''}</span>
            <span class="tree-icon">${cat.icon}</span>
            <span class="tree-name">${cat.name}</span>
            <span class="tree-count">${snippets.length}</span>
            <div class="tree-actions">
              <button class="btn-icon-sm" data-action="add-snippet" data-id="${cat.id}" title="Add Snippet">➕</button>
              <button class="btn-icon-sm" data-action="edit-category" data-id="${cat.id}" title="Edit">✏️</button>
              <button class="btn-icon-sm" data-action="delete-category" data-id="${cat.id}" title="Delete">🗑️</button>
            </div>
          </div>
          <div class="tree-children">
            ${snippets.map(s => `
              <div class="tree-snippet-item" data-snippet-id="${s.id}">
                <span class="snippet-icon">📝</span>
                <span class="snippet-name">${s.name}</span>
                <div class="snippet-actions">
                  <button class="btn-icon-sm" data-action="edit-snippet" data-id="${s.id}" title="Edit">✏️</button>
                  <button class="btn-icon-sm" data-action="delete-snippet" data-id="${s.id}" title="Delete">🗑️</button>
                </div>
              </div>
            `).join('')}
            ${this.renderCategoryTree(subcats, level + 1)}
          </div>
        </div>
      `;
    }).join('');
  }

  private bindListEvents(): void {
    logger.info('SnippetManagerUI', 'bindListEvents() - 开始绑定事件');

    // 添加分类按钮
    const addCategoryBtn = document.getElementById('btn-add-category');
    if (addCategoryBtn) {
      addCategoryBtn.addEventListener('click', () => {
        logger.info('SnippetManagerUI', 'Add category button clicked');
        this.showEditCategoryView();
      });
      logger.info('SnippetManagerUI', '✓ Add category button bound');
    } else {
      logger.error('SnippetManagerUI', '✗ Add category button NOT FOUND');
    }

    // 添加 snippet 按钮
    const addSnippetBtn = document.getElementById('btn-add-snippet');
    if (addSnippetBtn) {
      addSnippetBtn.addEventListener('click', () => {
        logger.info('SnippetManagerUI', 'Add snippet button clicked');
        this.showEditSnippetView();
      });
      logger.info('SnippetManagerUI', '✓ Add snippet button bound');
    }

    // 搜索
    const searchInput = document.getElementById('snippet-search') as HTMLInputElement;
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = (e.target as HTMLInputElement).value;
        this.handleSearch(query);
      });
      logger.info('SnippetManagerUI', '✓ Search input bound');
    }

    // 树形项目点击
    this.container?.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;
      const action = target.dataset.action;
      const id = target.dataset.id;

      if (action && id) {
        logger.info('SnippetManagerUI', 'Tree action triggered', { action, id });

        try {
          if (action === 'add-snippet') {
            this.showEditSnippetView(id);
          } else if (action === 'edit-category') {
            const cat = snippetManager.getCategory(id);
            if (cat) this.showEditCategoryView(cat);
          } else if (action === 'delete-category') {
            await this.deleteCategory(id);
          } else if (action === 'edit-snippet') {
            const snippet = snippetManager.getSnippet(id);
            if (snippet) {
              const catId = this.findSnippetCategoryId(id);
              this.showEditSnippetView(catId || undefined, snippet);
            }
          } else if (action === 'delete-snippet') {
            await this.deleteSnippet(id);
          }
        } catch (error) {
          logger.error('SnippetManagerUI', 'Error handling tree action', {
            action,
            id,
            error: String(error),
            stack: (error as Error).stack
          });
        }
      }
    });

    // 日志按钮
    const logsBtn = document.getElementById('btn-logs');
    if (logsBtn) {
      logsBtn.addEventListener('click', () => {
        logger.info('SnippetManagerUI', 'Logs button clicked');
        this.showLogsView();
      });
      logger.info('SnippetManagerUI', '✓ Logs button bound');
    }

    // 导出按钮
    document.getElementById('btn-export')?.addEventListener('click', () => {
      logger.info('SnippetManagerUI', 'Export button clicked');
      this.exportSnippets();
    });

    // 导入按钮
    document.getElementById('btn-import')?.addEventListener('click', () => {
      logger.info('SnippetManagerUI', 'Import button clicked');
      const fileInput = document.getElementById('import-file') as HTMLInputElement;
      if (fileInput) fileInput.click();
    });

    const importFileInput = document.getElementById('import-file') as HTMLInputElement;
    if (importFileInput) {
      importFileInput.addEventListener('change', (e) => {
        this.importSnippets(e.target as HTMLInputElement);
      });
      logger.info('SnippetManagerUI', '✓ Import file input bound');
    }

    // 重置按钮
    document.getElementById('btn-reset')?.addEventListener('click', () => {
      if (confirm('Reset all snippets to default? This will delete your custom snippets.')) {
        logger.info('SnippetManagerUI', 'Reset confirmed by user');
        snippetManager.resetToDefault();
        this.showListView();
      }
    });

    // 折叠/展开树节点
    this.container?.querySelectorAll('.tree-item-header').forEach(header => {
      header.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.tree-actions')) return;

        const item = (e.currentTarget as HTMLElement).closest('.category-tree-item');
        if (item) {
          item.classList.toggle('collapsed');
        }
      });
    });

    logger.info('SnippetManagerUI', 'bindListEvents() 完成 - 所有事件已绑定');
  }

  private handleSearch(query: string): void {
    const contentEl = this.container?.querySelector('.snippet-manager-content');
    if (!contentEl) return;

    if (!query.trim()) {
      const categories = snippetManager.getCategories();
      contentEl.innerHTML = this.renderCategoryTree(categories);
      return;
    }

    const results = snippetManager.searchSnippets(query);

    if (results.length === 0) {
      contentEl.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-text">No results found</div></div>';
    } else {
      contentEl.innerHTML = `
        <div class="search-results">
          ${results.map(r => `
            <div class="search-result-item" data-snippet-id="${r.snippet.id}">
              <div class="result-header">
                <span class="result-icon">📝</span>
                <span class="result-name">${r.snippet.name}</span>
                <div class="result-actions">
                  <button class="btn-icon-sm" data-action="edit-snippet" data-id="${r.snippet.id}">✏️</button>
                  <button class="btn-icon-sm" data-action="delete-snippet" data-id="${r.snippet.id}">🗑️</button>
                </div>
              </div>
              <div class="result-path">${r.path}</div>
              <div class="result-desc">${r.snippet.description}</div>
            </div>
          `).join('')}
        </div>
      `;
    }
  }

  // ==================== 编辑 Snippet 视图 ====================

  private showEditSnippetView(categoryId?: string, snippet?: Snippet): void {
    logger.info('SnippetManagerUI', 'showEditSnippetView() called', {
      categoryId,
      isEditing: !!snippet
    });

    this.currentView = 'edit-snippet';
    this.editingItem = snippet || null;
    this.selectedCategoryId = categoryId || null;

    const categories = snippetManager.getCategories();
    const isEditing = !!snippet;

    this.container!.innerHTML = `
      <div class="snippet-edit-form">
        <h4>${isEditing ? '✏️ Edit Snippet' : '📝 New Snippet'}</h4>
        <div class="form-scroll-container">
          <div class="form-group">
            <label>ID <span class="required">*</span></label>
            <input type="text" id="snippet-id" value="${snippet?.id || ''}" ${isEditing ? 'disabled' : ''} placeholder="unique-snippet-id" />
            <div class="form-hint">Unique identifier, cannot be changed later</div>
          </div>
          <div class="form-group">
            <label>Name <span class="required">*</span></label>
            <input type="text" id="snippet-name" value="${snippet?.name || ''}" placeholder="Snippet Name" />
          </div>
          <div class="form-group">
            <label>Description</label>
            <input type="text" id="snippet-desc" value="${snippet?.description || ''}" placeholder="Brief description" />
          </div>
          <div class="form-group">
            <label>Category</label>
            <select id="snippet-category">
              ${this.renderCategoryOptions(categories, categoryId || '')}
            </select>
          </div>
          <div class="form-group">
            <label>Content <span class="required">*</span></label>
            <textarea id="snippet-content" rows="12" placeholder="Snippet content...">${snippet?.content || ''}</textarea>
          </div>
        </div>
        <div class="form-actions">
          <button class="btn btn-secondary" id="btn-cancel">Cancel</button>
          <button class="btn btn-primary" id="btn-save-snippet">Save Snippet</button>
        </div>
      </div>
    `;

    logger.info('SnippetManagerUI', 'Edit snippet form rendered');

    // 绑定事件
    const cancelBtn = document.getElementById('btn-cancel');
    const saveBtn = document.getElementById('btn-save-snippet');

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        logger.info('SnippetManagerUI', 'Cancel button clicked (snippet edit)');
        this.showListView();
      });
      logger.info('SnippetManagerUI', '✓ Cancel button bound (snippet edit)');
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        logger.info('SnippetManagerUI', 'Save Snippet button clicked');
        await this.handleSaveSnippet();
      });
      logger.info('SnippetManagerUI', '✓ Save Snippet button bound');
    } else {
      logger.error('SnippetManagerUI', '✗ Save Snippet button NOT FOUND');
    }
  }

  private async handleSaveSnippet(): Promise<void> {
    logger.info('SnippetManagerUI', 'handleSaveSnippet() called');

    try {
      // 获取表单元素
      const idEl = document.getElementById('snippet-id') as HTMLInputElement;
      const nameEl = document.getElementById('snippet-name') as HTMLInputElement;
      const descEl = document.getElementById('snippet-desc') as HTMLInputElement;
      const contentEl = document.getElementById('snippet-content') as HTMLTextAreaElement;
      const categoryEl = document.getElementById('snippet-category') as HTMLSelectElement;

      logger.debug('SnippetManagerUI', 'Form elements retrieved', {
        hasId: !!idEl,
        hasName: !!nameEl,
        hasDesc: !!descEl,
        hasContent: !!contentEl,
        hasCategory: !!categoryEl
      });

      // 获取值
      const id = idEl?.value.trim();
      const name = nameEl?.value.trim();
      const description = descEl?.value.trim();
      const content = contentEl?.value;
      const categoryId = categoryEl?.value;

      logger.info('SnippetManagerUI', 'Form values', { id, name, description, categoryId, contentLength: content?.length });

      // 验证
      if (!id || !name || !content) {
        logger.warn('SnippetManagerUI', 'Validation failed', { hasId: !!id, hasName: !!name, hasContent: !!content });
        alert('Please fill in ID, Name, and Content');
        return;
      }

      // 创建 snippet 对象
      const snippet: Snippet = {
        id,
        name,
        description: description || '',
        content
      };

      logger.info('SnippetManagerUI', 'Snippet object created', snippet);

      // 调用 API
      const isEditing = this.editingItem !== null;
      let success: boolean;

      if (isEditing) {
        logger.info('SnippetManagerUI', 'Calling updateSnippet API');
        success = await snippetManager.updateSnippet(id, snippet);
      } else {
        logger.info('SnippetManagerUI', 'Calling addSnippet API', { snippetId: id, categoryId });
        success = await snippetManager.addSnippet(snippet, categoryId);
      }

      logger.info('SnippetManagerUI', 'API call result', { success });

      if (success) {
        logger.info('SnippetManagerUI', 'Snippet saved successfully');
        this.showListView();
      } else {
        logger.error('SnippetManagerUI', 'Snippet save failed');
        alert('Failed to save snippet. ID may already exist.');
      }
    } catch (error) {
      logger.error('SnippetManagerUI', 'Exception in handleSaveSnippet', {
        error: String(error),
        stack: (error as Error).stack
      });
      alert('Error saving snippet: ' + String(error));
    }
  }

  // ==================== 编辑 Category 视图 ====================

  private showEditCategoryView(category?: Category): void {
    logger.info('SnippetManagerUI', 'showEditCategoryView() called', {
      isEditing: !!category,
      categoryId: category?.id
    });

    this.currentView = 'edit-category';
    this.editingItem = category || null;

    const isEditing = !!category;
    const categories = snippetManager.getCategories();

    this.container!.innerHTML = `
      <div class="snippet-edit-form">
        <h4>${isEditing ? '✏️ Edit Category' : '📁 New Category'}</h4>
        <div class="form-scroll-container">
          <div class="form-group">
            <label>ID <span class="required">*</span></label>
            <input type="text" id="category-id" value="${category?.id || ''}" ${isEditing ? 'disabled' : ''} placeholder="unique-category-id" />
            <div class="form-hint">Unique identifier, cannot be changed later</div>
          </div>
          <div class="form-group">
            <label>Name <span class="required">*</span></label>
            <input type="text" id="category-name" value="${category?.name || ''}" placeholder="Category Name" />
          </div>
          <div class="form-group">
            <label>Icon</label>
            <input type="text" id="category-icon" value="${category?.icon || '📁'}" placeholder="📁" />
            <div class="form-hint">Emoji or icon character</div>
          </div>
          <div class="form-group">
            <label>Description</label>
            <input type="text" id="category-desc" value="${category?.description || ''}" placeholder="Brief description" />
          </div>
          ${!isEditing ? `
          <div class="form-group">
            <label>Parent Category (optional)</label>
            <select id="category-parent">
              <option value="">-- Root Level --</option>
              ${this.renderCategoryOptions(categories, '')}
            </select>
          </div>
          ` : ''}
        </div>
        <div class="form-actions">
          <button class="btn btn-secondary" id="btn-cancel">Cancel</button>
          <button class="btn btn-primary btn-save-category">Save Category</button>
        </div>
      </div>
    `;

    logger.info('SnippetManagerUI', 'Edit category form rendered');

    // 绑定事件 - 使用更可靠的方式
    const cancelBtn = document.getElementById('btn-cancel');
    const saveBtn = document.querySelector('.btn-save-category');

    logger.info('SnippetManagerUI', 'Buttons found', {
      hasCancel: !!cancelBtn,
      hasSave: !!saveBtn,
      saveBtnClass: saveBtn?.className
    });

    if (cancelBtn) {
      // 使用 onclick 直接绑定，确保可靠性
      cancelBtn.onclick = () => {
        logger.info('SnippetManagerUI', 'Cancel button clicked (category edit)');
        this.showListView();
      };
      logger.info('SnippetManagerUI', '✓ Cancel button bound (category edit)');
    } else {
      logger.error('SnippetManagerUI', '✗ Cancel button NOT FOUND');
    }

    if (saveBtn) {
      // 使用 onclick 直接绑定，确保可靠性
      saveBtn.onclick = async () => {
        logger.info('SnippetManagerUI', 'Save Category button clicked');
        await this.handleSaveCategory();
      };
      logger.info('SnippetManagerUI', '✓ Save Category button bound');
    } else {
      logger.error('SnippetManagerUI', '✗ Save Category button NOT FOUND');

      // 尝试备用查找方式
      const backupSaveBtn = document.getElementById('btn-save') || document.querySelector('.form-actions .btn-primary');
      if (backupSaveBtn) {
        logger.info('SnippetManagerUI', 'Found backup save button, binding it');
        backupSaveBtn.onclick = async () => {
          logger.info('SnippetManagerUI', 'Backup Save button clicked');
          await this.handleSaveCategory();
        };
      }
    }
  }

  private async handleSaveCategory(): Promise<void> {
    logger.info('SnippetManagerUI', '★★★ handleSaveCategory() called ★★★');

    try {
      // 获取表单元素
      const idEl = document.getElementById('category-id') as HTMLInputElement;
      const nameEl = document.getElementById('category-name') as HTMLInputElement;
      const iconEl = document.getElementById('category-icon') as HTMLInputElement;
      const descEl = document.getElementById('category-desc') as HTMLInputElement;
      const parentEl = document.getElementById('category-parent') as HTMLSelectElement;

      logger.debug('SnippetManagerUI', 'Form elements check', {
        hasIdEl: !!idEl,
        hasNameEl: !!nameEl,
        hasIconEl: !!iconEl,
        hasDescEl: !!descEl,
        hasParentEl: !!parentEl
      });

      if (!idEl || !nameEl) {
        logger.error('SnippetManagerUI', 'Form elements missing!', {
          idEl: !!idEl,
          nameEl: !!nameEl
        });
        alert('Form elements not found. Please try again.');
        return;
      }

      // 获取值
      const id = idEl.value.trim();
      const name = nameEl.value.trim();
      const icon = iconEl?.value.trim() || '📁';
      const description = descEl?.value.trim() || '';
      const parentId = parentEl?.value || undefined;

      logger.info('SnippetManagerUI', '★ Form values extracted', {
        id,
        name,
        icon,
        description,
        parentId
      });

      // 验证必填字段
      if (!id || !name) {
        logger.warn('SnippetManagerUI', 'Validation failed', {
          hasId: !!id,
          hasName: !!name
        });
        alert('Please fill in ID and Name');
        return;
      }

      logger.info('SnippetManagerUI', '✓ Validation passed');

      // 创建分类对象
      const category: Category = {
        id,
        name,
        icon,
        description
      };

      logger.info('SnippetManagerUI', '★ Category object created', category);

      // 判断是否编辑模式
      const isEditing = this.editingItem !== null;
      logger.info('SnippetManagerUI', 'Edit mode', { isEditing });

      // 调用 API
      let success: boolean;

      if (isEditing) {
        logger.info('SnippetManagerUI', '★ Calling updateCategory API');
        success = await snippetManager.updateCategory(id, category);
      } else {
        logger.info('SnippetManagerUI', '★ Calling addCategory API', {
          categoryId: id,
          parentId: parentId
        });
        success = await snippetManager.addCategory(category, parentId);
      }

      logger.info('SnippetManagerUI', '★ API call completed', { success });

      if (success) {
        logger.info('SnippetManagerUI', '✓✓✓ Category saved successfully!');
        alert('✓ Category saved successfully!');
        this.showListView();
      } else {
        logger.error('SnippetManagerUI', '✗✗✗ Category save failed');
        alert('Failed to save category. ID may already exist.');
      }
    } catch (error) {
      logger.error('SnippetManagerUI', '✗✗✗ Exception in handleSaveCategory', {
        error: String(error),
        stack: (error as Error).stack
      });
      alert('Error saving category: ' + String(error));
    }
  }

  // ==================== 删除操作 ====================

  private async deleteCategory(id: string): Promise<void> {
    logger.info('SnippetManagerUI', 'deleteCategory() called', { id });

    const category = snippetManager.getCategory(id);
    if (!category) {
      logger.warn('SnippetManagerUI', 'Category not found', { id });
      return;
    }

    const hasChildren = (category.subcategories?.length || 0) + (category.snippets?.length || 0);
    const message = hasChildren > 0
      ? `Delete "${category.name}" and all its ${hasChildren} item(s)? This cannot be undone.`
      : `Delete "${category.name}"? This cannot be undone.`;

    if (confirm(message)) {
      logger.info('SnippetManagerUI', 'Delete confirmed', { id, hasChildren });

      try {
        const success = await snippetManager.deleteCategory(id);
        logger.info('SnippetManagerUI', 'Delete result', { success });

        if (success) {
          this.showListView();
        }
      } catch (error) {
        logger.error('SnippetManagerUI', 'Error deleting category', {
          id,
          error: String(error)
        });
        alert('Error deleting category: ' + String(error));
      }
    }
  }

  private async deleteSnippet(id: string): Promise<void> {
    logger.info('SnippetManagerUI', 'deleteSnippet() called', { id });

    const snippet = snippetManager.getSnippet(id);
    if (!snippet) {
      logger.warn('SnippetManagerUI', 'Snippet not found', { id });
      return;
    }

    if (confirm(`Delete "${snippet.name}"? This cannot be undone.`)) {
      logger.info('SnippetManagerUI', 'Delete confirmed', { id });

      try {
        const success = await snippetManager.deleteSnippet(id);
        logger.info('SnippetManagerUI', 'Delete result', { success });

        if (success) {
          this.showListView();
        }
      } catch (error) {
        logger.error('SnippetManagerUI', 'Error deleting snippet', {
          id,
          error: String(error)
        });
        alert('Error deleting snippet: ' + String(error));
      }
    }
  }

  // ==================== 导入导出 ====================

  private exportSnippets(): void {
    logger.info('SnippetManagerUI', 'exportSnippets() called');

    try {
      const json = snippetManager.exportData();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `prompt-snippets-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      logger.info('SnippetManagerUI', 'Export completed');
    } catch (error) {
      logger.error('SnippetManagerUI', 'Export failed', { error: String(error) });
      alert('Failed to export: ' + String(error));
    }
  }

  private importSnippets(fileInput: HTMLInputElement): void {
    logger.info('SnippetManagerUI', 'importSnippets() called');

    const file = fileInput.files?.[0];
    if (!file) {
      logger.warn('SnippetManagerUI', 'No file selected');
      return;
    }

    logger.info('SnippetManagerUI', 'File selected', { fileName: file.name, fileSize: file.size });

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const json = e.target?.result as string;
        logger.debug('SnippetManagerUI', 'File read', { jsonLength: json.length });

        const success = await snippetManager.importData(json);
        logger.info('SnippetManagerUI', 'Import result', { success });

        if (success) {
          alert('Snippets imported successfully!');
          this.showListView();
        } else {
          alert('Failed to import. Invalid file format.');
        }
      } catch (err) {
        logger.error('SnippetManagerUI', 'Import error', { error: String(err) });
        alert('Failed to import: ' + String(err));
      }
    };

    reader.onerror = () => {
      logger.error('SnippetManagerUI', 'FileReader error');
      alert('Failed to read file');
    };

    reader.readAsText(file);
    fileInput.value = '';
  }

  // ==================== 日志视图 ====================

  private showLogsView(): void {
    logger.info('SnippetManagerUI', 'showLogsView() called');
    this.currentView = 'logs';

    const logs = logger.getRecentLogs(100);
    logger.debug('SnippetManagerUI', 'Logs retrieved', { logCount: logs.split('\n').length });

    this.container!.innerHTML = `
      <div class="logs-view">
        <h4>📋 Debug Logs (Last 100 entries)</h4>
        <div class="logs-toolbar">
          <button class="btn btn-secondary" id="btn-back">← Back</button>
          <button class="btn btn-primary" id="btn-export-logs">Export All Logs</button>
          <button class="btn btn-warning" id="btn-clear-logs">Clear Logs</button>
        </div>
        <div class="logs-content">
          <textarea id="logs-textarea" rows="20" readonly>${logs}</textarea>
        </div>
      </div>
    `;

    document.getElementById('btn-back')?.addEventListener('click', () => {
      this.showListView();
    });

    document.getElementById('btn-export-logs')?.addEventListener('click', () => {
      logger.exportLogs();
      alert('Logs exported to file');
    });

    document.getElementById('btn-clear-logs')?.addEventListener('click', () => {
      if (confirm('Clear all logs?')) {
        logger.clearLogs();
        this.showLogsView();
      }
    });
  }

  // ==================== 辅助方法 ====================

  private renderCategoryOptions(categories: Category[], selectedId: string, prefix = ''): string {
    return categories.map(cat => {
      const selected = cat.id === selectedId ? 'selected' : '';
      const options = [`<option value="${cat.id}" ${selected}>${prefix}${cat.name}</option>`];

      if (cat.subcategories) {
        options.push(this.renderCategoryOptions(cat.subcategories, selectedId, prefix + '  '));
      }

      return options.join('');
    }).join('');
  }

  private findSnippetCategoryId(snippetId: string): string | null {
    const categories = snippetManager.getCategories();

    const findInCategories = (cats: Category[]): string | null => {
      for (const cat of cats) {
        if (cat.snippets?.some(s => s.id === snippetId)) {
          return cat.id;
        }

        if (cat.subcategories) {
          const found = findInCategories(cat.subcategories);
          if (found) return found;
        }
      }
      return null;
    };

    return findInCategories(categories);
  }
}

// 导出单例
export const snippetManagerUI = new SnippetManagerUI();
export default snippetManagerUI;

// 全局暴露给调试（window 对象）
if (typeof window !== 'undefined') {
  (window as any).snippetManagerUI = snippetManagerUI;

  // 提供全局测试函数
  (window as any).testSaveCategory = async (id: string, name: string, parentId?: string) => {
    console.log('★★★ Global test: saving category ★★★');
    const category = { id, name, icon: '🧪', description: 'Test via global function' };

    try {
      const success = await snippetManager.addCategory(category, parentId);
      console.log('Result:', success);

      if (success) {
        console.log('✓ Saved! Check logs:');
        const logs = logger.getRecentLogs(10);
        logs.split('\n').forEach(line => console.log(line));
      } else {
        console.log('✗ Failed');
      }
    } catch (error) {
      console.log('✗ Exception:', error);
    }
  };

  console.log('✓ Snippet Manager UI loaded. Global test functions available:');
  console.log('  - window.snippetManagerUI');
  console.log('  - window.testSaveCategory(id, name, parentId)');
}