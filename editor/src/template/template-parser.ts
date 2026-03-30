/**
 * 模板解析器
 * 
 * 负责解析模板内容，提取变量占位符
 * 支持语法：{{variable}} 或 {{variable:type=default}} 或 {{variable:select=opt1,opt2#label}}
 * 
 * 语法规则：
 * - {{name}} - 基本文本变量
 * - {{name!}} - 必填变量
 * - {{name: textarea}} - 指定类型
 * - {{name: select=opt1,opt2}} - select类型带选项
 * - {{name: multiselect=opt1,opt2}} - 多选复选框组
 * - {{name: checkbox = true}} - 单个复选框
 * - {{name: radio=opt1,opt2}} - 单选按钮组
 * - {{name = defaultValue}} - 带默认值
 * - {{name#label}} - 自定义标签
 * - {{name! :select=opt1,opt2 = default #Label}} - 完整形式
 */

import type { ParsedVariable, TemplateVariable, PromptTemplate } from './template-types';

/** 变量占位符正则表达式 - 匹配 {{...}} 内容 */
const VARIABLE_REGEX = /\{\{\s*([^}]+)\s*\}\}/g;

/** 非法变量名（保留字） */
const RESERVED_NAMES = new Set(['this', 'if', 'else', 'each', 'with']);

/** 有效的变量类型 */
const VALID_TYPES = new Set(['text', 'textarea', 'select', 'multiselect', 'number', 'checkbox', 'radio']);

/**
 * 解析单个占位符字符串
 * 格式：name[!][:type][=default][#label]
 * 特殊格式：name[!][:type=opt1,opt2][=default][#label] - 类型带选项
 */
function parsePlaceholder(content: string): {
  name: string;
  required: boolean;
  type: string;
  defaultValue?: string | string[];
  label?: string;
  options?: string[];
} | null {
  // 移除空白
  content = content.trim();
  
  // 解析必填标记 (!)
  const required = content.endsWith('!');
  if (required) {
    content = content.slice(0, -1).trim();
  }
  
  // 解析标签 (#label)
  let label: string | undefined;
  const hashIndex = content.lastIndexOf('#');
  if (hashIndex > 0) {
    label = content.slice(hashIndex + 1).trim();
    content = content.slice(0, hashIndex).trim();
  }
  
  // 解析名称和类型 (name:type)
  let name: string;
  let type = 'text';
  let options: string[] | undefined;
  
  const colonIndex = content.indexOf(':');
  if (colonIndex > 0) {
    name = content.slice(0, colonIndex).trim();
    let typePart = content.slice(colonIndex + 1).trim();
    
    // 类型可能包含选项 (select=opt1,opt2)
    const typeEqualIndex = typePart.indexOf('=');
    if (typeEqualIndex > 0) {
      const possibleType = typePart.slice(0, typeEqualIndex).trim();
      // 检查是否是带选项的有效类型
      if (['select', 'multiselect', 'radio'].includes(possibleType)) {
        type = possibleType;
        const optionsStr = typePart.slice(typeEqualIndex + 1).trim();
        options = optionsStr.split(',').map(s => s.trim()).filter(Boolean);
        // 剩余部分不再有默认值，已经处理完毕
        
        // 验证变量名
        if (!isValidVariableName(name)) {
          return null;
        }
        
        // 使用第一个选项作为默认值
        const defaultValue = type === 'multiselect' && options.length > 0 
          ? [options[0]] 
          : (options.length > 0 ? options[0] : undefined);
        
        return { name, required, type, defaultValue, label, options };
      }
    }
    
    // 没有选项的类型（如 checkbox=true, number=5）
    const defaultEqualIndex = typePart.indexOf('=');
    if (defaultEqualIndex > 0) {
      type = typePart.slice(0, defaultEqualIndex).trim();
      const defaultStr = typePart.slice(defaultEqualIndex + 1).trim();
      // 作为默认值处理
      content = name + '=' + defaultStr;
    } else {
      type = typePart;
      content = name; // 重置 content 为名称，用于后续默认值解析
    }
  } else {
    name = content.trim();
  }
  
  // 解析默认值 (=default) - 仅在类型不包含选项时处理
  let defaultValue: string | string[] | undefined;
  const equalIndex = content.indexOf('=');
  if (equalIndex > 0) {
    const defaultStr = content.slice(equalIndex + 1).trim();
    // 检查是否包含逗号（可能是数组）
    if (defaultStr.includes(',')) {
      defaultValue = defaultStr.split(',').map(s => s.trim()).filter(Boolean);
    } else {
      defaultValue = defaultStr;
    }
  }
  
  // 验证类型
  if (!VALID_TYPES.has(type)) {
    type = 'text';
  }
  
  // 验证变量名
  if (!isValidVariableName(name)) {
    return null;
  }
  
  return { name, required, type, defaultValue, label, options };
}

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
    const [fullMatch, innerContent] = match;
    
    const parsed = parsePlaceholder(innerContent);
    if (!parsed) continue;
    
    // 跳过保留字
    if (RESERVED_NAMES.has(parsed.name)) {
      continue;
    }

    variables.push({
      name: parsed.name,
      fullMatch,
      index: match.index,
    });
  }

  return variables;
}

/**
 * 从模板内容中提取完整的变量定义
 * @param content 模板内容
 * @returns 变量定义列表
 */
export function extractVariableDefinitions(content: string): TemplateVariable[] {
  const definitions: TemplateVariable[] = [];
  const seen = new Set<string>();
  let order = 1;
  
  // 重置正则状态
  VARIABLE_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = VARIABLE_REGEX.exec(content)) !== null) {
    const [fullMatch, innerContent] = match;
    
    const parsed = parsePlaceholder(innerContent);
    if (!parsed) continue;
    
    // 跳过保留字和重复变量
    if (RESERVED_NAMES.has(parsed.name) || seen.has(parsed.name)) {
      continue;
    }
    seen.add(parsed.name);

    definitions.push({
      id: parsed.name,
      name: parsed.label || formatVariableName(parsed.name),
      type: parsed.type as any,
      label: parsed.label || formatVariableName(parsed.name),
      defaultValue: parsed.defaultValue,
      required: parsed.required,
      options: parsed.options,
      order: order++,
    });
  }

  return definitions;
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
 * 现在完全从模板内容解析，existingVars 仅用于兼容旧模板
 * 
 * @param content 模板内容
 * @param existingVars 现有的变量定义（已弃用，保留参数用于兼容）
 * @returns 合并后的变量定义列表
 */
export function syncVariables(
  content: string,
  existingVars: TemplateVariable[] = []
): TemplateVariable[] {
  // 优先从内容解析
  const parsedDefs = extractVariableDefinitions(content);
  
  if (parsedDefs.length > 0) {
    return parsedDefs;
  }
  
  // 兼容旧模板：如果内容中没有新语法，尝试从现有变量和简单占位符合并
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
      // 保留现有配置
      result.push({
        ...existing,
        order: existing.order ?? order++,
      });
    } else {
      // 创建新变量定义
      result.push({
        id: parsed.name,
        name: formatVariableName(parsed.name),
        type: 'text',
        label: formatVariableName(parsed.name),
        required: false,
        order: order++,
      });
    }
  }

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
    // trim 并首字母大写
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
 * 现在总是返回 valid=true，因为变量定义从内容自动解析
 * @param template 模板对象
 * @returns 验证结果
 */
export function validateTemplate(template: PromptTemplate): {
  valid: boolean;
  undefinedVars: string[];
  unusedVars: string[];
} {
  // 重新从内容解析变量
  const contentVars = extractVariableDefinitions(template.content);
  const contentVarIds = new Set(contentVars.map(v => v.id));
  const definedVars = new Set(template.variables.map(v => v.id));

  // 找出仅在内容中但不在变量列表中的变量
  const undefinedVars = contentVars.filter(v => !definedVars.has(v.id)).map(v => v.id);
  
  // 找出仅在变量列表但不在内容中的变量
  const unusedVars = template.variables
    .map(v => v.id)
    .filter(id => !contentVarIds.has(id));

  return {
    valid: undefinedVars.length === 0,
    undefinedVars,
    unusedVars,
  };
}

/**
 * 自动修复模板变量定义
 * 
 * 完全从模板内容重新解析变量定义
 * 
 * @param template 模板对象
 * @returns 修复后的模板
 */
export function autoFixVariables(template: PromptTemplate): PromptTemplate {
  const syncedVars = syncVariables(template.content, []);
  
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
  return content.replace(VARIABLE_REGEX, (match) => {
    const innerMatch = match.match(/\{\{\s*([^}]+)\s*\}\}/);
    if (!innerMatch) return match;
    
    const parsed = parsePlaceholder(innerMatch[1]);
    if (!parsed || RESERVED_NAMES.has(parsed.name)) {
      return match;
    }
    
    return values[parsed.name] ?? match;
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
    'enable': {
      type: 'checkbox',
      label: 'Enable',
    },
    'enabled': {
      type: 'checkbox',
      label: 'Enabled',
    },
    'confirm': {
      type: 'checkbox',
      label: 'Confirm',
    },
    'include': {
      type: 'checkbox',
      label: 'Include',
    },
    'choice': {
      type: 'radio',
      label: 'Choice',
    },
    'mode': {
      type: 'radio',
      label: 'Mode',
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

/**
 * 将变量定义转换为占位符语法
 * @param variable 变量定义
 * @returns 占位符字符串（不含 {{}}）
 */
export function variableToPlaceholder(variable: TemplateVariable): string {
  let result = variable.id;
  
  // 必填标记
  if (variable.required) {
    result += '!';
  }
  
  // 类型
  if (variable.type !== 'text' || variable.options) {
    result += ':' + variable.type;
    if (variable.options && variable.options.length > 0) {
      result += '=' + variable.options.join(',');
    }
  }
  
  // 默认值
  if (variable.defaultValue !== undefined) {
    const defaultStr = Array.isArray(variable.defaultValue) 
      ? variable.defaultValue.join(',')
      : String(variable.defaultValue);
    if (defaultStr) {
      result += '=' + defaultStr;
    }
  }
  
  // 标签
  if (variable.label && variable.label !== formatVariableName(variable.id)) {
    result += '#' + variable.label;
  }
  
  return result;
}
