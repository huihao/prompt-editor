// Snippet Manager UI - Provides interface for managing snippets

import { snippetManager, Snippet, Category } from './snippet-manager';
import logger from './logger';

export class SnippetManagerUI {
  private overlay: HTMLElement | null = null;
  private container: HTMLElement | null = null;
  private currentView: 'list' | 'edit-snippet' | 'edit-category' = 'list';
  private editingItem: Snippet | Category | null = null;
  private selectedCategoryId: string | null = null;

  constructor() {
    this.close = this.close.bind(this);
    this.handleEscape = this.handleEscape.bind(this);
  }

  open(): void {
    if (this.overlay) return;
    
    snippetManager.loadData().then(() => {
      this.createOverlay();
      this.showListView();
    });
  }

  close(): void {
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

  private createOverlay(): void {
    this.overlay = document.createElement('div');
    this.overlay.className = 'snippet-manager-overlay';
    this.overlay.innerHTML = `
      <div class="snippet-manager-modal">
        <div class="snippet-manager-header">
          <h3>📝 Snippet Manager</h3>
          <button class="snippet-manager-close" title="Close">&times;</button>
        </div>
        <div class="snippet-manager-body"></div>
      </div>
    `;

    document.body.appendChild(this.overlay);
    this.container = this.overlay.querySelector('.snippet-manager-body') as HTMLElement;

    // Close button
    const closeBtn = this.overlay.querySelector('.snippet-manager-close') as HTMLElement;
    closeBtn.addEventListener('click', this.close);

    // Click outside to close
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close();
      }
    });

    // Escape key
    document.addEventListener('keydown', this.handleEscape);

    // Setup dragging
    this.setupDragging();
  }

  private setupDragging(): void {
    const modal = this.overlay!.querySelector('.snippet-manager-modal') as HTMLElement;
    const header = this.overlay!.querySelector('.snippet-manager-header') as HTMLElement;
    
    if (!modal || !header) return;

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    // Center the modal initially
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

    // Center after a short delay to ensure rendering
    setTimeout(centerModal, 0);

    header.addEventListener('mousedown', (e) => {
      // Don't drag if clicking close button
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

  // ==================== List View ====================

  private showListView(): void {
    console.log('[SnippetManagerUI] showListView called');
    this.currentView = 'list';
    this.editingItem = null;

    const categories = snippetManager.getCategories();
    console.log('[SnippetManagerUI] Categories count:', categories.length);
    
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
    console.log('[SnippetManagerUI] bindListEvents called');
    // Add category
    const addCategoryBtn = document.getElementById('btn-add-category');
    console.log('[SnippetManagerUI] Add category button:', addCategoryBtn);
    addCategoryBtn?.addEventListener('click', () => {
      console.log('[SnippetManagerUI] Add category button clicked');
      this.showEditCategoryView();
    });

    // Add snippet
    document.getElementById('btn-add-snippet')?.addEventListener('click', () => {
      this.showEditSnippetView();
    });

    // Search
    const searchInput = document.getElementById('snippet-search') as HTMLInputElement;
    searchInput?.addEventListener('input', (e) => {
      const query = (e.target as HTMLInputElement).value;
      this.handleSearch(query);
    });

    // Tree item clicks
    this.container?.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;
      const action = target.dataset.action;
      const id = target.dataset.id;

      if (action === 'add-snippet' && id) {
        this.showEditSnippetView(id);
      } else if (action === 'edit-category' && id) {
        const cat = snippetManager.getCategory(id);
        if (cat) this.showEditCategoryView(cat);
      } else if (action === 'delete-category' && id) {
        await this.deleteCategory(id);
      } else if (action === 'edit-snippet' && id) {
        const snippet = snippetManager.getSnippet(id);
        if (snippet) {
          const catId = this.findSnippetCategoryId(id);
          this.showEditSnippetView(catId || undefined, snippet);
        }
      } else if (action === 'delete-snippet' && id) {
        await this.deleteSnippet(id);
      }
    });

    // Logs
    document.getElementById('btn-logs')?.addEventListener('click', () => {
      logger.info('SnippetManagerUI', 'Logs button clicked');
      this.showLogsView();
    });

    // Export
    document.getElementById('btn-export')?.addEventListener('click', () => {
      logger.info('SnippetManagerUI', 'Export button clicked');
      this.exportSnippets();
    });

    // Import
    document.getElementById('btn-import')?.addEventListener('click', () => {
      logger.info('SnippetManagerUI', 'Import button clicked');
      document.getElementById('import-file')?.click();
    });

    document.getElementById('import-file')?.addEventListener('change', (e) => {
      this.importSnippets(e.target as HTMLInputElement);
    });

    // Reset
    document.getElementById('btn-reset')?.addEventListener('click', () => {
      if (confirm('Reset all snippets to default? This will delete your custom snippets.')) {
        snippetManager.resetToDefault();
        this.showListView();
      }
    });

    // Toggle tree
    this.container?.querySelectorAll('.tree-item-header').forEach(header => {
      header.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.tree-actions')) return;
        const item = (e.currentTarget as HTMLElement).closest('.category-tree-item');
        item?.classList.toggle('collapsed');
      });
    });
  }

  private handleSearch(query: string): void {
    if (!query.trim()) {
      const categories = snippetManager.getCategories();
      const contentEl = this.container?.querySelector('.snippet-manager-content');
      if (contentEl) {
        contentEl.innerHTML = this.renderCategoryTree(categories);
      }
      return;
    }

    const results = snippetManager.searchSnippets(query);
    const contentEl = this.container?.querySelector('.snippet-manager-content');
    if (contentEl) {
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
  }

  // ==================== Edit Snippet View ====================

  private showEditSnippetView(categoryId?: string, snippet?: Snippet): void {
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
          <button class="btn btn-primary" id="btn-save">Save</button>
        </div>
      </div>
    `;

    document.getElementById('btn-cancel')?.addEventListener('click', () => {
      this.showListView();
    });

    document.getElementById('btn-save')?.addEventListener('click', async () => {
      await this.saveSnippet();
    });
  }

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

  private async saveSnippet(): Promise<void> {
    const id = (document.getElementById('snippet-id') as HTMLInputElement)?.value.trim();
    const name = (document.getElementById('snippet-name') as HTMLInputElement)?.value.trim();
    const description = (document.getElementById('snippet-desc') as HTMLInputElement)?.value.trim();
    const content = (document.getElementById('snippet-content') as HTMLTextAreaElement)?.value;
    const categoryId = (document.getElementById('snippet-category') as HTMLSelectElement)?.value;

    if (!id || !name || !content) {
      alert('Please fill in all required fields');
      return;
    }

    const snippet: Snippet = {
      id,
      name,
      description: description || '',
      content
    };

    const isEditing = this.editingItem !== null;
    let success: boolean;

    if (isEditing) {
      success = await snippetManager.updateSnippet(id, snippet);
    } else {
      success = await snippetManager.addSnippet(snippet, categoryId);
    }

    if (success) {
      this.showListView();
    } else {
      alert('Failed to save snippet. ID may already exist.');
    }
  }

  // ==================== Edit Category View ====================

  private showEditCategoryView(category?: Category): void {
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
          <button class="btn btn-primary" id="btn-save">Save</button>
        </div>
      </div>
    `;

    const cancelBtn = document.getElementById('btn-cancel');
    const saveBtn = document.getElementById('btn-save');
    console.log('[SnippetManagerUI] Cancel button:', cancelBtn, 'Save button:', saveBtn);
    
    cancelBtn?.addEventListener('click', () => {
      console.log('[SnippetManagerUI] Cancel clicked');
      this.showListView();
    });

    saveBtn?.addEventListener('click', async () => {
      console.log('[SnippetManagerUI] Save clicked');
      await this.saveCategory();
    });
  }

  private async saveCategory(): Promise<void> {
    logger.info('SnippetManagerUI', 'saveCategory called');

    try {
      const idElement = document.getElementById('category-id') as HTMLInputElement;
      const nameElement = document.getElementById('category-name') as HTMLInputElement;
      const iconElement = document.getElementById('category-icon') as HTMLInputElement;
      const descElement = document.getElementById('category-desc') as HTMLInputElement;
      const parentSelect = document.getElementById('category-parent') as HTMLSelectElement;

      logger.debug('SnippetManagerUI', 'Form elements found', {
        hasId: !!idElement,
        hasName: !!nameElement,
        hasIcon: !!iconElement,
        hasDesc: !!descElement,
        hasParent: !!parentSelect
      });

      const id = idElement?.value.trim();
      const name = nameElement?.value.trim();
      const icon = iconElement?.value.trim() || '📁';
      const description = descElement?.value.trim();
      const parentId = parentSelect?.value || undefined;

      logger.info('SnippetManagerUI', 'Form values extracted', { id, name, icon, description, parentId });

      if (!id || !name) {
        logger.warn('SnippetManagerUI', 'Validation failed: missing required fields', { id: !!id, name: !!name });
        alert('Please fill in all required fields');
        return;
      }

      const category: Category = {
        id,
        name,
        icon,
        description: description || ''
      };

      const isEditing = this.editingItem !== null;
      logger.info('SnippetManagerUI', 'Category object created', { isEditing, category });

      let success: boolean;

      if (isEditing) {
        logger.info('SnippetManagerUI', 'Calling updateCategory');
        success = await snippetManager.updateCategory(id, category);
      } else {
        logger.info('SnippetManagerUI', 'Calling addCategory', { categoryId: category.id, parentId });
        success = await snippetManager.addCategory(category, parentId || undefined);
        logger.info('SnippetManagerUI', 'addCategory returned', { success });
      }

      logger.info('SnippetManagerUI', 'Save operation completed', { success });

      if (success) {
        logger.info('SnippetManagerUI', 'Save successful, showing list view');
        this.showListView();
      } else {
        logger.error('SnippetManagerUI', 'Save failed, showing error alert');
        alert('Failed to save category. ID may already exist.');
      }
    } catch (error) {
      logger.error('SnippetManagerUI', 'Exception in saveCategory', { error: String(error), stack: (error as Error).stack });
      alert('Error saving category: ' + error);
    }
  }

  // ==================== Delete Operations ====================

  private async deleteCategory(id: string): Promise<void> {
    const category = snippetManager.getCategory(id);
    if (!category) return;

    const hasChildren = (category.subcategories?.length || 0) + (category.snippets?.length || 0);
    const message = hasChildren > 0 
      ? `Delete "${category.name}" and all its ${hasChildren} item(s)? This cannot be undone.`
      : `Delete "${category.name}"? This cannot be undone.`;

    if (confirm(message)) {
      const success = await snippetManager.deleteCategory(id);
      if (success) {
        this.showListView();
      }
    }
  }

  private async deleteSnippet(id: string): Promise<void> {
    const snippet = snippetManager.getSnippet(id);
    if (!snippet) return;

    if (confirm(`Delete "${snippet.name}"? This cannot be undone.`)) {
      const success = await snippetManager.deleteSnippet(id);
      if (success) {
        this.showListView();
      }
    }
  }

  // ==================== Import/Export ====================

  private exportSnippets(): void {
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
  }

  private importSnippets(fileInput: HTMLInputElement): void {
    const file = fileInput.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const json = e.target?.result as string;
        const success = await snippetManager.importData(json);
        if (success) {
          alert('Snippets imported successfully!');
          this.showListView();
        } else {
          alert('Failed to import snippets. Invalid file format.');
        }
      } catch (err) {
        alert('Failed to import snippets.');
      }
    };
    reader.readAsText(file);
    fileInput.value = '';
  }

  // ==================== Logs View ====================

  private showLogsView(): void {
    this.currentView = 'logs';

    const logs = logger.getRecentLogs(100);

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

  // ==================== Helper Methods ====================

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

// Export singleton
export const snippetManagerUI = new SnippetManagerUI();
export default snippetManagerUI;
