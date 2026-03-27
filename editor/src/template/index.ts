/**
 * 模板系统入口
 * 
 * 导出模板系统的所有公共 API
 */

// 类型定义
export type {
  VariableType,
  DataSourceItem,
  DataSourceType,
  DataSource,
  TemplateVariable,
  PromptTemplate,
  TemplateCategory,
  TemplateValues,
  ParsedVariable,
  TemplateFilter,
  TemplateStorage,
  DataSourceStorage,
} from './template-types';

// 类型定义常量
export {
  BUILTIN_CATEGORIES,
  DEFAULT_TEMPLATES,
  DEFAULT_DATA_SOURCES,
  STORAGE_KEYS,
  generateId,
  createTemplate,
  createDataSource,
} from './template-types';

// 模板解析器
export {
  parseVariables,
  extractUniqueVariableNames,
  parseDefaultValue,
  syncVariables,
  formatVariableName,
  isValidVariableName,
  validateTemplate,
  autoFixVariables,
  hasVariables,
  getVariableStats,
  replaceVariables,
  suggestVariableDefinition,
} from './template-parser';

// 模板渲染器
export {
  renderField,
  renderForm,
  collectFormValues,
  validateFormValues,
  renderTemplate,
  previewTemplate,
  getDefaultValue,
  createDefaultValues,
  needsUserInput,
  getRequiredVariableCount,
  estimateRenderedLength,
} from './template-renderer';

// 模板管理器
export {
  templateManager,
  getTemplate,
  getAllTemplates,
  saveTemplate,
  deleteTemplate,
  createTemplateShortcut,
  searchTemplates,
  getCategoriesWithCount,
} from './template-manager';

// 数据源管理器
export {
  dataSourceManager,
  getDataSource,
  getAllDataSources,
  saveDataSource,
  deleteDataSource,
  createDataSourceShortcut,
  searchDataSources,
} from './data-source-manager';

// UI 组件
export {
  templateUI,
  initTemplateUI,
  showTemplatePanel,
  hideTemplatePanel,
  toggleTemplatePanel,
  destroyTemplateUI,
} from './template-ui';

// 模板管理器 UI
export {
  templateManagerUI,
  initTemplateManagerUI,
  openTemplateManager,
  closeTemplateManager,
} from './template-manager-ui';
