/**
 * 数据源管理器
 * 
 * 负责数据源的 CRUD 操作和持久化
 * 支持静态数据源，为动态数据源预留扩展接口
 */

import type {
  DataSource,
  DataSourceItem,
  DataSourceStorage,
  DataSourceType,
} from './template-types';
import {
  STORAGE_KEYS,
  generateId,
  createDataSource,
  DEFAULT_DATA_SOURCES,
} from './template-types';

/** 变更监听器 */
type ChangeListener = () => void;

/** 数据源管理器类 */
class DataSourceManager {
  private dataSources: Map<string, DataSource> = new Map();
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
   * 从 LocalStorage 加载数据源
   */
  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.DATA_SOURCES);
      if (data) {
        const storage: DataSourceStorage = JSON.parse(data);
        this.dataSources.clear();

        // 加载保存的数据源
        for (const ds of storage.dataSources) {
          this.dataSources.set(ds.id, ds);
        }
      }

      // 确保默认数据源存在
      for (const defaultDs of DEFAULT_DATA_SOURCES) {
        if (!this.dataSources.has(defaultDs.id)) {
          this.dataSources.set(defaultDs.id, defaultDs);
        }
      }
    } catch (e) {
      console.error('Failed to load data sources:', e);
      // 加载失败时使用默认数据源
      this.dataSources.clear();
      for (const defaultDs of DEFAULT_DATA_SOURCES) {
        this.dataSources.set(defaultDs.id, defaultDs);
      }
    }
  }

  /**
   * 保存到 LocalStorage
   */
  private saveToStorage(): void {
    try {
      const storage: DataSourceStorage = {
        version: 1,
        dataSources: this.getAllDataSources(),
        lastUpdated: Date.now(),
      };
      localStorage.setItem(STORAGE_KEYS.DATA_SOURCES, JSON.stringify(storage));
    } catch (e) {
      console.error('Failed to save data sources:', e);
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
        console.error('Data source change listener error:', e);
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
   * 获取所有数据源
   */
  getAllDataSources(): DataSource[] {
    this.init();
    return Array.from(this.dataSources.values()).sort(
      (a, b) => a.name.localeCompare(b.name)
    );
  }

  /**
   * 获取单个数据源
   */
  getDataSource(id: string): DataSource | undefined {
    this.init();
    return this.dataSources.get(id);
  }

  /**
   * 获取多个数据源
   */
  getDataSources(ids: string[]): DataSource[] {
    this.init();
    return ids
      .map(id => this.dataSources.get(id))
      .filter((ds): ds is DataSource => ds !== undefined);
  }

  /**
   * 根据类型获取数据源
   */
  getDataSourcesByType(type: DataSourceType): DataSource[] {
    this.init();
    return this.getAllDataSources().filter(ds => ds.sourceType === type);
  }

  /**
   * 搜索数据源
   */
  searchDataSources(query: string): DataSource[] {
    this.init();
    const keyword = query.toLowerCase();
    return this.getAllDataSources().filter(
      ds =>
        ds.name.toLowerCase().includes(keyword) ||
        (ds.description && ds.description.toLowerCase().includes(keyword))
    );
  }

  /**
   * 保存数据源（新建或更新）
   */
  saveDataSource(dataSource: DataSource): DataSource {
    this.init();

    const updatedDs = {
      ...dataSource,
      updatedAt: Date.now(),
    };

    this.dataSources.set(updatedDs.id, updatedDs);
    this.notifyChange();

    return updatedDs;
  }

  /**
   * 创建新数据源
   */
  createDataSource(
    name: string,
    items: DataSourceItem[],
    options: Partial<Omit<DataSource, 'id' | 'name' | 'items'>> = {}
  ): DataSource {
    const ds = createDataSource(name, items, options);
    return this.saveDataSource(ds);
  }

  /**
   * 更新数据源
   */
  updateDataSource(
    id: string,
    updates: Partial<Omit<DataSource, 'id' | 'createdAt'>>
  ): DataSource | undefined {
    const ds = this.dataSources.get(id);
    if (!ds) return undefined;

    const updatedDs = {
      ...ds,
      ...updates,
      updatedAt: Date.now(),
    };

    this.dataSources.set(id, updatedDs);
    this.notifyChange();

    return updatedDs;
  }

  /**
   * 删除数据源
   */
  deleteDataSource(id: string): boolean {
    this.init();

    // 默认数据源不可删除
    if (DEFAULT_DATA_SOURCES.some(ds => ds.id === id)) {
      return false;
    }

    const result = this.dataSources.delete(id);
    if (result) {
      this.notifyChange();
    }
    return result;
  }

  /**
   * 添加数据源项
   */
  addDataSourceItem(
    dataSourceId: string,
    item: DataSourceItem
  ): DataSource | undefined {
    const ds = this.dataSources.get(dataSourceId);
    if (!ds) return undefined;

    const updatedItems = [...ds.items, item];
    return this.updateDataSource(dataSourceId, { items: updatedItems });
  }

  /**
   * 更新数据源项
   */
  updateDataSourceItem(
    dataSourceId: string,
    itemValue: string,
    updates: Partial<DataSourceItem>
  ): DataSource | undefined {
    const ds = this.dataSources.get(dataSourceId);
    if (!ds) return undefined;

    const updatedItems = ds.items.map(item =>
      item.value === itemValue ? { ...item, ...updates } : item
    );

    return this.updateDataSource(dataSourceId, { items: updatedItems });
  }

  /**
   * 删除数据源项
   */
  deleteDataSourceItem(
    dataSourceId: string,
    itemValue: string
  ): DataSource | undefined {
    const ds = this.dataSources.get(dataSourceId);
    if (!ds) return undefined;

    const updatedItems = ds.items.filter(item => item.value !== itemValue);
    return this.updateDataSource(dataSourceId, { items: updatedItems });
  }

  /**
   * 批量添加数据源项
   */
  addDataSourceItems(
    dataSourceId: string,
    items: DataSourceItem[]
  ): DataSource | undefined {
    const ds = this.dataSources.get(dataSourceId);
    if (!ds) return undefined;

    // 过滤重复值
    const existingValues = new Set(ds.items.map(i => i.value));
    const newItems = items.filter(i => !existingValues.has(i.value));

    const updatedItems = [...ds.items, ...newItems];
    return this.updateDataSource(dataSourceId, { items: updatedItems });
  }

  /**
   * 从数组字符串导入（逗号或换行分隔）
   */
  importFromString(
    dataSourceId: string,
    input: string,
    separator: string = '\n'
  ): DataSource | undefined {
    const lines = input
      .split(separator)
      .map(s => s.trim())
      .filter(Boolean);

    const items: DataSourceItem[] = lines.map(line => {
      // 支持 "value|label" 格式
      const parts = line.split('|').map(s => s.trim());
      return {
        value: parts[0],
        label: parts[1] || parts[0],
      };
    });

    return this.addDataSourceItems(dataSourceId, items);
  }

  /**
   * 导出数据源为字符串
   */
  exportToString(dataSourceId: string, separator: string = '\n'): string | undefined {
    const ds = this.dataSources.get(dataSourceId);
    if (!ds) return undefined;

    return ds.items
      .map(item => (item.label === item.value ? item.value : `${item.value}|${item.label}`))
      .join(separator);
  }

  /**
   * 复制数据源
   */
  duplicateDataSource(id: string, newName?: string): DataSource | undefined {
    const ds = this.dataSources.get(id);
    if (!ds) return undefined;

    const duplicated: DataSource = {
      ...ds,
      id: generateId(),
      name: newName || `${ds.name} (Copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.dataSources.set(duplicated.id, duplicated);
    this.notifyChange();

    return duplicated;
  }

  /**
   * 重置默认数据源
   */
  resetDefaults(): void {
    for (const defaultDs of DEFAULT_DATA_SOURCES) {
      this.dataSources.set(defaultDs.id, { ...defaultDs });
    }
    this.notifyChange();
  }

  /**
   * 检查数据源是否被模板使用
   */
  isInUse(dataSourceId: string, templateVariables: { dataSourceId?: string }[]): boolean {
    return templateVariables.some(v => v.dataSourceId === dataSourceId);
  }

  /**
   * 获取使用指定数据源的模板数量
   */
  getUsageCount(
    dataSourceId: string,
    allTemplateVariables: { id: string; variables: { dataSourceId?: string }[] }[]
  ): number {
    return allTemplateVariables.filter(t =>
      t.variables.some(v => v.dataSourceId === dataSourceId)
    ).length;
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    total: number;
    static: number;
    dynamic: number;
    totalItems: number;
  } {
    const sources = this.getAllDataSources();
    return {
      total: sources.length,
      static: sources.filter(s => s.sourceType === 'static').length,
      dynamic: sources.filter(s => s.sourceType === 'dynamic').length,
      totalItems: sources.reduce((sum, s) => sum + s.items.length, 0),
    };
  }

  /**
   * 清空所有用户数据源（谨慎使用）
   */
  clearUserDataSources(): void {
    const toDelete: string[] = [];
    for (const [id, ds] of this.dataSources) {
      // 只删除非默认数据源
      if (!DEFAULT_DATA_SOURCES.some(defaultDs => defaultDs.id === id)) {
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      this.dataSources.delete(id);
    }

    this.notifyChange();
  }

  /**
   * 验证数据源
   */
  validateDataSource(dataSource: Partial<DataSource>): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!dataSource.name || dataSource.name.trim().length === 0) {
      errors.push('名称不能为空');
    }

    if (dataSource.items) {
      const values = new Set<string>();
      for (const item of dataSource.items) {
        if (!item.value || item.value.trim().length === 0) {
          errors.push('选项值不能为空');
        } else if (values.has(item.value)) {
          errors.push(`重复的选项值: ${item.value}`);
        } else {
          values.add(item.value);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 检查数据源名称是否已存在
   */
  isNameExists(name: string, excludeId?: string): boolean {
    const lowerName = name.toLowerCase();
    return this.getAllDataSources().some(
      ds => ds.name.toLowerCase() === lowerName && ds.id !== excludeId
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
   * 获取数据源项的值列表
   */
  getDataSourceValues(dataSourceId: string): string[] {
    const ds = this.dataSources.get(dataSourceId);
    return ds ? ds.items.map(i => i.value) : [];
  }

  /**
   * 获取数据源项的标签列表
   */
  getDataSourceLabels(dataSourceId: string): string[] {
    const ds = this.dataSources.get(dataSourceId);
    return ds ? ds.items.map(i => i.label) : [];
  }

  /**
   * 查找数据源项
   */
  findDataSourceItem(
    dataSourceId: string,
    value: string
  ): DataSourceItem | undefined {
    const ds = this.dataSources.get(dataSourceId);
    return ds?.items.find(i => i.value === value);
  }
}

// 导出单例实例
export const dataSourceManager = new DataSourceManager();

// 导出便捷函数
export function getDataSource(id: string): DataSource | undefined {
  return dataSourceManager.getDataSource(id);
}

export function getAllDataSources(): DataSource[] {
  return dataSourceManager.getAllDataSources();
}

export function saveDataSource(dataSource: DataSource): DataSource {
  return dataSourceManager.saveDataSource(dataSource);
}

export function deleteDataSource(id: string): boolean {
  return dataSourceManager.deleteDataSource(id);
}

export function createDataSourceShortcut(
  name: string,
  items: DataSourceItem[],
  options?: Parameters<DataSourceManager['createDataSource']>[2]
): DataSource {
  return dataSourceManager.createDataSource(name, items, options);
}

export function searchDataSources(query: string): DataSource[] {
  return dataSourceManager.searchDataSources(query);
}
