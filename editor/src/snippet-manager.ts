// Snippet Manager - Manages prompt snippets with hierarchical categories
// Supports CRUD operations and persists user changes to localStorage

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

const STORAGE_KEY = 'prompt-editor-snippets';

class SnippetManager {
  private data: SnippetData | null = null;
  private snippetMap: Map<string, Snippet> = new Map();
  private categoryMap: Map<string, Category> = new Map();
  private userData: SnippetData | null = null; // User custom snippets
  private isLoaded = false;

  async loadData(): Promise<void> {
    if (this.isLoaded) return;
    
    try {
      // Load built-in snippets from JSON
      const response = await fetch('data/snippets.json');
      if (!response.ok) {
        throw new Error(`Failed to load snippets: ${response.status}`);
      }
      this.data = await response.json();
      
      // Load user custom snippets from localStorage
      this.loadUserData();
      
      // Merge user data with built-in data
      this.mergeData();
      
      this.buildMaps();
      this.isLoaded = true;
    } catch (error) {
      console.error('Failed to load snippet data:', error);
      this.data = { version: '1.0', categories: [] };
      this.loadUserData();
      this.mergeData();
      this.buildMaps();
      this.isLoaded = true;
    }
  }

  private loadUserData(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.userData = JSON.parse(stored);
      } else {
        this.userData = { version: '1.0', categories: [] };
      }
    } catch (error) {
      console.error('Failed to load user snippets:', error);
      this.userData = { version: '1.0', categories: [] };
    }
  }

  private saveUserData(): void {
    try {
      if (this.userData) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.userData));
      }
    } catch (error) {
      console.error('Failed to save user snippets:', error);
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
      const existingCat = this.data.categories.find(c => c.id === userCat.id);
      if (existingCat) {
        // Merge snippets into existing category
        if (userCat.snippets) {
          existingCat.snippets = existingCat.snippets || [];
          for (const snippet of userCat.snippets) {
            const idx = existingCat.snippets.findIndex(s => s.id === snippet.id);
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
    console.log('[SnippetManager] addCategory called:', category, 'parentId:', parentId);
    this.ensureLoaded();
    
    if (!this.userData) {
      console.log('[SnippetManager] Initializing userData');
      this.userData = { version: '1.0', categories: [] };
    }

    // Check for duplicate ID
    if (this.categoryMap.has(category.id)) {
      console.error(`[SnippetManager] Category with id ${category.id} already exists`);
      return false;
    }

    if (parentId) {
      // Add to parent category
      const userParent = this.findCategoryInUserData(parentId);
      if (userParent) {
        userParent.subcategories = userParent.subcategories || [];
        userParent.subcategories.push(category);
        console.log('[SnippetManager] Added to parent subcategories');
      } else {
        // Parent is from built-in data, clone it to user data first
        const builtInParent = this.categoryMap.get(parentId);
        if (builtInParent) {
          const clonedParent = this.cloneCategoryStructure(builtInParent.id);
          if (clonedParent) {
            clonedParent.subcategories = [category];
            this.addCategoryToUserData(clonedParent);
            console.log('[SnippetManager] Cloned parent and added category to it');
          } else {
            this.userData.categories.push(category);
            console.log('[SnippetManager] Failed to clone parent, added to root');
          }
        } else {
          // Parent not found at all, add to root
          this.userData.categories.push(category);
          console.log('[SnippetManager] Parent not found, added to root');
        }
      }
    } else {
      // Add to root
      this.userData.categories.push(category);
      console.log('[SnippetManager] Added to root categories');
    }

    this.saveUserData();
    await this.reloadData();
    console.log('[SnippetManager] Category saved successfully');
    return true;
  }

  // Update a category
  async updateCategory(id: string, updates: Partial<Category>): Promise<boolean> {
    this.ensureLoaded();
    
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
    let userCategory = this.findCategoryInUserData(categoryId);
    if (!userCategory) {
      // Clone category structure to user data
      const clonedCategory = this.cloneCategoryStructure(categoryId);
      if (!clonedCategory) {
        console.error(`Failed to clone category ${categoryId}`);
        return false;
      }
      userCategory = clonedCategory;
      this.addCategoryToUserData(userCategory);
    }

    userCategory.snippets = userCategory.snippets || [];
    userCategory.snippets.push(snippet);

    this.saveUserData();
    await this.reloadData();
    return true;
  }

  // Update a snippet
  async updateSnippet(id: string, updates: Partial<Snippet>): Promise<boolean> {
    this.ensureLoaded();
    
    const snippet = this.snippetMap.get(id);
    if (!snippet) {
      console.error(`Snippet ${id} not found`);
      return false;
    }

    // Find snippet in user data
    const result = this.findSnippetInUserData(id);
    if (result) {
      Object.assign(result.snippet, updates);
    } else {
      // Snippet from built-in data, need to clone it and its category
      const categoryId = this.findSnippetCategoryId(id);
      if (categoryId) {
        const userCategory = this.cloneCategoryStructure(categoryId);
        if (userCategory) {
          const targetSnippet = userCategory.snippets?.find(s => s.id === id);
          if (targetSnippet) {
            Object.assign(targetSnippet, updates);
          }
          this.addCategoryToUserData(userCategory);
        }
      }
    }

    this.saveUserData();
    await this.reloadData();
    return true;
  }

  // Delete a snippet
  async deleteSnippet(id: string): Promise<boolean> {
    this.ensureLoaded();
    
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
  async importData(json: string): Promise<boolean> {
    try {
      const imported: SnippetData = JSON.parse(json);
      if (imported.categories) {
        this.userData = imported;
        this.saveUserData();
        await this.reloadData();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to import snippets:', error);
      return false;
    }
  }

  // Reset to default (clear user data)
  resetToDefault(): void {
    this.userData = { version: '1.0', categories: [] };
    localStorage.removeItem(STORAGE_KEY);
    this.isLoaded = false;
    this.loadData();
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

  private cloneCategoryStructure(categoryId: string): Category | null {
    const category = this.categoryMap.get(categoryId);
    if (!category) return null;

    return {
      id: category.id,
      name: category.name,
      icon: category.icon,
      description: category.description,
      snippets: [],
      subcategories: undefined
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
