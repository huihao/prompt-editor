/**
 * 模板解析器
 * 
 * 负责解析模板内容，提取变量占位符
 * 支持语法：{{variable}} 或 {{variable:defaultValue}}
 */

import type { ParsedVariable, TemplateVariable, PromptTemplate } from './template-types';

/** 变量占位符正则表达式 */
const VARIABLE_REGEX = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)(?::([^}]*))?\s*\}\}/g;

/** 非法变量名（保留字） */
const RESERVED_NAMES = new Set(['this', 'if', 'else', 'each', 'with']);

/**
 * 从模板内容中提取所有变量占位符
 * @param content 模板内容
 * @returns 解析后的变量列表
 */
export function parseVariables(content: string): ParsedVariable[] {
  const variables: ParsedVariable[] = [];
  let match: RegExpExecArray | null;

  // 重置正则表达式状态
  VARIABLE_REGEX.lastIndex = 0;

  while ((match = VARIABLE_REGEX.exec(content)) !== null) {
    const [fullMatch, name, defaultValue] = match;
    
    // 跳过保留字
    if (RESERVED_NAMES.has(name)) {
      continue;
    }

    variables.push({
      name,
      fullMatch,
      defaultValue: defaultValue?.trim(),
      index: match.index,
    });
  }

  return variables;
}

/**
 * 获取模板内容中的唯一变量名列表（去重，保持顺序）
 * @param content 模板内容
 * @returns 唯一变量名列表
 */
export function extractUniqueVariableNames(content: string): string[] {
  const variables = parseVariables(content);
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const v of variables) {
    if (!seen.has(v.name)) {
      seen.add(v.name);
      unique.push(v.name);
    }
  }

  return unique;
}

/**
 * 解析单个变量的默认值
 * @param defaultValue 默认值字符串
 * @returns 解析后的值
 */
export function parseDefaultValue(defaultValue: string | undefined): string | string[] | undefined {
  if (!defaultValue) return undefined;

  // 尝试解析为数组（逗号分隔）
  if (defaultValue.includes(',')) {
    return defaultValue.split(',').map(s => s.trim()).filter(Boolean);
  }

  return defaultValue.trim();
}

/**
 * 从模板内容和现有变量定义生成完整的变量定义列表
 * 
 * 会自动发现新变量，保留已有变量的配置
 * 
 * @param content 模板内容
 * @param existingVars 现有的变量定义
 * @returns 合并后的变量定义列表
 */
export function syncVariables(
  content: string,
  existingVars: TemplateVariable[] = []
): TemplateVariable[] {
  const parsedVars = parseVariables(content);
  const existingMap = new Map(existingVars.map(v => [v.id, v]));
  const result: TemplateVariable[] = [];
  const seen = new Set<string>();
  let order = 1;

  for (const parsed of parsedVars) {
    // 跳过重复变量
    if (seen.has(parsed.name)) {
      continue;
    }
    seen.add(parsed.name);

    const existing = existingMap.get(parsed.name);
    
    if (existing) {
      // 保留现有配置，但更新默认值（如果模板中有指定）
      result.push({
        ...existing,
        defaultValue: parsed.defaultValue !== undefined
          ? parsed.defaultValue
          : existing.defaultValue,
        order: existing.order ?? order++,
      });
    } else {
      // 创建新变量定义
      result.push({
        id: parsed.name,
        name: formatVariableName(parsed.name),
        type: 'text',
        label: formatVariableName(parsed.name),
        defaultValue: parsed.defaultValue,
        required: false,
        order: order++,
      });
    }
  }

  // 按 order 排序
  return result.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/**
 * 格式化变量名为可读文本
 * @param name 变量名（如 "userName" 或 "user_name"）
 * @returns 格式化后的名称（如 "User Name"）
 */
export function formatVariableName(name: string): string {
  // 将驼峰命名或下划线命名转换为可读文本
  return name
    // 在大写字母前加空格（驼峰）
    .replace(/([A-Z])/g, ' $1')
    // 将下划线替换为空格
    .replace(/[_-]/g, ' ')
    //  trim 并首字母大写
    .trim()
    .replace(/^\w/, c => c.toUpperCase());
}

/**
 * 验证变量名是否合法
 * @param name 变量名
 * @returns 是否合法
 */
export function isValidVariableName(name: string): boolean {
  // 必须以字母或下划线开头，只能包含字母、数字、下划线
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    return false;
  }
  // 不能是保留字
  if (RESERVED_NAMES.has(name)) {
    return false;
  }
  return true;
}

/**
 * 验证模板内容中的变量是否都有定义
 * @param template 模板对象
 * @returns 验证结果
 */
export function validateTemplate(template: PromptTemplate): {
  valid: boolean;
  undefinedVars: string[];
  unusedVars: string[];
} {
  const contentVars = extractUniqueVariableNames(template.content);
  const definedVars = new Set(template.variables.map(v => v.id));

  const undefinedVars = contentVars.filter(v => !definedVars.has(v));
  const contentVarSet = new Set(contentVars);
  const unusedVars = template.variables
    .map(v => v.id)
    .filter(v => !contentVarSet.has(v));

  return {
    valid: undefinedVars.length === 0,
    undefinedVars,
    unusedVars,
  };
}

/**
 * 自动修复模板变量定义
 * 
 * - 为内容中的新变量添加定义
 * - 移除未使用的变量定义
 * 
 * @param template 模板对象
 * @returns 修复后的模板
 */
export function autoFixVariables(template: PromptTemplate): PromptTemplate {
  const syncedVars = syncVariables(template.content, template.variables);
  
  return {
    ...template,
    variables: syncedVars,
    updatedAt: Date.now(),
  };
}

/**
 * 检测模板中是否包含变量
 * @param content 模板内容
 * @returns 是否包含变量
 */
export function hasVariables(content: string): boolean {
  VARIABLE_REGEX.lastIndex = 0;
  return VARIABLE_REGEX.test(content);
}

/**
 * 获取模板中变量的统计信息
 * @param content 模板内容
 * @returns 统计信息
 */
export function getVariableStats(content: string): {
  total: number;
  unique: number;
  variables: string[];
} {
  const allVars = parseVariables(content);
  const uniqueVars = extractUniqueVariableNames(content);

  return {
    total: allVars.length,
    unique: uniqueVars.length,
    variables: uniqueVars,
  };
}

/**
 * 替换模板中的变量占位符（简单替换，不验证）
 * 
 * 注意：这是底层替换函数，通常应使用 template-renderer 中的 renderTemplate
 * 
 * @param content 模板内容
 * @param values 变量值映射
 * @returns 替换后的内容
 */
export function replaceVariables(
  content: string,
  values: Record<string, string>
): string {
  return content.replace(VARIABLE_REGEX, (match, varName) => {
    if (RESERVED_NAMES.has(varName)) {
      return match; // 保留保留字
    }
    return values[varName] ?? match; // 没有值则保留原样
  });
}

/**
 * 创建变量定义建议
 * 
 * 根据变量名智能推断类型和选项
 * 
 * @param varName 变量名
 * @returns 变量定义建议
 */
export function suggestVariableDefinition(varName: string): Partial<TemplateVariable> {
  const lowerName = varName.toLowerCase();

  // 常见变量名映射
  const suggestions: Record<string, Partial<TemplateVariable>> = {
    'language': {
      type: 'select',
      label: 'Programming Language',
      options: ['rust', 'typescript', 'javascript', 'python', 'go', 'java'],
    },
    'lang': {
      type: 'select',
      label: 'Language',
      options: ['rust', 'typescript', 'javascript', 'python', 'go', 'java'],
    },
    'code': {
      type: 'textarea',
      label: 'Code',
      required: true,
    },
    'description': {
      type: 'textarea',
      label: 'Description',
    },
    'detail': {
      type: 'select',
      label: 'Detail Level',
      options: ['简要', '标准', '详细'],
    },
    'style': {
      type: 'select',
      label: 'Style',
      options: ['严格', '温和', '中性'],
    },
    'type': {
      type: 'select',
      label: 'Type',
    },
    'level': {
      type: 'select',
      label: 'Level',
      options: ['low', 'medium', 'high'],
    },
    'priority': {
      type: 'select',
      label: 'Priority',
      options: ['low', 'medium', 'high', 'urgent'],
    },
    'count': {
      type: 'number',
      label: 'Count',
    },
    'num': {
      type: 'number',
      label: 'Number',
    },
    'tags': {
      type: 'multiselect',
      label: 'Tags',
    },
    'focus': {
      type: 'multiselect',
      label: 'Focus Areas',
    },
  };

  const suggestion = suggestions[lowerName];
  if (suggestion) {
    return {
      name: formatVariableName(varName),
      ...suggestion,
    };
  }

  // 根据命名约定推断
  if (lowerName.includes('list') || lowerName.endsWith('s')) {
    return {
      type: 'multiselect',
      label: formatVariableName(varName),
    };
  }

  if (lowerName.includes('description') || lowerName.includes('content') || lowerName.includes('text')) {
    return {
      type: 'textarea',
      label: formatVariableName(varName),
    };
  }

  // 默认文本
  return {
    type: 'text',
    label: formatVariableName(varName),
  };
}
