import { snippetManager, Category, Snippet } from './snippet-manager';
import { EditorView } from '@codemirror/view';

interface WheelItem {
  id: string;
  name: string;
  icon: string;
  description: string;
  type: 'category' | 'snippet' | 'back';
  data?: Category | Snippet;
}

// Bridge interface for native communication
declare global {
  interface Window {
    webkit?: {
      messageHandlers?: {
        snippetWheel?: {
          postMessage: (data: any) => void;
        };
        promptEditor?: {
          postMessage: (data: any) => void;
        };
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
  private isNativeMode = false;

  // Wheel configuration
  private readonly WHEEL_RADIUS = 180;
  private readonly ITEM_SIZE = 80;

  constructor() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleNativeMessage = this.handleNativeMessage.bind(this);
  }

  init(editorView: EditorView, onSelectSnippet?: (snippet: Snippet) => void): void {
    this.editorView = editorView;
    if (onSelectSnippet) {
      this.onSelectSnippet = onSelectSnippet;
    }
  }

  /**
   * Check if running in native app with snippet wheel support
   */
  private hasNativeSupport(): boolean {
    return !!window.webkit?.messageHandlers?.promptEditor;
  }

  /**
   * Show the snippet wheel
   * In native mode: calls native code to show popup window
   * In web mode: shows inline overlay
   */
  show(): void {
    if (this.hasNativeSupport()) {
      // Native mode: tell the native app to show the wheel
      this.showNativeWheel();
    } else {
      // Web mode: show inline overlay
      this.showInlineWheel();
    }
  }

  /**
   * Show wheel using native popup window
   */
  private showNativeWheel(): void {
    // Load snippet data and send to native
    snippetManager.loadData().then(() => {
      const data = snippetManager.getCategories();
      const json = JSON.stringify({ type: 'showSnippetWheel', data });
      
      // Send to native via bridge
      window.webkit?.messageHandlers?.promptEditor?.postMessage({
        action: 'showSnippetWheel'
      });
    });
  }

  /**
   * Show wheel as inline overlay (for web mode)
   */
  private showInlineWheel(): void {
    if (this.overlay) return;

    // Load data if not already loaded
    snippetManager.loadData().then(() => {
      this.createOverlay();
      this.renderRoot();
    });
  }

  /**
   * Handle messages from native code (when used as native popup)
   */
  private handleNativeMessage(event: MessageEvent): void {
    // Handle any postMessage from native
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
  }

  isVisible(): boolean {
    return !!this.overlay;
  }

  private createOverlay(): void {
    this.overlay = document.createElement('div');
    this.overlay.className = 'snippet-wheel-overlay';
    this.overlay.innerHTML = `
      <div class="snippet-wheel-container">
        <div class="snippet-wheel-breadcrumb"></div>
        <div class="snippet-wheel-close">&times;</div>
        <div class="snippet-wheel">
          <div class="snippet-wheel-center">
            <div class="center-icon">🎯</div>
            <div class="center-text">Select</div>
          </div>
        </div>
        <div class="snippet-wheel-hint">Click category to explore • Click snippet to insert</div>
      </div>
    `;

    document.body.appendChild(this.overlay);

    this.wheelContainer = this.overlay.querySelector('.snippet-wheel') as HTMLElement;
    this.centerContent = this.overlay.querySelector('.snippet-wheel-center') as HTMLElement;
    this.breadcrumbEl = this.overlay.querySelector('.snippet-wheel-breadcrumb') as HTMLElement;

    // Close button
    const closeBtn = this.overlay.querySelector('.snippet-wheel-close') as HTMLElement;
    closeBtn.addEventListener('click', () => this.hide());

    // Click outside to close
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.hide();
      }
    });

    // Keyboard navigation
    document.addEventListener('keydown', this.handleKeyDown);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      if (this.currentCategoryId) {
        this.goBack();
      } else {
        this.hide();
      }
    }
  }

  private renderRoot(): void {
    this.currentCategoryId = null;
    const categories = snippetManager.getRootCategories();
    this.currentItems = categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      icon: cat.icon,
      description: cat.description,
      type: 'category' as const,
      data: cat
    }));
    this.renderWheel();
    this.updateBreadcrumb();
  }

  private renderCategory(categoryId: string): void {
    const category = snippetManager.getCategory(categoryId);
    if (!category) return;

    this.currentCategoryId = categoryId;
    this.currentItems = [];

    // Add back button
    this.currentItems.push({
      id: 'back',
      name: 'Back',
      icon: '←',
      description: 'Go back',
      type: 'back'
    });

    // Add subcategories
    const subcategories = snippetManager.getSubcategories(categoryId);
    subcategories.forEach(sub => {
      this.currentItems.push({
        id: sub.id,
        name: sub.name,
        icon: sub.icon,
        description: sub.description,
        type: 'category',
        data: sub
      });
    });

    // Add snippets
    const snippets = snippetManager.getSnippets(categoryId);
    snippets.forEach(snippet => {
      this.currentItems.push({
        id: snippet.id,
        name: snippet.name,
        icon: '📝',
        description: snippet.description,
        type: 'snippet',
        data: snippet
      });
    });

    this.renderWheel();
    this.updateBreadcrumb();
  }

  private renderWheel(): void {
    if (!this.wheelContainer || !this.centerContent) return;

    // Clear existing items (except center)
    const existingItems = this.wheelContainer.querySelectorAll('.wheel-item');
    existingItems.forEach(item => item.remove());

    const itemCount = this.currentItems.length;
    if (itemCount === 0) {
      this.centerContent.innerHTML = `
        <div class="center-icon">📭</div>
        <div class="center-text">Empty</div>
      `;
      return;
    }

    // Calculate positions
    const angleStep = (2 * Math.PI) / itemCount;
    const startAngle = -Math.PI / 2; // Start from top

    this.currentItems.forEach((item, index) => {
      const angle = startAngle + index * angleStep;
      const x = Math.cos(angle) * this.WHEEL_RADIUS;
      const y = Math.sin(angle) * this.WHEEL_RADIUS;

      const itemEl = document.createElement('div');
      itemEl.className = `wheel-item ${item.type}`;
      itemEl.style.cssText = `
        transform: translate(${x}px, ${y}px);
        animation-delay: ${index * 0.05}s;
      `;
      itemEl.innerHTML = `
        <div class="wheel-item-icon">${item.icon}</div>
        <div class="wheel-item-name">${item.name}</div>
        <div class="wheel-item-desc">${item.description}</div>
      `;

      itemEl.addEventListener('click', () => this.handleItemClick(item));
      
      // Hover effect for center
      itemEl.addEventListener('mouseenter', () => this.updateCenterPreview(item));
      itemEl.addEventListener('mouseleave', () => this.resetCenterPreview());

      this.wheelContainer!.appendChild(itemEl);
    });

    // Update center text
    this.resetCenterPreview();
  }

  private updateCenterPreview(item: WheelItem): void {
    if (!this.centerContent) return;
    
    let content = '';
    if (item.type === 'snippet' && item.data) {
      const snippet = item.data as Snippet;
      content = `
        <div class="center-icon">${item.icon}</div>
        <div class="center-text">${item.name}</div>
        <div class="center-desc">${snippet.content.slice(0, 60)}${snippet.content.length > 60 ? '...' : ''}</div>
      `;
    } else {
      content = `
        <div class="center-icon">${item.icon}</div>
        <div class="center-text">${item.name}</div>
        <div class="center-desc">${item.description}</div>
      `;
    }
    this.centerContent.innerHTML = content;
  }

  private resetCenterPreview(): void {
    if (!this.centerContent) return;
    
    if (this.currentCategoryId) {
      const category = snippetManager.getCategory(this.currentCategoryId);
      this.centerContent.innerHTML = `
        <div class="center-icon">${category?.icon || '📂'}</div>
        <div class="center-text">${category?.name || 'Select'}</div>
        <div class="center-desc">${category?.description || 'Choose an item'}</div>
      `;
    } else {
      this.centerContent.innerHTML = `
        <div class="center-icon">🎯</div>
        <div class="center-text">Prompt Snippets</div>
        <div class="center-desc">Select a category to start</div>
      `;
    }
  }

  private handleItemClick(item: WheelItem): void {
    if (item.type === 'back') {
      this.goBack();
    } else if (item.type === 'category' && item.data) {
      const category = item.data as Category;
      // If category has subcategories or snippets, navigate into it
      if (snippetManager.hasSubcategories(category.id) || snippetManager.hasSnippets(category.id)) {
        this.renderCategory(category.id);
      }
    } else if (item.type === 'snippet' && item.data) {
      const snippet = item.data as Snippet;
      this.insertSnippet(snippet);
    }
  }

  private goBack(): void {
    if (!this.currentCategoryId) return;
    
    const path = snippetManager.getBreadcrumbPath(this.currentCategoryId);
    if (path.length <= 1) {
      this.renderRoot();
    } else {
      // Go to parent
      const parent = path[path.length - 2];
      if (parent) {
        this.renderCategory(parent.id);
      } else {
        this.renderRoot();
      }
    }
  }

  private updateBreadcrumb(): void {
    if (!this.breadcrumbEl) return;
    
    if (!this.currentCategoryId) {
      this.breadcrumbEl.innerHTML = '<span class="bc-root">Categories</span>';
      return;
    }

    const path = snippetManager.getBreadcrumbPath(this.currentCategoryId);
    let html = '<span class="bc-root" data-id="">Categories</span>';
    
    path.forEach((cat, index) => {
      html += ' <span class="bc-separator">›</span> ';
      if (index === path.length - 1) {
        html += `<span class="bc-current">${cat.icon} ${cat.name}</span>`;
      } else {
        html += `<span class="bc-item" data-id="${cat.id}">${cat.icon} ${cat.name}</span>`;
      }
    });

    this.breadcrumbEl.innerHTML = html;

    // Add click handlers
    this.breadcrumbEl.querySelectorAll('.bc-root, .bc-item').forEach(el => {
      el.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.id;
        if (!id) {
          this.renderRoot();
        } else {
          this.renderCategory(id);
        }
      });
    });
  }

  private insertSnippet(snippet: Snippet): void {
    if (this.onSelectSnippet) {
      this.onSelectSnippet(snippet);
    } else if (this.editorView) {
      // Insert at cursor position
      const { from } = this.editorView.state.selection.main;
      this.editorView.dispatch({
        changes: { from, insert: snippet.content }
      });
    }
    this.hide();
  }
}

// Export singleton instance
export const snippetWheel = new SnippetWheel();

// Export function to show the wheel
export function showSnippetWheel(editorView?: EditorView, onSelectSnippet?: (snippet: Snippet) => void): void {
  if (editorView) {
    snippetWheel.init(editorView, onSelectSnippet);
  }
  snippetWheel.show();
}

export function hideSnippetWheel(): void {
  snippetWheel.hide();
}

export function isSnippetWheelVisible(): boolean {
  return snippetWheel.isVisible();
}

export default snippetWheel;
