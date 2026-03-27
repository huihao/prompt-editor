/**
 * 模板管理器
 * 
 * 负责模板的 CRUD 操作和持久化
 */

import type {
  PromptTemplate,
  TemplateFilter,
  TemplateStorage,
  TemplateCategory,
  TemplateValues,
} from './template-types';
import {
  STORAGE_KEYS,
  generateId,
  createTemplate,
  DEFAULT_TEMPLATES,
  BUILTIN_CATEGORIES,
} from './template-types';
import { syncVariables, validateTemplate, autoFixVariables } from './template-parser';

/** 变更监听器 */
type ChangeListener = () => void;

/** 模板管理器类 */
class TemplateManager {
  private templates: Map<string, PromptTemplate> = new Map();
  private listeners: ChangeListener[] = [];
  private initialized: boolean = false;

  /**
   * 初始化，从存储加载数据
   */
  init(): void {
    if (this.initialized) return;

    this.loadFromStorage();
    this.initialized = true;
  }

  /**
   * 从 LocalStorage 加载模板
   */
  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TEMPLATES);
      if (data) {
        const storage: TemplateStorage = JSON.parse(data);
        this.templates.clear();

        // 加载保存的模板
        for (const template of storage.templates) {
          this.templates.set(template.id, template);
        }
      }

      // 确保内置模板存在（不会被覆盖）
      for (const builtin of DEFAULT_TEMPLATES) {
        if (!this.templates.has(builtin.id)) {
          this.templates.set(builtin.id, builtin);
        }
      }
    } catch (e) {
      console.error('Failed to load templates:', e);
      // 加载失败时使用默认模板
      this.templates.clear();
      for (const builtin of DEFAULT_TEMPLATES) {
        this.templates.set(builtin.id, builtin);
      }
    }
  }

  /**
   * 保存到 LocalStorage
   */
  private saveToStorage(): void {
    try {
      const storage: TemplateStorage = {
        version: 1,
        templates: this.getAllTemplates(),
        lastUpdated: Date.now(),
      };
      localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(storage));
    } catch (e) {
      console.error('Failed to save templates:', e);
    }
  }

  /**
   * 通知监听器
   */
  private notifyChange(): void {
    this.saveToStorage();
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (e) {
        console.error('Template change listener error:', e);
      }
    }
  }

  /**
   * 添加变更监听器
   */
  onChange(listener: ChangeListener): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * 获取所有模板
   */
  getAllTemplates(): PromptTemplate[] {
    this.init();
    return Array.from(this.templates.values()).sort(
      (a, b) => b.updatedAt - a.updatedAt
    );
  }

  /**
   * 获取单个模板
   */
  getTemplate(id: string): PromptTemplate | undefined {
    this.init();
    return this.templates.get(id);
  }

  /**
   * 根据过滤条件获取模板
   */
  getTemplates(filter: TemplateFilter = {}): PromptTemplate[] {
    this.init();
    let templates = this.getAllTemplates();

    // 关键词搜索
    if (filter.keyword) {
      const keyword = filter.keyword.toLowerCase();
      templates = templates.filter(
        t =>
          t.name.toLowerCase().includes(keyword) ||
          (t.description && t.description.toLowerCase().includes(keyword)) ||
          (t.tags && t.tags.some(tag => tag.toLowerCase().includes(keyword)))
      );
    }

    // 分类筛选
    if (filter.category && filter.category !== 'all') {
      templates = templates.filter(t => t.category === filter.category);
    }

    // 标签筛选
    if (filter.tags && filter.tags.length > 0) {
      templates = templates.filter(
        t => t.tags && filter.tags!.some(tag => t.tags!.includes(tag))
      );
    }

    return templates;
  }

  /**
   * 获取所有分类及其模板数量
   */
  getCategoriesWithCount(): Array<TemplateCategory & { count: number }> {
    this.init();
    const templates = this.getAllTemplates();

    return BUILTIN_CATEGORIES.map(cat => ({
      ...cat,
      count:
        cat.id === 'all'
          ? templates.length
          : templates.filter(t => t.category === cat.id).length,
    }));
  }

  /**
   * 获取所有可用标签
   */
  getAllTags(): string[] {
    this.init();
    const tags = new Set<string>();
    for (const template of this.templates.values()) {
      if (template.tags) {
        for (const tag of template.tags) {
          tags.add(tag);
        }
      }
    }
    return Array.from(tags).sort();
  }

  /**
   * 保存模板（新建或更新）
   */
  saveTemplate(template: PromptTemplate): PromptTemplate {
    this.init();

    // 同步变量定义
    const syncedTemplate = {
      ...template,
      variables: syncVariables(template.content, template.variables),
      updatedAt: Date.now(),
    };

    this.templates.set(syncedTemplate.id, syncedTemplate);
    this.notifyChange();

    return syncedTemplate;
  }

  /**
   * 创建新模板
   */
  createTemplate(
    name: string,
    content: string,
    options: Partial<Omit<PromptTemplate, 'id' | 'name' | 'content'>> = {}
  ): PromptTemplate {
    const template = createTemplate(name, content, options);
    return this.saveTemplate(template);
  }

  /**
   * 更新模板
   */
  updateTemplate(
    id: string,
    updates: Partial<Omit<PromptTemplate, 'id' | 'createdAt'>>
  ): PromptTemplate | undefined {
    const template = this.templates.get(id);
    if (!template) return undefined;

    // 内置模板不允许修改基本属性
    if (template.isBuiltin) {
      const allowedUpdates: Partial<PromptTemplate> = {};
      if (updates.variables) allowedUpdates.variables = updates.variables;
      if (updates.tags) allowedUpdates.tags = updates.tags;

      const updatedTemplate = {
        ...template,
        ...allowedUpdates,
        updatedAt: Date.now(),
      };

      this.templates.set(id, updatedTemplate);
      this.notifyChange();
      return updatedTemplate;
    }

    const updatedTemplate = {
      ...template,
      ...updates,
      updatedAt: Date.now(),
    };

    // 如果内容变化，同步变量
    if (updates.content) {
      updatedTemplate.variables = syncVariables(
        updates.content,
        updatedTemplate.variables
      );
    }

    this.templates.set(id, updatedTemplate);
    this.notifyChange();

    return updatedTemplate;
  }

  /**
   * 删除模板
   */
  deleteTemplate(id: string): boolean {
    this.init();
    const template = this.templates.get(id);

    // 内置模板不可删除
    if (!template || template.isBuiltin) {
      return false;
    }

    const result = this.templates.delete(id);
    if (result) {
      this.notifyChange();
    }
    return result;
  }

  /**
   * 复制模板
   */
  duplicateTemplate(id: string, newName?: string): PromptTemplate | undefined {
    const template = this.templates.get(id);
    if (!template) return undefined;

    const duplicated: PromptTemplate = {
      ...template,
      id: generateId(),
      name: newName || `${template.name} (Copy)`,
      isBuiltin: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.templates.set(duplicated.id, duplicated);
    this.notifyChange();

    return duplicated;
  }

  /**
   * 导入模板
   */
  importTemplate(jsonString: string): PromptTemplate | undefined {
    try {
      const data = JSON.parse(jsonString);

      // 验证必要字段
      if (!data.name || !data.content) {
        throw new Error('Invalid template format: missing name or content');
      }

      const template = createTemplate(data.name, data.content, {
        description: data.description,
        category: data.category,
        variables: data.variables || [],
        tags: data.tags,
      });

      return this.saveTemplate(template);
    } catch (e) {
      console.error('Failed to import template:', e);
      return undefined;
    }
  }

  /**
   * 导出模板为 JSON
   */
  exportTemplate(id: string): string | undefined {
    const template = this.templates.get(id);
    if (!template) return undefined;

    const exportData = {
      name: template.name,
      description: template.description,
      category: template.category,
      content: template.content,
      variables: template.variables,
      tags: template.tags,
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * 重置内置模板
   */
  resetBuiltins(): void {
    for (const builtin of DEFAULT_TEMPLATES) {
      this.templates.set(builtin.id, { ...builtin });
    }
    this.notifyChange();
  }

  /**
   * 自动修复所有模板
   */
  autoFixAll(): void {
    for (const [id, template] of this.templates) {
      if (!template.isBuiltin) {
        const fixed = autoFixVariables(template);
        this.templates.set(id, fixed);
      }
    }
    this.notifyChange();
  }

  /**
   * 验证模板
   */
  validateTemplate(id: string): ReturnType<typeof validateTemplate> | undefined {
    const template = this.templates.get(id);
    if (!template) return undefined;

    return validateTemplate(template);
  }

  /**
   * 搜索模板
   */
  searchTemplates(query: string): PromptTemplate[] {
    return this.getTemplates({ keyword: query });
  }

  /**
   * 获取最近使用的模板
   */
  getRecentTemplates(limit: number = 5): PromptTemplate[] {
    return this.getAllTemplates()
      .filter(t => !t.isBuiltin)
      .slice(0, limit);
  }

  /**
   * 获取内置模板
   */
  getBuiltinTemplates(): PromptTemplate[] {
    return this.getAllTemplates().filter(t => t.isBuiltin);
  }

  /**
   * 获取用户创建的模板
   */
  getUserTemplates(): PromptTemplate[] {
    return this.getAllTemplates().filter(t => !t.isBuiltin);
  }

  /**
   * 检查模板名称是否已存在
   */
  isNameExists(name: string, excludeId?: string): boolean {
    const lowerName = name.toLowerCase();
    return this.getAllTemplates().some(
      t => t.name.toLowerCase() === lowerName && t.id !== excludeId
    );
  }

  /**
   * 生成唯一名称
   */
  generateUniqueName(baseName: string): string {
    let name = baseName;
    let counter = 1;

    while (this.isNameExists(name)) {
      name = `${baseName} (${counter})`;
      counter++;
    }

    return name;
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    total: number;
    builtin: number;
    user: number;
    categories: Record<string, number>;
  } {
    const templates = this.getAllTemplates();
    const categories: Record<string, number> = {};

    for (const t of templates) {
      const cat = t.category || 'other';
      categories[cat] = (categories[cat] || 0) + 1;
    }

    return {
      total: templates.length,
      builtin: templates.filter(t => t.isBuiltin).length,
      user: templates.filter(t => !t.isBuiltin).length,
      categories,
    };
  }

  /**
   * 清空所有用户模板（谨慎使用）
   */
  clearUserTemplates(): void {
    const toDelete: string[] = [];
    for (const [id, template] of this.templates) {
      if (!template.isBuiltin) {
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      this.templates.delete(id);
    }

    this.notifyChange();
  }
}

// 导出单例实例
export const templateManager = new TemplateManager();

// 导出便捷函数
export function getTemplate(id: string): PromptTemplate | undefined {
  return templateManager.getTemplate(id);
}

export function getAllTemplates(): PromptTemplate[] {
  return templateManager.getAllTemplates();
}

export function saveTemplate(template: PromptTemplate): PromptTemplate {
  return templateManager.saveTemplate(template);
}

export function deleteTemplate(id: string): boolean {
  return templateManager.deleteTemplate(id);
}

export function createTemplateShortcut(
  name: string,
  content: string,
  options?: Parameters<TemplateManager['createTemplate']>[2]
): PromptTemplate {
  return templateManager.createTemplate(name, content, options);
}

export function searchTemplates(query: string): PromptTemplate[] {
  return templateManager.searchTemplates(query);
}

export function getCategoriesWithCount(): Array<TemplateCategory & { count: number }> {
  return templateManager.getCategoriesWithCount();
}
