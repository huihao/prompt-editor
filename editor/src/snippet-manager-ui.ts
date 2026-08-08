import { Category, Snippet, snippetManager } from './snippet-manager';
import { escapeHTML } from './snippet-rendering';
import logger from './logger';

type ManagerView = 'list' | 'edit-snippet' | 'edit-category' | 'logs';
type MessageTone = 'error' | 'success';

export class SnippetManagerUI {
  private overlay: HTMLElement | null = null;
  private container: HTMLElement | null = null;
  private currentView: ManagerView = 'list';
  private editingItem: Snippet | Category | null = null;
  private selectedCategoryId: string | null = null;
  private collapsedCategoryIds = new Set<string>();
  private opener: HTMLElement | null = null;
  private formBaseline = '';
  private isSaving = false;
  private dragAbortController: AbortController | null = null;

  async open(opener: HTMLElement | null = document.activeElement as HTMLElement | null): Promise<void> {
    if (this.overlay) return;

    this.opener = opener;
    await snippetManager.loadData();
    this.createOverlay();
    this.showListView();
  }

  close(force = false): void {
    if (!this.overlay || (!force && !this.canDiscardForm())) return;

    document.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('resize', this.clampModalToViewport);
    this.dragAbortController?.abort();
    this.dragAbortController = null;
    this.overlay.remove();
    this.overlay = null;
    this.container = null;
    this.currentView = 'list';
    this.editingItem = null;
    this.formBaseline = '';
    const opener = this.opener;
    this.opener = null;
    opener?.focus();
  }

  isOpen(): boolean {
    return this.overlay !== null;
  }

  private createOverlay(): void {
    this.overlay = document.createElement('div');
    this.overlay.className = 'snippet-manager-overlay';
    this.overlay.innerHTML = `
      <div class="snippet-manager-modal" role="dialog" aria-modal="true" aria-labelledby="snippet-manager-title">
        <div class="snippet-manager-header">
          <h3 id="snippet-manager-title">Prompt Snippet Manager</h3>
          <button type="button" class="snippet-manager-close" data-action="close" aria-label="Close">&times;</button>
        </div>
        <div class="snippet-manager-body"></div>
      </div>
    `;
    document.body.appendChild(this.overlay);
    this.container = this.overlay.querySelector('.snippet-manager-body');

    this.overlay.addEventListener('click', this.handleOverlayClick);
    this.overlay.addEventListener('input', this.handleOverlayInput);
    this.overlay.addEventListener('change', this.handleOverlayChange);
    this.overlay.addEventListener('submit', this.handleOverlaySubmit);
    document.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('resize', this.clampModalToViewport);
    this.setupDragging();
  }

  private handleOverlayClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement;
    if (target === this.overlay) {
      this.close();
      return;
    }

    const actionTarget = target.closest<HTMLElement>('[data-action]');
    if (actionTarget) {
      event.preventDefault();
      void this.handleAction(actionTarget.dataset.action || '', actionTarget.dataset.id || '');
      return;
    }

    const header = target.closest<HTMLElement>('.tree-item-header');
    if (header) this.toggleCategory(header.dataset.categoryId || '');
  };

  private handleOverlayInput = (event: Event): void => {
    const target = event.target as HTMLInputElement;
    if (target.id === 'snippet-search') this.handleSearch(target.value);
    if (target.id) this.clearFieldError(target.id);
  };

  private handleOverlayChange = (event: Event): void => {
    const target = event.target as HTMLInputElement;
    if (target.id === 'import-file') void this.importSnippets(target);
  };

  private handleOverlaySubmit = (event: SubmitEvent): void => {
    event.preventDefault();
  };

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.overlay) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      if (this.currentView === 'list') this.close();
      else this.returnToList();
      return;
    }

    if (event.key === 'Tab') this.trapFocus(event);
  };

  private async handleAction(action: string, id: string): Promise<void> {
    switch (action) {
      case 'close': this.close(); break;
      case 'add-category': this.showEditCategoryView(); break;
      case 'add-snippet': this.showEditSnippetView(id || undefined); break;
      case 'edit-category': {
        const category = snippetManager.getCategory(id);
        if (category && !snippetManager.isBuiltInCategory(id)) this.showEditCategoryView(category);
        break;
      }
      case 'delete-category': await this.deleteCategory(id); break;
      case 'edit-snippet': {
        const snippet = snippetManager.getSnippet(id);
        if (snippet && !snippetManager.isBuiltInSnippet(id)) {
          this.showEditSnippetView(this.findSnippetCategoryId(id) || undefined, snippet, true);
        }
        break;
      }
      case 'copy-snippet': this.copyBuiltInSnippet(id); break;
      case 'delete-snippet': await this.deleteSnippet(id); break;
      case 'logs': this.showLogsView(); break;
      case 'export': this.exportSnippets(); break;
      case 'import': this.container?.querySelector<HTMLInputElement>('#import-file')?.click(); break;
      case 'reset': await this.resetSnippets(); break;
      case 'cancel': this.returnToList(); break;
      case 'save-snippet': await this.handleSaveSnippet(); break;
      case 'save-category': await this.handleSaveCategory(); break;
      case 'back': this.showListView(); break;
      case 'export-logs': logger.exportLogs(); break;
      case 'clear-logs':
        if (confirm('Clear all logs?')) {
          logger.clearLogs();
          this.showLogsView();
        }
        break;
    }
  }

  private showListView(message?: { text: string; tone: MessageTone }): void {
    if (!this.container) return;
    this.currentView = 'list';
    this.editingItem = null;
    this.selectedCategoryId = null;
    this.formBaseline = '';
    this.container.innerHTML = `
      <div class="snippet-manager-toolbar">
        <button type="button" class="btn btn-primary" id="btn-add-category" data-action="add-category">New Category</button>
        <button type="button" class="btn btn-secondary" id="btn-add-snippet" data-action="add-snippet">New Snippet</button>
        <div class="toolbar-spacer"></div>
        <button type="button" class="btn btn-icon" data-action="logs" title="View logs" aria-label="View logs">&#128203;</button>
        <button type="button" class="btn btn-icon" data-action="export" title="Export snippets" aria-label="Export snippets">&#8681;</button>
        <button type="button" class="btn btn-icon" data-action="import" title="Import snippets" aria-label="Import snippets">&#8679;</button>
        <button type="button" class="btn btn-icon" data-action="reset" title="Reset custom snippets" aria-label="Reset custom snippets">&#8635;</button>
      </div>
      ${message ? `<div class="panel-message ${message.tone}" role="status">${escapeHTML(message.text)}</div>` : ''}
      <div class="snippet-manager-search">
        <label class="sr-only" for="snippet-search">Search snippets</label>
        <input type="search" id="snippet-search" placeholder="Search snippets..." autocomplete="off" />
      </div>
      <div class="snippet-manager-content">${this.renderCategoryTree(snippetManager.getCategories())}</div>
      <input type="file" id="import-file" accept="application/json,.json" hidden />
    `;
    this.container.querySelector<HTMLInputElement>('#snippet-search')?.focus();
  }

  private renderCategoryTree(categories: Category[], level = 0): string {
    if (categories.length === 0) {
      return level === 0
        ? '<div class="empty-state"><div class="empty-text">No categories yet</div></div>'
        : '';
    }

    return categories.map(category => {
      const subcategories = category.subcategories || [];
      const snippets = category.snippets || [];
      const builtIn = snippetManager.isBuiltInCategory(category.id);
      const collapsed = this.collapsedCategoryIds.has(category.id) ? ' collapsed' : '';
      const hasChildren = subcategories.length > 0 || snippets.length > 0;
      const actions = builtIn
        ? `<span class="origin-badge">Built-in</span>
           <button type="button" class="btn-icon-sm" data-action="add-snippet" data-id="${escapeHTML(category.id)}" aria-label="Add snippet to ${escapeHTML(category.name)}">+</button>`
        : `<button type="button" class="btn-icon-sm" data-action="add-snippet" data-id="${escapeHTML(category.id)}" aria-label="Add snippet to ${escapeHTML(category.name)}">+</button>
           <button type="button" class="btn-icon-sm" data-action="edit-category" data-id="${escapeHTML(category.id)}" aria-label="Edit ${escapeHTML(category.name)}">&#9998;</button>
           <button type="button" class="btn-icon-sm" data-action="delete-category" data-id="${escapeHTML(category.id)}" aria-label="Delete ${escapeHTML(category.name)}">&#9003;</button>`;
      return `
        <div class="category-tree-item${collapsed}" style="margin-left:${level * 20}px">
          <div class="tree-item-header" data-category-id="${escapeHTML(category.id)}" role="button" tabindex="0" aria-expanded="${!this.collapsedCategoryIds.has(category.id)}">
            <span class="tree-toggle">${hasChildren ? '&#9660;' : ''}</span>
            <span class="tree-icon">${escapeHTML(category.icon)}</span>
            <span class="tree-name">${escapeHTML(category.name)}</span>
            <span class="tree-count">${snippets.length}</span>
            <div class="tree-actions">${actions}</div>
          </div>
          <div class="tree-children">
            ${snippets.map(snippet => this.renderSnippetRow(snippet)).join('')}
            ${this.renderCategoryTree(subcategories, level + 1)}
          </div>
        </div>
      `;
    }).join('');
  }

  private renderSnippetRow(snippet: Snippet): string {
    const builtIn = snippetManager.isBuiltInSnippet(snippet.id);
    const actions = builtIn
      ? `<span class="origin-badge">Built-in</span>
         <button type="button" class="btn-icon-sm" data-action="copy-snippet" data-id="${escapeHTML(snippet.id)}" aria-label="Copy ${escapeHTML(snippet.name)}">&#10697;</button>`
      : `<button type="button" class="btn-icon-sm" data-action="edit-snippet" data-id="${escapeHTML(snippet.id)}" aria-label="Edit ${escapeHTML(snippet.name)}">&#9998;</button>
         <button type="button" class="btn-icon-sm" data-action="delete-snippet" data-id="${escapeHTML(snippet.id)}" aria-label="Delete ${escapeHTML(snippet.name)}">&#9003;</button>`;
    return `
      <div class="tree-snippet-item" data-snippet-id="${escapeHTML(snippet.id)}">
        <span class="snippet-icon">&#128221;</span>
        <span class="snippet-name">${escapeHTML(snippet.name)}</span>
        <div class="snippet-actions">${actions}</div>
      </div>
    `;
  }

  private toggleCategory(id: string): void {
    if (!id) return;
    if (this.collapsedCategoryIds.has(id)) this.collapsedCategoryIds.delete(id);
    else this.collapsedCategoryIds.add(id);

    const header = Array.from(this.container?.querySelectorAll<HTMLElement>('.tree-item-header') || [])
      .find(item => item.dataset.categoryId === id);
    const category = header?.closest('.category-tree-item');
    category?.classList.toggle('collapsed', this.collapsedCategoryIds.has(id));
    header?.setAttribute('aria-expanded', String(!this.collapsedCategoryIds.has(id)));
  }

  private handleSearch(query: string): void {
    const content = this.container?.querySelector<HTMLElement>('.snippet-manager-content');
    if (!content) return;
    if (!query.trim()) {
      content.innerHTML = this.renderCategoryTree(snippetManager.getCategories());
      return;
    }

    const results = snippetManager.searchSnippets(query);
    content.innerHTML = results.length === 0
      ? '<div class="empty-state"><div class="empty-text">No results found</div></div>'
      : `<div class="search-results">${results.map(result => `
          <div class="search-result-item" data-snippet-id="${escapeHTML(result.snippet.id)}">
            <div class="result-header">
              <span class="result-name">${escapeHTML(result.snippet.name)}</span>
              <div class="result-actions">${this.renderSearchActions(result.snippet)}</div>
            </div>
            <div class="result-path">${escapeHTML(result.path)}</div>
            <div class="result-desc">${escapeHTML(result.snippet.description)}</div>
          </div>
        `).join('')}</div>`;
  }

  private renderSearchActions(snippet: Snippet): string {
    return snippetManager.isBuiltInSnippet(snippet.id)
      ? `<button type="button" class="btn-icon-sm" data-action="copy-snippet" data-id="${escapeHTML(snippet.id)}" aria-label="Copy ${escapeHTML(snippet.name)}">&#10697;</button>`
      : `<button type="button" class="btn-icon-sm" data-action="edit-snippet" data-id="${escapeHTML(snippet.id)}" aria-label="Edit ${escapeHTML(snippet.name)}">&#9998;</button>
         <button type="button" class="btn-icon-sm" data-action="delete-snippet" data-id="${escapeHTML(snippet.id)}" aria-label="Delete ${escapeHTML(snippet.name)}">&#9003;</button>`;
  }

  private showEditSnippetView(categoryId?: string, snippet?: Snippet, editing = Boolean(snippet)): void {
    if (!this.container) return;
    this.currentView = 'edit-snippet';
    this.editingItem = editing ? snippet || null : null;
    this.selectedCategoryId = categoryId || null;
    const selectedCategoryId = categoryId || this.firstCategoryId(snippetManager.getCategories()) || '';
    this.container.innerHTML = `
      <form class="snippet-edit-form" novalidate>
        <h4>${editing ? 'Edit Snippet' : 'New Snippet'}</h4>
        <div class="form-scroll-container">
          ${this.renderTextField('snippet-id', 'ID', snippet?.id || '', 'unique-snippet-id', true, editing)}
          ${this.renderTextField('snippet-name', 'Name', snippet?.name || '', 'Snippet name', true)}
          ${this.renderTextField('snippet-desc', 'Description', snippet?.description || '', 'Brief description')}
          <div class="form-group">
            <label for="snippet-category">Category</label>
            <select id="snippet-category">${this.renderCategoryOptions(snippetManager.getCategories(), selectedCategoryId)}</select>
          </div>
          <div class="form-group">
            <label for="snippet-content">Content <span class="required">*</span></label>
            <textarea id="snippet-content" rows="12" placeholder="Snippet content...">${escapeHTML(snippet?.content || '')}</textarea>
            <div class="form-error" data-error-for="snippet-content" aria-live="polite"></div>
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" id="btn-cancel" data-action="cancel">Cancel</button>
          <button type="submit" class="btn btn-primary" id="btn-save-snippet" data-action="save-snippet">Save Snippet</button>
        </div>
      </form>
    `;
    this.captureFormBaseline();
    this.container.querySelector<HTMLInputElement>(editing ? '#snippet-name' : '#snippet-id')?.focus();
  }

  private renderTextField(id: string, label: string, value: string, placeholder: string, required = false, disabled = false): string {
    return `
      <div class="form-group">
        <label for="${id}">${label}${required ? ' <span class="required">*</span>' : ''}</label>
        <input type="text" id="${id}" value="${escapeHTML(value)}" placeholder="${escapeHTML(placeholder)}" ${disabled ? 'disabled' : ''} />
        ${id.endsWith('-id') ? '<div class="form-hint">Unique identifier; it cannot be changed later</div>' : ''}
        <div class="form-error" data-error-for="${id}" aria-live="polite"></div>
      </div>
    `;
  }

  private async handleSaveSnippet(): Promise<void> {
    if (this.isSaving || !this.container) return;
    this.clearAllFieldErrors();
    const id = this.valueOf('snippet-id').trim();
    const name = this.valueOf('snippet-name').trim();
    const description = this.valueOf('snippet-desc').trim();
    const content = this.valueOf('snippet-content');
    const categoryId = this.valueOf('snippet-category');

    if (!id) return this.showFieldError('snippet-id', 'ID is required.');
    if (!name) return this.showFieldError('snippet-name', 'Name is required.');
    if (!content.trim()) return this.showFieldError('snippet-content', 'Content is required.');
    if (!categoryId) return this.showFieldError('snippet-category', 'Category is required.');

    const button = this.container.querySelector<HTMLButtonElement>('#btn-save-snippet');
    if (!button) return;
    this.setSaving(button, true, 'Save Snippet');
    try {
      const snippet = { id, name, description, content };
      const success = this.editingItem
        ? await snippetManager.updateSnippet(id, snippet, categoryId)
        : await snippetManager.addSnippet(snippet, categoryId);
      if (!success) {
        this.showPanelMessage('Unable to save. The ID may already exist.', 'error');
        return;
      }
      this.formBaseline = this.serializeCurrentForm();
      this.showListView({ text: 'Snippet saved.', tone: 'success' });
    } catch (error) {
      logger.error('SnippetManagerUI', 'Failed to save snippet', { error: String(error) });
      this.showPanelMessage('Unable to save the snippet.', 'error');
    } finally {
      if (button.isConnected) this.setSaving(button, false, 'Save Snippet');
    }
  }

  private showEditCategoryView(category?: Category): void {
    if (!this.container) return;
    const editing = Boolean(category);
    this.currentView = 'edit-category';
    this.editingItem = category || null;
    this.container.innerHTML = `
      <form class="snippet-edit-form" novalidate>
        <h4>${editing ? 'Edit Category' : 'New Category'}</h4>
        <div class="form-scroll-container">
          ${this.renderTextField('category-id', 'ID', category?.id || '', 'unique-category-id', true, editing)}
          ${this.renderTextField('category-name', 'Name', category?.name || '', 'Category name', true)}
          ${this.renderTextField('category-icon', 'Icon', category?.icon || '', 'Icon', true)}
          ${this.renderTextField('category-desc', 'Description', category?.description || '', 'Brief description')}
          ${editing ? '' : `<div class="form-group">
            <label for="category-parent">Parent Category</label>
            <select id="category-parent"><option value="">Root level</option>${this.renderCategoryOptions(snippetManager.getCategories(), '')}</select>
          </div>`}
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" id="btn-cancel" data-action="cancel">Cancel</button>
          <button type="submit" class="btn btn-primary" data-action="save-category">Save Category</button>
        </div>
      </form>
    `;
    this.captureFormBaseline();
    this.container.querySelector<HTMLInputElement>(editing ? '#category-name' : '#category-id')?.focus();
  }

  private async handleSaveCategory(): Promise<void> {
    if (this.isSaving || !this.container) return;
    this.clearAllFieldErrors();
    const id = this.valueOf('category-id').trim();
    const name = this.valueOf('category-name').trim();
    const icon = this.valueOf('category-icon').trim();
    const description = this.valueOf('category-desc').trim();
    const parentId = this.valueOf('category-parent') || undefined;
    if (!id) return this.showFieldError('category-id', 'ID is required.');
    if (!name) return this.showFieldError('category-name', 'Name is required.');
    if (!icon) return this.showFieldError('category-icon', 'Icon is required.');

    const button = this.container.querySelector<HTMLButtonElement>('[data-action="save-category"]');
    if (!button) return;
    this.setSaving(button, true, 'Save Category');
    try {
      const category = { id, name, icon, description };
      const success = this.editingItem
        ? await snippetManager.updateCategory(id, category)
        : await snippetManager.addCategory(category, parentId);
      if (!success) {
        this.showPanelMessage('Unable to save. The ID may already exist.', 'error');
        return;
      }
      this.formBaseline = this.serializeCurrentForm();
      this.showListView({ text: 'Category saved.', tone: 'success' });
    } finally {
      if (button.isConnected) this.setSaving(button, false, 'Save Category');
    }
  }

  private copyBuiltInSnippet(id: string): void {
    const source = snippetManager.getSnippet(id);
    if (!source) return;
    this.showEditSnippetView(this.findSnippetCategoryId(id) || undefined, {
      ...source,
      id: this.createCopyId(source.id),
      name: `${source.name} Copy`,
    }, false);
  }

  private createCopyId(sourceId: string): string {
    let candidate = `${sourceId}-copy`;
    let suffix = 2;
    while (snippetManager.getSnippet(candidate)) candidate = `${sourceId}-copy-${suffix++}`;
    return candidate;
  }

  private async deleteCategory(id: string): Promise<void> {
    if (snippetManager.isBuiltInCategory(id)) return;
    const category = snippetManager.getCategory(id);
    if (!category || !confirm(`Delete "${category.name}" and its contents?`)) return;
    const success = await snippetManager.deleteCategory(id);
    this.showListView(success
      ? { text: 'Category deleted.', tone: 'success' }
      : { text: 'Unable to delete the category.', tone: 'error' });
  }

  private async deleteSnippet(id: string): Promise<void> {
    if (snippetManager.isBuiltInSnippet(id)) return;
    const snippet = snippetManager.getSnippet(id);
    if (!snippet || !confirm(`Delete "${snippet.name}"?`)) return;
    const success = await snippetManager.deleteSnippet(id);
    this.showListView(success
      ? { text: 'Snippet deleted.', tone: 'success' }
      : { text: 'Unable to delete the snippet.', tone: 'error' });
  }

  private async resetSnippets(): Promise<void> {
    if (!confirm('Reset all custom snippets to default?')) return;
    await snippetManager.resetToDefault();
    this.collapsedCategoryIds.clear();
    this.showListView({ text: 'Custom snippets reset.', tone: 'success' });
  }

  private exportSnippets(): void {
    try {
      const blob = new Blob([snippetManager.exportData()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `prompt-snippets-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      logger.error('SnippetManagerUI', 'Failed to export snippets', { error: String(error) });
      this.showPanelMessage('Unable to export snippets.', 'error');
    }
  }

  private async importSnippets(fileInput: HTMLInputElement): Promise<void> {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const result = await snippetManager.importData(await file.text());
      if (!result.success) {
        this.showPanelMessage(result.error || 'Invalid snippet file.', 'error');
        return;
      }
      this.showListView({ text: 'Snippets imported.', tone: 'success' });
    } catch (error) {
      logger.error('SnippetManagerUI', 'Failed to import snippets', { error: String(error) });
      this.showPanelMessage('Unable to read the selected file.', 'error');
    } finally {
      fileInput.value = '';
    }
  }

  private showLogsView(): void {
    if (!this.container) return;
    this.currentView = 'logs';
    this.editingItem = null;
    this.container.innerHTML = `
      <div class="logs-view">
        <h4>Debug Logs</h4>
        <div class="logs-toolbar">
          <button type="button" class="btn btn-secondary" data-action="back">Back</button>
          <button type="button" class="btn btn-primary" data-action="export-logs">Export Logs</button>
          <button type="button" class="btn btn-warning" data-action="clear-logs">Clear Logs</button>
        </div>
        <div class="logs-content"><textarea readonly rows="20">${escapeHTML(logger.getRecentLogs(100))}</textarea></div>
      </div>
    `;
    this.container.querySelector<HTMLButtonElement>('[data-action="back"]')?.focus();
  }

  private renderCategoryOptions(categories: Category[], selectedId: string, prefix = ''): string {
    return categories.map(category => {
      const selected = category.id === selectedId ? ' selected' : '';
      return `<option value="${escapeHTML(category.id)}"${selected}>${escapeHTML(prefix + category.name)}</option>${
        this.renderCategoryOptions(category.subcategories || [], selectedId, `${prefix}  `)
      }`;
    }).join('');
  }

  private firstCategoryId(categories: Category[]): string | null {
    for (const category of categories) {
      if (category.snippets || !category.subcategories?.length) return category.id;
      const nested = this.firstCategoryId(category.subcategories);
      if (nested) return nested;
    }
    return null;
  }

  private findSnippetCategoryId(snippetId: string): string | null {
    const visit = (categories: Category[]): string | null => {
      for (const category of categories) {
        if (category.snippets?.some(snippet => snippet.id === snippetId)) return category.id;
        const nested = visit(category.subcategories || []);
        if (nested) return nested;
      }
      return null;
    };
    return visit(snippetManager.getCategories());
  }

  private returnToList(): void {
    if (this.canDiscardForm()) this.showListView();
  }

  private canDiscardForm(): boolean {
    return !this.isFormDirty() || confirm('Discard unsaved changes?');
  }

  private captureFormBaseline(): void {
    this.formBaseline = this.serializeCurrentForm();
  }

  private isFormDirty(): boolean {
    return this.currentView.startsWith('edit-') && this.serializeCurrentForm() !== this.formBaseline;
  }

  private serializeCurrentForm(): string {
    const fields = Array.from(this.container?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      'input:not([type="file"]), textarea, select'
    ) || []);
    return JSON.stringify(fields.map(field => [field.id, field.value]));
  }

  private valueOf(id: string): string {
    return (this.container?.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`#${id}`)?.value) || '';
  }

  private clearFieldError(id: string): void {
    this.container?.querySelector<HTMLElement>(`[data-error-for="${id}"]`)?.replaceChildren();
    this.container?.querySelector<HTMLElement>(`#${id}`)?.removeAttribute('aria-invalid');
  }

  private clearAllFieldErrors(): void {
    this.container?.querySelectorAll<HTMLElement>('.form-error').forEach(error => error.replaceChildren());
    this.container?.querySelectorAll<HTMLElement>('[aria-invalid="true"]').forEach(field => field.removeAttribute('aria-invalid'));
  }

  private showFieldError(id: string, message: string): void {
    const error = this.container?.querySelector<HTMLElement>(`[data-error-for="${id}"]`);
    const field = this.container?.querySelector<HTMLElement>(`#${id}`);
    if (error) error.textContent = message;
    field?.setAttribute('aria-invalid', 'true');
    field?.focus();
  }

  private showPanelMessage(message: string, tone: MessageTone): void {
    if (!this.container) return;
    this.container.querySelector('.panel-message')?.remove();
    const element = document.createElement('div');
    element.className = `panel-message ${tone}`;
    element.setAttribute('role', 'status');
    element.textContent = message;
    this.container.prepend(element);
  }

  private setSaving(button: HTMLButtonElement, saving: boolean, normalLabel: string): void {
    this.isSaving = saving;
    button.disabled = saving;
    button.textContent = saving ? 'Saving...' : normalLabel;
  }

  private trapFocus(event: KeyboardEvent): void {
    const controls = Array.from(this.overlay?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]'
    ) || []).filter(control => !control.hidden);
    if (controls.length === 0) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private setupDragging(): void {
    const modal = this.overlay?.querySelector<HTMLElement>('.snippet-manager-modal');
    const header = this.overlay?.querySelector<HTMLElement>('.snippet-manager-header');
    if (!modal || !header || window.matchMedia?.('(max-width: 700px)').matches) return;

    this.centerModal();
    this.dragAbortController = new AbortController();
    const signal = this.dragAbortController.signal;
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    header.addEventListener('mousedown', event => {
      if ((event.target as HTMLElement).closest('button')) return;
      const rect = modal.getBoundingClientRect();
      dragging = true;
      startX = event.clientX;
      startY = event.clientY;
      initialLeft = rect.left;
      initialTop = rect.top;
      document.body.style.cursor = 'grabbing';
      event.preventDefault();
    }, { signal });
    document.addEventListener('mousemove', event => {
      if (!dragging) return;
      modal.style.left = `${initialLeft + event.clientX - startX}px`;
      modal.style.top = `${initialTop + event.clientY - startY}px`;
      this.clampModalToViewport();
    }, { signal });
    document.addEventListener('mouseup', () => {
      dragging = false;
      document.body.style.cursor = '';
    }, { signal });
  }

  private centerModal(): void {
    const modal = this.overlay?.querySelector<HTMLElement>('.snippet-manager-modal');
    if (!modal || !this.overlay) return;
    const rect = modal.getBoundingClientRect();
    const overlayRect = this.overlay.getBoundingClientRect();
    modal.style.left = `${Math.max(0, (overlayRect.width - rect.width) / 2)}px`;
    modal.style.top = `${Math.max(0, (overlayRect.height - rect.height) / 2)}px`;
    modal.style.transform = 'none';
    modal.style.margin = '0';
  }

  private clampModalToViewport = (): void => {
    const modal = this.overlay?.querySelector<HTMLElement>('.snippet-manager-modal');
    if (!modal || !this.overlay || window.matchMedia?.('(max-width: 700px)').matches) return;
    const rect = modal.getBoundingClientRect();
    const overlayRect = this.overlay.getBoundingClientRect();
    const left = Math.min(Math.max(rect.left - overlayRect.left, 0), Math.max(overlayRect.width - rect.width, 0));
    const top = Math.min(Math.max(rect.top - overlayRect.top, 0), Math.max(overlayRect.height - rect.height, 0));
    modal.style.left = `${left}px`;
    modal.style.top = `${top}px`;
  };
}

export const snippetManagerUI = new SnippetManagerUI();
export default snippetManagerUI;

if (typeof window !== 'undefined') {
  (window as any).snippetManagerUI = snippetManagerUI;
}
