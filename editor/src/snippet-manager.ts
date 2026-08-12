// Snippet Manager - Manages prompt snippets with hierarchical categories
// Supports CRUD operations and persists user changes to localStorage

import logger from './logger';

export interface Snippet {
  id: string;
  name: string;
  description: string;
  content: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  description: string;
  subcategories?: Category[];
  snippets?: Snippet[];
}

export interface SnippetData {
  version: string;
  categories: Category[];
}

export interface ImportResult {
  success: boolean;
  error?: string;
}

const STORAGE_KEY = 'prompt-editor-snippets';

export class SnippetManager {
  private data: SnippetData | null = null;
  private snippetMap: Map<string, Snippet> = new Map();
  private categoryMap: Map<string, Category> = new Map();
  private builtInSnippetIds: Set<string> = new Set();
  private builtInCategoryIds: Set<string> = new Set();
  private userData: SnippetData | null = null; // User custom snippets
  private isLoaded = false;

  async loadData(): Promise<void> {
    if (this.isLoaded) {
      logger.info('SnippetManager', 'Data already loaded, skipping');
      return;
    }

    try {
      logger.info('SnippetManager', 'Starting to load snippet data');

      // Try to load built-in snippets from JSON file
      // In WKWebView (macOS app), this might fail due to security restrictions
      try {
        const response = await fetch('data/snippets.json');
        if (!response.ok) {
          throw new Error(`Failed to load snippets: ${response.status}`);
        }
        const builtInData = await response.json() as SnippetData;
        this.data = builtInData;
        logger.info('SnippetManager', 'Built-in data loaded from file', { categoryCount: builtInData.categories.length });
      } catch (fetchError) {
        logger.warn('SnippetManager', 'Cannot fetch snippets.json, using embedded default data', { error: String(fetchError) });
        // Use embedded default snippets data when fetch fails (WKWebView file:// restriction)
        this.data = this.getDefaultSnippets();
        logger.info('SnippetManager', 'Embedded default data loaded', { categoryCount: this.data?.categories?.length });
      }

      this.captureBuiltInIds(this.data);

      // Load user custom snippets from localStorage
      this.loadUserData();

      // Merge user data with built-in data
      this.mergeData();

      this.buildMaps();
      this.isLoaded = true;
      logger.info('SnippetManager', 'Data loading complete', { snippetCount: this.snippetMap.size, categoryCount: this.categoryMap.size });
    } catch (error) {
      logger.error('SnippetManager', 'Failed to load snippet data', { error: String(error) });
      this.data = { version: '1.0', categories: [] };
      this.captureBuiltInIds(this.data);
      this.loadUserData();
      this.mergeData();
      this.buildMaps();
      this.isLoaded = true;
    }
  }

  private getDefaultSnippets(): SnippetData {
    // Embedded default snippets data for WKWebView environments
    // This is used when fetch('data/snippets.json') fails due to security restrictions
    return {
      version: '1.0',
      categories: [
        {
          id: 'ai-assistance',
          name: 'AI Assistance',
          icon: '🤖',
          description: '与 AI 协作的最佳实践',
          subcategories: [
            {
              id: 'ai-context',
              name: 'Context Management',
              icon: '📚',
              description: '',
              snippets: [
                {
                  id: 'ai-context-first',
                  name: 'Provide Context First',
                  description: '先提供上下文再提问',
                  content: '在提问前，先提供相关的代码、错误信息或背景信息。这样我能更准确地理解问题并给出有针对性的回答。'
                }
              ]
            }
          ]
        },
        {
          id: 'debugging',
          name: 'Debugging',
          icon: '🐛',
          description: '调试和故障排查',
          subcategories: [
            {
              id: 'debug-analysis',
              name: 'Error Analysis',
              icon: '🔍',
              description: '',
              snippets: [
                {
                  id: 'debug-stacktrace',
                  name: 'Analyze Stack Trace',
                  description: '分析错误堆栈',
                  content: '请分析以下错误信息和堆栈跟踪：\n\n[粘贴错误信息]\n\n请告诉我：\n1. 根本原因是什么\n2. 如何修复\n3. 如何预防类似问题'
                }
              ]
            }
          ]
        },
        {
          id: 'refactoring',
          name: 'Refactoring',
          icon: '🔧',
          description: '代码重构和优化'
        },
        {
          id: 'testing',
          name: 'Testing',
          icon: '🧪',
          description: '测试策略和最佳实践'
        },
        {
          id: 'git-workflow',
          name: 'Git Workflow',
          icon: '🌿',
          description: 'Git 工作流和版本控制'
        },
        {
          id: 'security',
          name: 'Security',
          icon: '🔒',
          description: 'Security checks and best practices'
        },
        {
          id: 'code-quality',
          name: 'Code Quality',
          icon: '✨',
          description: 'Code quality and best practices'
        },
        {
          id: 'architecture',
          name: 'Architecture',
          icon: '🏗️',
          description: 'Architecture and design patterns'
        }
      ]
    };
  }

  private loadUserData(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      logger.info('SnippetManager', 'Loading user data from localStorage', { hasData: !!stored });
      if (stored) {
        this.userData = JSON.parse(stored);
        logger.info('SnippetManager', 'User data loaded', { categoryCount: this.userData?.categories?.length });
      } else {
        this.userData = { version: '1.0', categories: [] };
        logger.info('SnippetManager', 'No user data found, initialized empty structure');
      }
    } catch (error) {
      logger.error('SnippetManager', 'Failed to load user snippets', { error: String(error) });
      this.userData = { version: '1.0', categories: [] };
    }
  }

  private saveUserData(): void {
    try {
      logger.info('SnippetManager', 'Saving user data to localStorage', { categoryCount: this.userData?.categories?.length });
      if (this.userData) {
        const jsonData = JSON.stringify(this.userData);
        logger.debug('SnippetManager', 'User data serialized', { size: jsonData.length });
        localStorage.setItem(STORAGE_KEY, jsonData);
        logger.info('SnippetManager', 'User data saved successfully');
      } else {
        logger.warn('SnippetManager', 'No user data to save');
      }
    } catch (error) {
      logger.error('SnippetManager', 'Failed to save user snippets', { error: String(error), storageKey: STORAGE_KEY });
      throw error; // Re-throw to let caller know save failed
    }
  }

  private mergeData(): void {
    if (!this.data) {
      this.data = this.userData || { version: '1.0', categories: [] };
      return;
    }
    if (!this.userData || this.userData.categories.length === 0) {
      return;
    }

    // Merge user categories with built-in categories
    for (const userCat of this.userData.categories) {
      const existingCat: Category | undefined = this.data.categories.find(
        (category: Category) => category.id === userCat.id,
      );
      if (existingCat) {
        // Merge snippets into existing category
        if (userCat.snippets) {
          existingCat.snippets = existingCat.snippets || [];
          for (const snippet of userCat.snippets) {
            const idx = existingCat.snippets.findIndex((existingSnippet: Snippet) => existingSnippet.id === snippet.id);
            if (idx >= 0) {
              existingCat.snippets[idx] = snippet;
            } else {
              existingCat.snippets.push(snippet);
            }
          }
        }
        // Recursively merge subcategories
        if (userCat.subcategories) {
          existingCat.subcategories = existingCat.subcategories || [];
          this.mergeCategories(existingCat.subcategories, userCat.subcategories);
        }
      } else {
        // Add new user category
        this.data.categories.push(userCat);
      }
    }
  }

  private mergeCategories(target: Category[], source: Category[]): void {
    for (const srcCat of source) {
      const idx = target.findIndex(c => c.id === srcCat.id);
      if (idx >= 0) {
        // Merge into existing
        if (srcCat.snippets) {
          target[idx].snippets = target[idx].snippets || [];
          for (const snippet of srcCat.snippets) {
            const sIdx = target[idx].snippets!.findIndex(s => s.id === snippet.id);
            if (sIdx >= 0) {
              target[idx].snippets![sIdx] = snippet;
            } else {
              target[idx].snippets!.push(snippet);
            }
          }
        }
        if (srcCat.subcategories) {
          target[idx].subcategories = target[idx].subcategories || [];
          this.mergeCategories(target[idx].subcategories!, srcCat.subcategories);
        }
      } else {
        target.push(srcCat);
      }
    }
  }

  private buildMaps(): void {
    this.snippetMap.clear();
    this.categoryMap.clear();
    
    if (!this.data) return;
    
    const processCategory = (category: Category) => {
      this.categoryMap.set(category.id, category);
      
      if (category.snippets) {
        category.snippets.forEach(snippet => {
          this.snippetMap.set(snippet.id, snippet);
        });
      }
      
      if (category.subcategories) {
        category.subcategories.forEach(processCategory);
      }
    };
    
    this.data.categories.forEach(processCategory);
  }

  // Get all categories
  getCategories(): Category[] {
    return this.data?.categories || [];
  }

  getCategory(id: string): Category | undefined {
    return this.categoryMap.get(id);
  }

  getSnippet(id: string): Snippet | undefined {
    return this.snippetMap.get(id);
  }

  isBuiltInCategory(id: string): boolean {
    return this.builtInCategoryIds.has(id);
  }

  isBuiltInSnippet(id: string): boolean {
    return this.builtInSnippetIds.has(id);
  }

  // Get root level categories (for initial wheel display)
  getRootCategories(): Category[] {
    return this.data?.categories || [];
  }

  // Get subcategories of a category
  getSubcategories(categoryId: string): Category[] {
    const category = this.categoryMap.get(categoryId);
    return category?.subcategories || [];
  }

  // Get snippets of a category
  getSnippets(categoryId: string): Snippet[] {
    const category = this.categoryMap.get(categoryId);
    return category?.snippets || [];
  }

  // Check if category has subcategories
  hasSubcategories(categoryId: string): boolean {
    const category = this.categoryMap.get(categoryId);
    return !!category?.subcategories && category.subcategories.length > 0;
  }

  // Check if category has snippets
  hasSnippets(categoryId: string): boolean {
    const category = this.categoryMap.get(categoryId);
    return !!category?.snippets && category.snippets.length > 0;
  }

  // Get breadcrumb path for a category
  getBreadcrumbPath(categoryId: string): Category[] {
    const path: Category[] = [];
    
    const findPath = (categories: Category[], targetId: string): boolean => {
      for (const cat of categories) {
        if (cat.id === targetId) {
          path.unshift(cat);
          return true;
        }
        
        if (cat.subcategories) {
          if (findPath(cat.subcategories, targetId)) {
            path.unshift(cat);
            return true;
          }
        }
      }
      return false;
    };
    
    if (this.data) {
      findPath(this.data.categories, categoryId);
    }
    
    return path;
  }

  // Search snippets by keyword
  searchSnippets(query: string): Array<{ snippet: Snippet; category: Category; path: string }> {
    const results: Array<{ snippet: Snippet; category: Category; path: string }> = [];
    const lowerQuery = query.toLowerCase();
    
    const searchInCategory = (category: Category, path: string) => {
      const currentPath = path ? `${path} > ${category.name}` : category.name;
      
      if (category.snippets) {
        category.snippets.forEach(snippet => {
          if (
            snippet.name.toLowerCase().includes(lowerQuery) ||
            snippet.description.toLowerCase().includes(lowerQuery) ||
            snippet.content.toLowerCase().includes(lowerQuery)
          ) {
            results.push({ snippet, category, path: currentPath });
          }
        });
      }
      
      if (category.subcategories) {
        category.subcategories.forEach(sub => searchInCategory(sub, currentPath));
      }
    };
    
    if (this.data) {
      this.data.categories.forEach(cat => searchInCategory(cat, ''));
    }
    
    return results;
  }

  // Get all snippets flattened
  getAllSnippets(): Array<{ snippet: Snippet; category: Category; path: string }> {
    const results: Array<{ snippet: Snippet; category: Category; path: string }> = [];
    
    const collectFromCategory = (category: Category, path: string) => {
      const currentPath = path ? `${path} > ${category.name}` : category.name;
      
      if (category.snippets) {
        category.snippets.forEach(snippet => {
          results.push({ snippet, category, path: currentPath });
        });
      }
      
      if (category.subcategories) {
        category.subcategories.forEach(sub => collectFromCategory(sub, currentPath));
      }
    };
    
    if (this.data) {
      this.data.categories.forEach(cat => collectFromCategory(cat, ''));
    }
    
    return results;
  }

  // ==================== CRUD Operations ====================

  // Add a new category
  async addCategory(category: Category, parentId?: string): Promise<boolean> {
    logger.info('SnippetManager', 'addCategory called', { categoryId: category.id, name: category.name, parentId });
    this.ensureLoaded();

    if (!this.userData) {
      logger.info('SnippetManager', 'Initializing userData');
      this.userData = { version: '1.0', categories: [] };
    }

    // Check for duplicate ID
    if (this.categoryMap.has(category.id)) {
      logger.error('SnippetManager', 'Category with id already exists', { categoryId: category.id });
      return false;
    }

    if (parentId) {
      logger.info('SnippetManager', 'Adding to parent category', { parentId });
      // Add to parent category
      const userParent = this.findCategoryInUserData(parentId);
      if (userParent) {
        userParent.subcategories = userParent.subcategories || [];
        userParent.subcategories.push(category);
        logger.info('SnippetManager', 'Added to existing parent in user data', { parentId, newSubcategoryCount: userParent.subcategories.length });
      } else {
        // Parent is from built-in data, clone it to user data first
        const builtInParent = this.categoryMap.get(parentId);
        if (builtInParent) {
          logger.info('SnippetManager', 'Cloning built-in parent to user data', { parentId });
          const clonedParent = this.cloneCategoryStructure(builtInParent.id);
          if (clonedParent) {
            clonedParent.subcategories = clonedParent.subcategories || [];
            clonedParent.subcategories.push(category);
            this.addCategoryToUserData(clonedParent);
            logger.info('SnippetManager', 'Cloned parent and added category', { parentId, subcategoryCount: clonedParent.subcategories.length });
          } else {
            logger.error('SnippetManager', 'Failed to clone parent, adding to root', { parentId });
            this.userData.categories.push(category);
          }
        } else {
          logger.warn('SnippetManager', 'Parent not found, adding to root', { parentId });
          // Parent not found at all, add to root
          this.userData.categories.push(category);
        }
      }
    } else {
      logger.info('SnippetManager', 'Adding to root categories');
      // Add to root
      this.userData.categories.push(category);
    }

    logger.info('SnippetManager', 'Calling saveUserData');
    this.saveUserData();

    logger.info('SnippetManager', 'Calling reloadData');
    await this.reloadData();

    logger.info('SnippetManager', 'Category saved successfully', { categoryId: category.id });
    return true;
  }

  // Update a category
  async updateCategory(id: string, updates: Partial<Category>): Promise<boolean> {
    this.ensureLoaded();

    if (this.isBuiltInCategory(id)) return false;
    
    const category = this.categoryMap.get(id);
    if (!category) {
      console.error(`Category ${id} not found`);
      return false;
    }

    // Find and update in user data
    const userCategory = this.findCategoryInUserData(id);
    if (userCategory) {
      Object.assign(userCategory, updates);
    } else {
      // Category from built-in data, clone to user data
      const clonedCategory: Category = { ...category, ...updates };
      this.addCategoryToUserData(clonedCategory);
    }

    this.saveUserData();
    await this.reloadData();
    return true;
  }

  // Delete a category
  async deleteCategory(id: string): Promise<boolean> {
    this.ensureLoaded();

    if (this.isBuiltInCategory(id)) return false;
    
    if (!this.userData) return false;

    const deleted = this.removeFromUserData(this.userData.categories, 'category', id);
    if (deleted) {
      this.saveUserData();
      await this.reloadData();
    }
    return deleted;
  }

  // Add a snippet to a category
  async addSnippet(snippet: Snippet, categoryId: string): Promise<boolean> {
    this.ensureLoaded();
    
    if (!this.userData) {
      this.userData = { version: '1.0', categories: [] };
    }

    // Check for duplicate ID
    if (this.snippetMap.has(snippet.id)) {
      console.error(`Snippet with id ${snippet.id} already exists`);
      return false;
    }

    const category = this.categoryMap.get(categoryId);
    if (!category) {
      console.error(`Category ${categoryId} not found`);
      return false;
    }

    // Find category in user data or add it
    const userCategory = this.ensureCategoryInUserData(categoryId);
    if (!userCategory) return false;

    userCategory.snippets = userCategory.snippets || [];
    userCategory.snippets.push(snippet);

    this.saveUserData();
    await this.reloadData();
    return true;
  }

  // Update a snippet
  async updateSnippet(id: string, updates: Partial<Snippet>, destinationCategoryId?: string): Promise<boolean> {
    this.ensureLoaded();

    if (this.isBuiltInSnippet(id)) return false;

    const source = this.findSnippetInUserData(id);
    if (!source) return false;

    const destinationId = destinationCategoryId || source.category.id;
    const destination = this.ensureCategoryInUserData(destinationId);
    if (!destination) return false;
    if (destination !== source.category && destination.snippets?.some(item => item.id === id)) return false;

    const updated: Snippet = { ...source.snippet, ...updates, id };
    source.category.snippets = source.category.snippets?.filter(item => item.id !== id);
    destination.snippets = destination.snippets || [];
    destination.snippets.push(updated);

    this.saveUserData();
    await this.reloadData();
    return true;
  }

  // Delete a snippet
  async deleteSnippet(id: string): Promise<boolean> {
    this.ensureLoaded();

    if (this.isBuiltInSnippet(id)) return false;
    
    if (!this.userData) return false;

    const deleted = this.removeFromUserData(this.userData.categories, 'snippet', id);
    if (deleted) {
      this.saveUserData();
      await this.reloadData();
    }
    return deleted;
  }

  // Export all snippets (including user custom)
  exportData(): string {
    return JSON.stringify(this.data, null, 2);
  }

  // Import snippets from JSON
  async importData(json: string): Promise<ImportResult> {
    try {
      const imported: unknown = JSON.parse(json);
      const validation = this.validateImport(imported);
      if (!validation.success) return validation;

      this.userData = imported as SnippetData;
      this.saveUserData();
      await this.reloadData();
      return { success: true };
    } catch (error) {
      logger.warn('SnippetManager', 'Failed to import snippets', { error: String(error) });
      return { success: false, error: 'The selected file is not valid JSON.' };
    }
  }

  // Reset to default (clear user data)
  async resetToDefault(): Promise<void> {
    this.userData = { version: '1.0', categories: [] };
    localStorage.removeItem(STORAGE_KEY);
    this.isLoaded = false;
    await this.loadData();
  }

  async reload(): Promise<void> {
    await this.reloadData();
  }

  // ==================== Helper Methods ====================

  private ensureLoaded(): void {
    if (!this.isLoaded) {
      throw new Error('SnippetManager not loaded. Call loadData() first.');
    }
  }

  private async reloadData(): Promise<void> {
    this.isLoaded = false;
    this.data = null;
    await this.loadData();
  }

  private captureBuiltInIds(data: SnippetData): void {
    this.builtInCategoryIds.clear();
    this.builtInSnippetIds.clear();

    const visit = (category: Category): void => {
      this.builtInCategoryIds.add(category.id);
      category.snippets?.forEach(snippet => this.builtInSnippetIds.add(snippet.id));
      category.subcategories?.forEach(visit);
    };

    data.categories.forEach(visit);
  }

  private validateImport(value: unknown): ImportResult {
    if (!value || typeof value !== 'object') {
      return { success: false, error: 'Import must be an object.' };
    }

    const candidate = value as Partial<SnippetData>;
    if (typeof candidate.version !== 'string' || !Array.isArray(candidate.categories)) {
      return { success: false, error: 'Import requires a version and categories array.' };
    }

    const categoryIds = new Set<string>();
    const snippetIds = new Set<string>();
    const visit = (category: unknown): string | null => {
      if (!category || typeof category !== 'object') return 'Every category must be an object.';
      const item = category as Category;
      if (typeof item.id !== 'string' || !item.id.trim()) return 'Every category id must be a non-empty string.';
      if (typeof item.name !== 'string' || !item.name.trim()) return `Category ${item.id} requires a name.`;
      if (typeof item.icon !== 'string' || !item.icon.trim()) return `Category ${item.id} requires an icon.`;
      if (item.description !== undefined && typeof item.description !== 'string') return `Category ${item.id} has an invalid description.`;
      if (categoryIds.has(item.id)) return `Duplicate category id: ${item.id}`;
      categoryIds.add(item.id);

      if (item.snippets !== undefined && !Array.isArray(item.snippets)) return `Category ${item.id} has invalid snippets.`;
      for (const snippet of item.snippets || []) {
        if (!snippet || typeof snippet !== 'object') return `Category ${item.id} has an invalid snippet.`;
        if (typeof snippet.id !== 'string' || !snippet.id.trim()) return 'Every snippet id must be a non-empty string.';
        if (typeof snippet.name !== 'string' || !snippet.name.trim()) return `Snippet ${snippet.id} requires a name.`;
        if (typeof snippet.content !== 'string' || !snippet.content.trim()) return `Snippet ${snippet.id} requires content.`;
        if (typeof snippet.description !== 'string') return `Snippet ${snippet.id} requires a description.`;
        if (snippetIds.has(snippet.id)) return `Duplicate snippet id: ${snippet.id}`;
        snippetIds.add(snippet.id);
      }

      if (item.subcategories !== undefined && !Array.isArray(item.subcategories)) return `Category ${item.id} has invalid subcategories.`;
      for (const child of item.subcategories || []) {
        const error = visit(child);
        if (error) return error;
      }
      return null;
    };

    for (const category of candidate.categories) {
      const error = visit(category);
      if (error) return { success: false, error };
    }
    return { success: true };
  }

  private findCategoryInUserData(id: string): Category | undefined {
    if (!this.userData) return undefined;
    return this.findCategoryRecursive(this.userData.categories, id);
  }

  private findCategoryRecursive(categories: Category[], id: string): Category | undefined {
    for (const cat of categories) {
      if (cat.id === id) return cat;
      if (cat.subcategories) {
        const found = this.findCategoryRecursive(cat.subcategories, id);
        if (found) return found;
      }
    }
    return undefined;
  }

  private findSnippetInUserData(id: string): { snippet: Snippet; category: Category } | null {
    if (!this.userData) return null;
    return this.findSnippetRecursive(this.userData.categories, id);
  }

  private findSnippetRecursive(categories: Category[], id: string): { snippet: Snippet; category: Category } | null {
    for (const cat of categories) {
      if (cat.snippets) {
        const snippet = cat.snippets.find(s => s.id === id);
        if (snippet) return { snippet, category: cat };
      }
      if (cat.subcategories) {
        const found = this.findSnippetRecursive(cat.subcategories, id);
        if (found) return found;
      }
    }
    return null;
  }

  private findSnippetCategoryId(snippetId: string): string | null {
    const findInCategories = (categories: Category[]): string | null => {
      for (const cat of categories) {
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
    return this.data ? findInCategories(this.data.categories) : null;
  }

  private addCategoryToUserData(category: Category): void {
    if (!this.userData) {
      this.userData = { version: '1.0', categories: [] };
    }
    
    // Check if already exists
    const existingIdx = this.userData.categories.findIndex(c => c.id === category.id);
    if (existingIdx >= 0) {
      this.userData.categories[existingIdx] = category;
    } else {
      this.userData.categories.push(category);
    }
  }

  private ensureCategoryInUserData(categoryId: string): Category | null {
    const existing = this.findCategoryInUserData(categoryId);
    if (existing) return existing;
    if (!this.data || !this.userData) return null;

    const path = this.getCategoryPath(categoryId);
    if (path.length === 0) return null;

    const rootId = path[0].id;
    if (!this.findCategoryInUserData(rootId)) {
      const rootClone = JSON.parse(JSON.stringify(path[0])) as Category;
      this.addCategoryToUserData(rootClone);
    }

    let userCategory = this.findCategoryInUserData(rootId);
    for (let index = 1; index < path.length && userCategory; index += 1) {
      const nextId = path[index].id;
      let child = userCategory.subcategories?.find(category => category.id === nextId);
      if (!child) {
        child = JSON.parse(JSON.stringify(path[index])) as Category;
        userCategory.subcategories = userCategory.subcategories || [];
        userCategory.subcategories.push(child);
      }
      userCategory = child;
    }

    return userCategory?.id === categoryId ? userCategory : null;
  }

  private getCategoryPath(categoryId: string): Category[] {
    if (!this.data) return [];
    const visit = (categories: Category[], path: Category[]): Category[] => {
      for (const category of categories) {
        const nextPath = [...path, category];
        if (category.id === categoryId) return nextPath;
        const nested = visit(category.subcategories || [], nextPath);
        if (nested.length > 0) return nested;
      }
      return [];
    };
    return visit(this.data.categories, []);
  }

  private cloneCategoryStructure(categoryId: string): Category | null {
    const category = this.categoryMap.get(categoryId);
    if (!category) return null;

    // Clone the category, keeping its existing structure
    // Note: We only clone the structure for userData, the original built-in data stays unchanged
    return {
      id: category.id,
      name: category.name,
      icon: category.icon,
      description: category.description,
      snippets: category.snippets ? [...category.snippets] : [],
      subcategories: category.subcategories ? [...category.subcategories] : undefined
    };
  }

  private removeFromUserData(categories: Category[], type: 'category' | 'snippet', id: string): boolean {
    for (let i = 0; i < categories.length; i++) {
      const cat = categories[i];
      
      if (type === 'category' && cat.id === id) {
        categories.splice(i, 1);
        return true;
      }
      
      if (type === 'snippet' && cat.snippets) {
        const snippetIdx = cat.snippets.findIndex(s => s.id === id);
        if (snippetIdx >= 0) {
          cat.snippets.splice(snippetIdx, 1);
          return true;
        }
      }
      
      if (cat.subcategories) {
        if (this.removeFromUserData(cat.subcategories, type, id)) {
          return true;
        }
      }
    }
    return false;
  }
}

export const snippetManager = new SnippetManager();
export default snippetManager;

// Expose snippetManager to global window for native access
if (typeof window !== 'undefined') {
  (window as any).snippetManager = snippetManager;
}
