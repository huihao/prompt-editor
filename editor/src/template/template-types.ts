/**
 * 模板系统类型定义
 * 
 * 提供提示词模板、变量和数据源的完整类型支持
 */

/** 变量输入类型 */
export type VariableType = 'text' | 'textarea' | 'select' | 'multiselect' | 'number';

/** 数据源项 */
export interface DataSourceItem {
  /** 选项值 */
  value: string;
  /** 显示标签 */
  label: string;
  /** 描述（可选） */
  description?: string;
}

/** 数据源类型 */
export type DataSourceType = 'static' | 'dynamic';

/** 数据源定义 */
export interface DataSource {
  /** 唯一标识 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 描述 */
  description?: string;
  /** 数据源类型（预留动态扩展） */
  sourceType: DataSourceType;
  /** 数据源项 */
  items: DataSourceItem[];
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
}

/** 模板变量定义 */
export interface TemplateVariable {
  /** 变量标识符（用于模板中的 {{id}}） */
  id: string;
  /** 变量显示名称 */
  name: string;
  /** 输入类型 */
  type: VariableType;
  /** 表单标签 */
  label: string;
  /** 占位提示 */
  placeholder?: string;
  /** 默认值 */
  defaultValue?: string | string[] | number;
  /** 是否必填 */
  required?: boolean;
  /** 关联的数据源ID（用于select/multiselect） */
  dataSourceId?: string;
  /** 内联选项（优先级低于dataSourceId，用于简单场景） */
  options?: string[];
  /** 验证规则（正则表达式字符串） */
  validation?: string;
  /** 排序权重 */
  order?: number;
}

/** 提示词模板 */
export interface PromptTemplate {
  /** 唯一标识 */
  id: string;
  /** 模板名称 */
  name: string;
  /** 描述 */
  description?: string;
  /** 分类（如 "代码", "写作", "调试"） */
  category?: string;
  /** 模板内容，包含 {{variable}} 占位符 */
  content: string;
  /** 变量定义列表 */
  variables: TemplateVariable[];
  /** 标签 */
  tags?: string[];
  /** 是否内置模板（不可删除） */
  isBuiltin?: boolean;
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
}

/** 模板分类 */
export interface TemplateCategory {
  /** 分类ID */
  id: string;
  /** 显示名称 */
  name: string;
  /** 图标（emoji或字符） */
  icon?: string;
  /** 排序权重 */
  order?: number;
}

/** 模板填充值 */
export type TemplateValues = Record<string, string | string[] | number>;

/** 解析后的变量（从模板内容中提取） */
export interface ParsedVariable {
  /** 变量名 */
  name: string;
  /** 完整匹配字符串 */
  fullMatch: string;
  /** 默认值（如果有） */
  defaultValue?: string;
  /** 在内容中的位置 */
  index: number;
}

/** 模板过滤选项 */
export interface TemplateFilter {
  /** 分类筛选 */
  category?: string;
  /** 标签筛选 */
  tags?: string[];
  /** 搜索关键词 */
  keyword?: string;
  /** 仅收藏 */
  favoritesOnly?: boolean;
}

/** 模板存储格式 */
export interface TemplateStorage {
  /** 版本号 */
  version: number;
  /** 模板列表 */
  templates: PromptTemplate[];
  /** 最后更新时间 */
  lastUpdated: number;
}

/** 数据源存储格式 */
export interface DataSourceStorage {
  /** 版本号 */
  version: number;
  /** 数据源列表 */
  dataSources: DataSource[];
  /** 最后更新时间 */
  lastUpdated: number;
}

/** 内置分类列表 */
export const BUILTIN_CATEGORIES: TemplateCategory[] = [
  { id: 'all', name: 'All', icon: '📋', order: 0 },
  { id: 'code', name: 'Code', icon: '💻', order: 1 },
  { id: 'writing', name: 'Writing', icon: '✍️', order: 2 },
  { id: 'debug', name: 'Debug', icon: '🐛', order: 3 },
  { id: 'review', name: 'Review', icon: '👀', order: 4 },
  { id: 'refactor', name: 'Refactor', icon: '🔧', order: 5 },
  { id: 'test', name: 'Test', icon: '🧪', order: 6 },
  { id: 'doc', name: 'Documentation', icon: '📚', order: 7 },
  { id: 'other', name: 'Other', icon: '📦', order: 99 },
];

/** 默认内置模板 - 用于 Code Agent 的提示词 */
export const DEFAULT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'builtin-code-review',
    name: '🔍 Code Review',
    description: '对当前代码进行审查，关注质量、潜在问题和最佳实践',
    category: 'review',
    content: `请对当前代码进行全面审查，关注以下方面：

**审查重点：**
{{focus_areas}}

**审查风格：** {{style}}

请提供：
1. 代码质量总体评估
2. 发现的潜在问题或 bug
3. 安全性和性能方面的考虑
4. 可读性和可维护性建议
5. 具体的改进建议（如有）

请以建设性和教育性的方式提供反馈。`,
    variables: [
      {
        id: 'focus_areas',
        name: '审查重点',
        type: 'multiselect',
        label: 'Focus Areas',
        options: ['代码质量', '潜在Bug', '安全性', '性能', '可读性', '最佳实践', '错误处理', '边界情况'],
        defaultValue: ['代码质量', '潜在Bug', '最佳实践'],
        order: 1,
      },
      {
        id: 'style',
        name: '审查风格',
        type: 'select',
        label: 'Review Style',
        options: ['严格', '温和', '教育性'],
        defaultValue: '温和',
        order: 2,
      },
    ],
    tags: ['code', 'review'],
    isBuiltin: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'builtin-explain-code',
    name: '📖 Explain Code',
    description: '解释代码的功能、工作原理和设计思路',
    category: 'code',
    content: `请详细解释当前代码的功能和工作原理。

**解释详细程度：** {{detail_level}}

请包含以下内容：
1. 代码的整体功能和目的
2. 主要逻辑流程的解释
3. 关键函数/方法的作用
4. 使用的算法或设计模式（如有）
5. 数据流和控制流说明
6. 重要的边界情况和注意事项

{{#if include_examples}}
7. 使用示例或场景说明
{{/if}}`,
    variables: [
      {
        id: 'detail_level',
        name: '详细程度',
        type: 'select',
        label: 'Detail Level',
        options: ['简要概述', '标准解释', '深入详细'],
        defaultValue: '标准解释',
        order: 1,
      },
      {
        id: 'include_examples',
        name: '包含示例',
        type: 'select',
        label: 'Include Examples',
        options: ['是', '否'],
        defaultValue: '是',
        order: 2,
      },
    ],
    tags: ['explain', 'code'],
    isBuiltin: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'builtin-refactor',
    name: '🔧 Refactor Code',
    description: '重构代码以提高质量和可维护性',
    category: 'refactor',
    content: `请对当前代码进行重构，以提高其质量和可维护性。

**重构目标：**
{{goals}}

**约束条件：**
- 保持原有功能不变
- {{constraints}}

请提供：
1. 重构后的代码
2. 重构的具体改动说明
3. 改进的理由
4. 可能存在的风险或需要注意的地方`,
    variables: [
      {
        id: 'goals',
        name: '重构目标',
        type: 'multiselect',
        label: 'Refactoring Goals',
        options: ['提高可读性', '降低复杂度', '提高性能', '增强可测试性', '改进命名', '减少重复代码', '优化架构'],
        defaultValue: ['提高可读性', '降低复杂度'],
        order: 1,
      },
      {
        id: 'constraints',
        name: '额外约束',
        type: 'text',
        label: 'Additional Constraints',
        placeholder: '如：保持API兼容、使用特定模式',
        defaultValue: '遵循语言最佳实践',
        order: 2,
      },
    ],
    tags: ['refactor', 'improve'],
    isBuiltin: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'builtin-write-tests',
    name: '🧪 Write Tests',
    description: '为代码生成测试用例',
    category: 'test',
    content: `请为当前代码编写全面的测试用例。

**测试类型：** {{test_type}}
**测试框架：** {{framework}}

请包含：
1. 测试用例代码
2. 测试覆盖的场景：
   - 正常路径（Happy Path）
   - {{edge_cases}}
   - 错误处理
3. 测试数据准备
4. 每个测试的断言说明

确保测试：
- 独立且可重复运行
- 有清晰的命名和注释
- 覆盖关键逻辑分支`,
    variables: [
      {
        id: 'test_type',
        name: '测试类型',
        type: 'select',
        label: 'Test Type',
        options: ['单元测试', '集成测试', '两者都包含'],
        defaultValue: '单元测试',
        order: 1,
      },
      {
        id: 'framework',
        name: '测试框架',
        type: 'text',
        label: 'Testing Framework',
        placeholder: '如：jest, pytest, cargo test, go test',
        order: 2,
      },
      {
        id: 'edge_cases',
        name: '边界情况',
        type: 'multiselect',
        label: 'Edge Cases to Cover',
        options: ['空值/空输入', '边界值', '极大/极小值', '特殊字符', '并发访问', '资源耗尽'],
        defaultValue: ['空值/空输入', '边界值'],
        order: 3,
      },
    ],
    tags: ['test', 'testing'],
    isBuiltin: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'builtin-debug',
    name: '🐛 Debug Help',
    description: '帮助分析和解决代码中的问题',
    category: 'debug',
    content: `我遇到了一个代码问题，请帮助分析和解决。

**问题描述：** {{description}}

**已知信息：**
- 错误现象：{{error_symptom}}
- 期望行为：{{expected_behavior}}
- 已尝试的解决方案：{{attempted_fixes}}

请帮助：
1. 分析可能的原因
2. 提供调试思路和检查点
3. 建议解决方案
4. 预防措施建议`,
    variables: [
      {
        id: 'description',
        name: '问题描述',
        type: 'textarea',
        label: 'Problem Description',
        placeholder: '详细描述遇到的问题...',
        required: true,
        order: 1,
      },
      {
        id: 'error_symptom',
        name: '错误现象',
        type: 'textarea',
        label: 'Error Symptom',
        placeholder: '描述具体的错误表现、错误消息等',
        order: 2,
      },
      {
        id: 'expected_behavior',
        name: '期望行为',
        type: 'textarea',
        label: 'Expected Behavior',
        placeholder: '描述代码应该产生的结果',
        order: 3,
      },
      {
        id: 'attempted_fixes',
        name: '已尝试方案',
        type: 'textarea',
        label: 'Attempted Fixes',
        placeholder: '描述已经尝试过的解决方法',
        order: 4,
      },
    ],
    tags: ['debug', 'help'],
    isBuiltin: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'builtin-write-doc',
    name: '📚 Write Documentation',
    description: '为代码编写文档注释',
    category: 'doc',
    content: `请为当前代码编写清晰的文档和注释。

**文档类型：** {{doc_type}}
**目标读者：** {{audience}}
**文档要求：** {{requirements}}

请提供：
1. 代码文档（函数/类/模块级别的注释）
2. 参数和返回值的说明
3. 使用示例（如适用）
4. 注意事项和限制
5. 任何相关的背景知识`,
    variables: [
      {
        id: 'doc_type',
        name: '文档类型',
        type: 'select',
        label: 'Documentation Type',
        options: ['API文档注释', '行内注释', 'README说明', '完整使用文档'],
        defaultValue: 'API文档注释',
        order: 1,
      },
      {
        id: 'audience',
        name: '目标读者',
        type: 'select',
        label: 'Target Audience',
        options: ['初学者', '中级开发者', '专家级开发者', '所有水平'],
        defaultValue: '中级开发者',
        order: 2,
      },
      {
        id: 'requirements',
        name: '文档要求',
        type: 'multiselect',
        label: 'Requirements',
        options: ['包含使用示例', '说明参数和返回值', '说明异常和错误', '包含复杂度分析', '提供相关链接'],
        defaultValue: ['包含使用示例', '说明参数和返回值'],
        order: 3,
      },
    ],
    tags: ['documentation', 'doc'],
    isBuiltin: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'builtin-optimize',
    name: '⚡ Optimize Performance',
    description: '优化代码性能',
    category: 'refactor',
    content: `请分析并优化当前代码的性能。

**优化目标：** {{optimization_goal}}
**优先级考虑：** {{priority}}

请提供：
1. 性能瓶颈分析
2. 具体的优化方案
3. 优化后的代码
4. 性能改进的预期效果
5. 可能的权衡和注意事项

优化时请考虑：
- 时间复杂度和空间复杂度
- 内存分配和GC压力
- I/O 和缓存效率
- 并发和并行机会`,
    variables: [
      {
        id: 'optimization_goal',
        name: '优化目标',
        type: 'select',
        label: 'Optimization Goal',
        options: ['提高执行速度', '减少内存使用', '降低延迟', '提高吞吐量', '减少资源消耗'],
        defaultValue: '提高执行速度',
        order: 1,
      },
      {
        id: 'priority',
        name: '优先级',
        type: 'multiselect',
        label: 'Priority Considerations',
        options: ['保持代码可读性', '最小化改动范围', '向后兼容', '可维护性优先', '极致性能优先'],
        defaultValue: ['保持代码可读性', '最小化改动范围'],
        order: 2,
      },
    ],
    tags: ['performance', 'optimize'],
    isBuiltin: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'builtin-security-review',
    name: '🔒 Security Review',
    description: '安全审查，发现潜在的安全漏洞',
    category: 'review',
    content: `请对当前代码进行安全审查。

**审查范围：** {{scope}}

请检查以下安全问题：
1. 输入验证和注入攻击（SQL注入、命令注入、XSS等）
2. 认证和授权问题
3. 敏感数据处理（加密、日志、传输）
4. 依赖项和供应链安全
5. 配置和密钥管理
6. 并发和竞态条件
7. 错误处理和信息泄露

请提供：
- 发现的安全问题（如有）
- 风险等级评估
- 修复建议
- 预防性安全建议`,
    variables: [
      {
        id: 'scope',
        name: '审查范围',
        type: 'multiselect',
        label: 'Review Scope',
        options: ['输入验证', '认证授权', '数据加密', '依赖安全', '配置安全', '日志安全', 'API安全', '业务逻辑安全'],
        defaultValue: ['输入验证', '数据加密', 'API安全'],
        order: 1,
      },
    ],
    tags: ['security', 'review'],
    isBuiltin: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'builtin-generate-code',
    name: '✨ Generate Code',
    description: '根据需求生成代码实现',
    category: 'code',
    content: `请根据以下需求生成代码实现。

**需求描述：** {{requirements}}

**技术约束：**
- 语言/框架：{{tech_stack}}
- 代码风格：{{code_style}}
- {{additional_constraints}}

请提供：
1. 完整的实现代码
2. 关键设计决策说明
3. 使用示例
4. 测试建议
5. 可能的扩展点`,
    variables: [
      {
        id: 'requirements',
        name: '需求描述',
        type: 'textarea',
        label: 'Requirements',
        placeholder: '详细描述需要实现的功能...',
        required: true,
        order: 1,
      },
      {
        id: 'tech_stack',
        name: '技术栈',
        type: 'text',
        label: 'Tech Stack',
        placeholder: '如：React + TypeScript, Rust, Go',
        order: 2,
      },
      {
        id: 'code_style',
        name: '代码风格',
        type: 'select',
        label: 'Code Style',
        options: ['简洁实用', '企业级/生产级', '教学/详细注释', '性能优先', '现代/ idiomatic'],
        defaultValue: '简洁实用',
        order: 3,
      },
      {
        id: 'additional_constraints',
        name: '额外约束',
        type: 'text',
        label: 'Additional Constraints',
        placeholder: '如：必须处理错误、需要线程安全',
        defaultValue: '考虑边界情况和错误处理',
        order: 4,
      },
    ],
    tags: ['generate', 'code'],
    isBuiltin: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

// 内置模板列表结束

/** 默认数据源 */
export const DEFAULT_DATA_SOURCES: DataSource[] = [
  {
    id: 'ds-programming-languages',
    name: 'Programming Languages',
    description: '常用编程语言列表',
    sourceType: 'static',
    items: [
      { value: 'rust', label: 'Rust' },
      { value: 'typescript', label: 'TypeScript' },
      { value: 'javascript', label: 'JavaScript' },
      { value: 'python', label: 'Python' },
      { value: 'go', label: 'Go' },
      { value: 'java', label: 'Java' },
      { value: 'cpp', label: 'C++' },
      { value: 'c', label: 'C' },
      { value: 'csharp', label: 'C#' },
      { value: 'ruby', label: 'Ruby' },
      { value: 'swift', label: 'Swift' },
      { value: 'kotlin', label: 'Kotlin' },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'ds-review-focus',
    name: 'Code Review Focus Areas',
    description: '代码审查关注重点',
    sourceType: 'static',
    items: [
      { value: 'security', label: '安全性' },
      { value: 'performance', label: '性能' },
      { value: 'readability', label: '可读性' },
      { value: 'maintainability', label: '可维护性' },
      { value: 'best-practices', label: '最佳实践' },
      { value: 'edge-cases', label: '边界情况' },
      { value: 'error-handling', label: '错误处理' },
      { value: 'naming', label: '命名规范' },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

/** 存储键名 */
export const STORAGE_KEYS = {
  TEMPLATES: 'promptEditor:templates:v1',
  DATA_SOURCES: 'promptEditor:dataSources:v1',
  TEMPLATE_SETTINGS: 'promptEditor:templateSettings:v1',
};

/** 生成唯一ID */
export function generateId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

/** 创建新模板 */
export function createTemplate(
  name: string,
  content: string,
  options: Partial<Omit<PromptTemplate, 'id' | 'name' | 'content' | 'createdAt' | 'updatedAt'>> = {}
): PromptTemplate {
  const now = Date.now();
  return {
    id: generateId(),
    name,
    content,
    variables: [],
    createdAt: now,
    updatedAt: now,
    ...options,
  };
}

/** 创建新数据源 */
export function createDataSource(
  name: string,
  items: DataSourceItem[],
  options: Partial<Omit<DataSource, 'id' | 'name' | 'items' | 'createdAt' | 'updatedAt'>> = {}
): DataSource {
  const now = Date.now();
  return {
    id: generateId(),
    name,
    sourceType: 'static',
    items,
    createdAt: now,
    updatedAt: now,
    ...options,
  };
}
