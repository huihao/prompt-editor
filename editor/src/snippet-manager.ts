// Snippet Manager - Manages prompt snippets with hierarchical categories

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

class SnippetManager {
  private data: SnippetData | null = null;
  private snippetMap: Map<string, Snippet> = new Map();
  private categoryMap: Map<string, Category> = new Map();

  async loadData(): Promise<void> {
    try {
      const response = await fetch('data/snippets.json');
      if (!response.ok) {
        throw new Error(`Failed to load snippets: ${response.status}`);
      }
      this.data = await response.json();
      this.buildMaps();
    } catch (error) {
      console.error('Failed to load snippet data:', error);
      this.data = { version: '1.0', categories: [] };
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
}

export const snippetManager = new SnippetManager();
export default snippetManager;
