import { Category, Snippet, snippetManager } from './snippet-manager';
import { snippetManagerUI } from './snippet-manager-ui';
import { EditorView } from '@codemirror/view';

interface WheelItem {
  id: string;
  name: string;
  icon: string;
  description: string;
  type: 'category' | 'snippet' | 'back';
  data?: Category | Snippet;
}

export function getSnippetWheelRadius(viewportWidth: number): number {
  return viewportWidth <= 700 ? 140 : 180;
}

declare global {
  interface Window {
    webkit?: {
      messageHandlers?: {
        promptEditor?: { postMessage: (data: unknown) => void };
      };
    };
  }
}

class SnippetWheel {
  private overlay: HTMLElement | null = null;
  private wheelContainer: HTMLElement | null = null;
  private centerContent: HTMLElement | null = null;
  private breadcrumbEl: HTMLElement | null = null;
  private currentCategoryId: string | null = null;
  private currentItems: WheelItem[] = [];
  private editorView: EditorView | null = null;
  private onSelectSnippet: ((snippet: Snippet) => void) | null = null;
  private opener: HTMLElement | null = null;
  private focusedItemIndex = 0;

  async show(
    editorView?: EditorView,
    onSelectSnippet?: (snippet: Snippet) => void,
    opener: HTMLElement | null = document.activeElement as HTMLElement | null,
  ): Promise<void> {
    if (this.overlay) return;
    this.editorView = editorView || null;
    this.onSelectSnippet = onSelectSnippet || null;
    this.opener = opener;
    await snippetManager.loadData();

    if (this.hasNativeSupport()) {
      window.webkit?.messageHandlers?.promptEditor?.postMessage({ action: 'showSnippetWheel' });
      return;
    }

    this.createOverlay();
    this.renderRoot();
  }

  hide(): void {
    if (!this.overlay) return;
    document.removeEventListener('keydown', this.handleKeyDown);
    this.overlay.remove();
    this.overlay = null;
    this.wheelContainer = null;
    this.centerContent = null;
    this.breadcrumbEl = null;
    this.currentCategoryId = null;
    this.currentItems = [];
    this.focusedItemIndex = 0;
    const opener = this.opener;
    this.opener = null;
    opener?.focus();
  }

  isVisible(): boolean {
    return this.overlay !== null;
  }

  private hasNativeSupport(): boolean {
    return Boolean(window.webkit?.messageHandlers?.promptEditor);
  }

  private createOverlay(): void {
    this.overlay = document.createElement('div');
    this.overlay.className = 'snippet-wheel-overlay';
    this.overlay.setAttribute('role', 'dialog');
    this.overlay.setAttribute('aria-modal', 'true');
    this.overlay.setAttribute('aria-label', 'Prompt Snippets');
    this.overlay.innerHTML = `
      <div class="snippet-wheel-container">
        <nav class="snippet-wheel-breadcrumb" aria-label="Snippet category path"></nav>
        <button type="button" class="snippet-wheel-close" aria-label="Close Prompt Snippets">&times;</button>
        <button type="button" class="snippet-wheel-manage" aria-label="Manage snippets" title="Manage snippets">&#9881;</button>
        <div class="snippet-wheel">
          <div class="snippet-wheel-center" aria-live="polite"></div>
        </div>
        <div class="snippet-wheel-hint">Use arrow keys to navigate and Enter to select</div>
      </div>
    `;
    document.body.appendChild(this.overlay);
    this.wheelContainer = this.overlay.querySelector('.snippet-wheel');
    this.centerContent = this.overlay.querySelector('.snippet-wheel-center');
    this.breadcrumbEl = this.overlay.querySelector('.snippet-wheel-breadcrumb');

    this.overlay.querySelector<HTMLButtonElement>('.snippet-wheel-close')?.addEventListener('click', () => this.hide());
    this.overlay.querySelector<HTMLButtonElement>('.snippet-wheel-manage')?.addEventListener('click', event => {
      event.stopPropagation();
      const opener = this.opener;
      this.hide();
      void snippetManagerUI.open(opener);
    });
    this.overlay.addEventListener('click', event => {
      if (event.target === this.overlay) this.hide();
    });
    document.addEventListener('keydown', this.handleKeyDown);
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.overlay) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      this.focusItem(this.focusedItemIndex + 1);
      return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.focusItem(this.focusedItemIndex - 1);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      const item = this.currentItems[this.focusedItemIndex];
      if (item && document.activeElement?.classList.contains('wheel-item')) {
        event.preventDefault();
        this.handleItemClick(item);
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      if (this.currentCategoryId) this.goBack();
      else this.hide();
    }
  };

  private renderRoot(): void {
    this.currentCategoryId = null;
    this.currentItems = snippetManager.getRootCategories().map(category => ({
      id: category.id,
      name: category.name,
      icon: category.icon,
      description: category.description || '',
      type: 'category',
      data: category,
    }));
    this.renderWheel();
    this.updateBreadcrumb();
  }

  private renderCategory(categoryId: string): void {
    const category = snippetManager.getCategory(categoryId);
    if (!category) return;
    this.currentCategoryId = categoryId;
    this.currentItems = [{ id: 'back', name: 'Back', icon: '\u2190', description: 'Go back', type: 'back' }];
    snippetManager.getSubcategories(categoryId).forEach(subcategory => this.currentItems.push({
      id: subcategory.id,
      name: subcategory.name,
      icon: subcategory.icon,
      description: subcategory.description || '',
      type: 'category',
      data: subcategory,
    }));
    snippetManager.getSnippets(categoryId).forEach(snippet => this.currentItems.push({
      id: snippet.id,
      name: snippet.name,
      icon: '\u{1F4DD}',
      description: snippet.description,
      type: 'snippet',
      data: snippet,
    }));
    this.renderWheel();
    this.updateBreadcrumb();
  }

  private renderWheel(): void {
    if (!this.wheelContainer) return;
    this.wheelContainer.querySelectorAll('.wheel-item').forEach(item => item.remove());
    if (this.currentItems.length === 0) {
      this.renderCenter('\u{1F4ED}', 'Empty', 'No items in this category');
      this.overlay?.querySelector<HTMLButtonElement>('.snippet-wheel-manage')?.focus();
      return;
    }

    const angleStep = (2 * Math.PI) / this.currentItems.length;
    this.currentItems.forEach((item, index) => {
      const angle = -Math.PI / 2 + index * angleStep;
      const radius = getSnippetWheelRadius(window.innerWidth);
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      const button = this.createWheelButton(item, index);
      button.style.left = `calc(50% + ${x}px)`;
      button.style.top = `calc(50% + ${y}px)`;
      button.style.animationDelay = `${index * 0.05}s`;
      this.wheelContainer?.appendChild(button);
    });
    this.resetCenterPreview();
    this.focusItem(0);
  }

  private createWheelButton(item: WheelItem, index: number): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `wheel-item ${item.type}`;
    button.dataset.index = String(index);
    button.setAttribute('aria-label', `${item.type === 'snippet' ? 'Insert' : 'Open'} ${item.name}`);

    const icon = document.createElement('span');
    icon.className = 'wheel-item-icon';
    icon.textContent = item.icon;
    const name = document.createElement('span');
    name.className = 'wheel-item-name';
    name.textContent = item.name;
    const description = document.createElement('span');
    description.className = 'wheel-item-desc';
    description.textContent = item.description;
    button.append(icon, name, description);

    button.addEventListener('click', () => this.handleItemClick(item));
    button.addEventListener('mouseenter', () => this.updateCenterPreview(item));
    button.addEventListener('focus', () => {
      this.focusedItemIndex = index;
      this.updateCenterPreview(item);
    });
    button.addEventListener('mouseleave', () => {
      if (document.activeElement !== button) this.resetCenterPreview();
    });
    return button;
  }

  private focusItem(index: number): void {
    const items = Array.from(this.wheelContainer?.querySelectorAll<HTMLButtonElement>('.wheel-item') || []);
    if (items.length === 0) return;
    this.focusedItemIndex = (index + items.length) % items.length;
    items.forEach((item, itemIndex) => item.tabIndex = itemIndex === this.focusedItemIndex ? 0 : -1);
    items[this.focusedItemIndex].focus();
  }

  private updateCenterPreview(item: WheelItem): void {
    if (item.type === 'snippet' && item.data) {
      const snippet = item.data as Snippet;
      const preview = `${snippet.content.slice(0, 60)}${snippet.content.length > 60 ? '...' : ''}`;
      this.renderCenter(item.icon, item.name, preview);
      return;
    }
    this.renderCenter(item.icon, item.name, item.description);
  }

  private resetCenterPreview(): void {
    if (this.currentCategoryId) {
      const category = snippetManager.getCategory(this.currentCategoryId);
      this.renderCenter(category?.icon || '\u{1F4C2}', category?.name || 'Select', category?.description || 'Choose an item');
    } else {
      this.renderCenter('\u{1F3AF}', 'Prompt Snippets', 'Select a category to start');
    }
  }

  private renderCenter(iconText: string, titleText: string, descriptionText: string): void {
    if (!this.centerContent) return;
    this.centerContent.replaceChildren();
    const icon = document.createElement('div');
    icon.className = 'center-icon';
    icon.textContent = iconText;
    const title = document.createElement('div');
    title.className = 'center-text';
    title.textContent = titleText;
    const description = document.createElement('div');
    description.className = 'center-desc';
    description.textContent = descriptionText;
    this.centerContent.append(icon, title, description);
  }

  private handleItemClick(item: WheelItem): void {
    if (item.type === 'back') {
      this.goBack();
    } else if (item.type === 'category' && item.data) {
      const category = item.data as Category;
      if (snippetManager.hasSubcategories(category.id) || snippetManager.hasSnippets(category.id)) {
        this.renderCategory(category.id);
      }
    } else if (item.type === 'snippet' && item.data) {
      this.insertSnippet(item.data as Snippet);
    }
  }

  private goBack(): void {
    if (!this.currentCategoryId) return;
    const path = snippetManager.getBreadcrumbPath(this.currentCategoryId);
    if (path.length <= 1) this.renderRoot();
    else this.renderCategory(path[path.length - 2].id);
  }

  private updateBreadcrumb(): void {
    if (!this.breadcrumbEl) return;
    this.breadcrumbEl.replaceChildren();
    const root = this.createBreadcrumbButton('Categories', null);
    this.breadcrumbEl.appendChild(root);
    if (!this.currentCategoryId) return;

    const path = snippetManager.getBreadcrumbPath(this.currentCategoryId);
    path.forEach((category, index) => {
      const separator = document.createElement('span');
      separator.className = 'bc-separator';
      separator.textContent = '\u203A';
      this.breadcrumbEl?.appendChild(separator);
      if (index === path.length - 1) {
        const current = document.createElement('span');
        current.className = 'bc-current';
        current.textContent = `${category.icon} ${category.name}`;
        this.breadcrumbEl?.appendChild(current);
      } else {
        this.breadcrumbEl?.appendChild(this.createBreadcrumbButton(`${category.icon} ${category.name}`, category.id));
      }
    });
  }

  private createBreadcrumbButton(label: string, categoryId: string | null): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = categoryId ? 'bc-item' : 'bc-root';
    button.textContent = label;
    button.addEventListener('click', () => categoryId ? this.renderCategory(categoryId) : this.renderRoot());
    return button;
  }

  private insertSnippet(snippet: Snippet): void {
    if (this.onSelectSnippet) {
      this.onSelectSnippet(snippet);
    } else if (this.editorView) {
      const { from } = this.editorView.state.selection.main;
      this.editorView.dispatch({ changes: { from, insert: snippet.content } });
    }
    this.hide();
  }
}

export const snippetWheel = new SnippetWheel();

export async function showSnippetWheel(
  editorView?: EditorView,
  onSelectSnippet?: (snippet: Snippet) => void,
  opener?: HTMLElement | null,
): Promise<void> {
  await snippetWheel.show(editorView, onSelectSnippet, opener);
}

export function hideSnippetWheel(): void {
  snippetWheel.hide();
}

export function isSnippetWheelVisible(): boolean {
  return snippetWheel.isVisible();
}

export default snippetWheel;
