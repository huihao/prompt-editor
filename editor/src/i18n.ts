export type Locale = 'en' | 'zh';

const STORAGE_KEY = 'promptEditor:locale';

const translations: Record<string, string> = {
  'Prompt Editor': '提示编辑器',
  'History': '历史记录',
  'Close': '关闭',
  'Search prompts...': '搜索提示词...',
  'All': '全部',
  '★ Favorites': '★ 收藏',
  'Prompt Memory': '提示词记忆',
  'Templates': '模板',
  'Manage Templates': '管理模板',
  'Search templates...': '搜索模板...',
  'Prompt Snippets': '提示片段',
  'Prompt Snippet Manager': '提示片段管理器',
  'Scan Prompt Memory': '扫描提示词记忆',
  'Set Workspace (⌘⇧W)': '设置工作区 (⌘⇧W)',
  'History (⌘⇧H)': '历史记录 (⌘⇧H)',
  'Prompt Snippets (⌘⇧S) · Right-click to manage': '提示片段 (⌘⇧S) · 右键管理',
  'Templates (⌘⇧T)': '模板 (⌘⇧T)',
  'Template Edit Mode (⌘⇧M)': '模板编辑模式 (⌘⇧M)',
  'File References @ (⌘⇧F)': '文件引用 @ (⌘⇧F)',
  'AI Enhance Prompt (⌘⇧E)': 'AI 优化提示词 (⌘⇧E)',
  'Orchestrate Prompt': '编排提示词',
  'Prompt Workflows': '提示词编排方案',
  'AI Settings': 'AI 设置',
  'Settings': '设置',
  'General': '通用',
  'AI Provider': 'AI 供应商',
  'Save to History (⌘S)': '保存到历史记录 (⌘S)',
  'Copy to Clipboard (⌘⇧C)': '复制到剪贴板 (⌘⇧C)',
  'Clear Editor': '清空编辑器',
  'Paste to Last Position': '粘贴到上次位置',
  'No workspace selected': '未选择工作区',
  'Recent workspaces...': '最近的工作区...',
  'Browse for workspace': '浏览工作区',
  'Rescan workspace files': '重新扫描工作区文件',
  'Clear workspace': '清除工作区',
  'Image pasted': '图片已粘贴',
  'Template Mode': '模板模式',
  'Fill': '填充',
  'Exit': '退出',
  'Send Prompt?': '发送提示词？',
  'Press Enter to confirm, Escape to cancel': '按 Enter 确认，按 Escape 取消',
  'Send to:': '发送到：',
  'Include file contents inline': '内联包含文件内容',
  'Cancel': '取消',
  'Send (↵)': '发送 (↵)',
  'Open Security Settings': '打开安全设置',
  'Restart Prompt Editor': '重启提示编辑器',
  'Default Terminal': '默认终端',
  'Copy Only': '仅复制',
  'English': '英文',
  'Chinese': '中文',
  'Language': '语言',
  'No history yet': '暂无历史记录',
  'No templates found': '未找到模板',
  'Try a different search': '请尝试其他搜索词',
  'No directories found': '未找到目录',
  'Scanning directories...': '正在扫描目录...',
  'Add Directory': '添加目录',
  'Confirm Scan': '确认扫描',
  'Save to Favorites': '保存到收藏',
  'Scanning prompt entries...': '正在扫描提示词条目...',
  'No prompt entries yet': '暂无提示词条目',
  'All agents': '所有 Agent',
  'Built-in': '内置',
  'New Category': '新建分类',
  'New Snippet': '新建片段',
  'Search snippets...': '搜索片段...',
  'No categories yet': '暂无分类',
  'No results found': '未找到结果',
  'View logs': '查看日志',
  'Export snippets': '导出片段',
  'Import snippets': '导入片段',
  'Reset custom snippets': '重置自定义片段',
  'Edit Snippet': '编辑片段',
  'Edit Category': '编辑分类',
  'ID': '标识',
  'Name': '名称',
  'Description': '描述',
  'Category': '分类',
  'Content': '内容',
  'Icon': '图标',
  'Parent Category': '父分类',
  'Root level': '根级别',
  'Save Snippet': '保存片段',
  'Save Category': '保存分类',
  'Snippet saved.': '片段已保存。',
  'Category saved.': '分类已保存。',
  'Snippet content...': '片段内容...',
  'Snippet name': '片段名称',
  'Category name': '分类名称',
  'Brief description': '简短描述',
  'Unique identifier; it cannot be changed later': '唯一标识，之后无法修改',
  'ID is required.': '标识为必填项。',
  'Name is required.': '名称为必填项。',
  'Content is required.': '内容为必填项。',
  'Category is required.': '分类为必填项。',
  'Icon is required.': '图标为必填项。',
  'Unable to save. The ID may already exist.': '无法保存，标识可能已存在。',
  'Unable to save the snippet.': '无法保存片段。',
  'Unable to save the category.': '无法保存分类。',
  'Prompt entries': '提示词条目',
  'Detected': '已检测',
  'Custom': '自定义',
  'Found': '已找到',
  'Missing': '缺失',
  'Saved': '已保存',
  'Exists': '已存在',
  'Provider': '服务商',
  'Model': '模型',
  'API Key': 'API 密钥',
  'Base URL': '基础 URL',
  'Enable AI features': '启用 AI 功能',
  'Prompt writing': '提示词编写',
  'Prompt Writing': '提示词编写',
  'Prompt Enhance': '提示词优化',
  'AI Autocomplete': 'AI 自动补全',
  'Prompt Orchestration': '提示词编排',
  'Use default': '使用默认版本',
  'Reset to default': '恢复默认版本',
  'Prompt Enhance mode': '提示词优化模式',
  'AI Autocomplete mode': 'AI 自动补全模式',
  'Prompt Orchestration mode': '提示词编排模式',
  'Prompt Enhance prompt': '提示词优化提示词',
  'AI Autocomplete prompt': 'AI 自动补全提示词',
  'Prompt Orchestration prompt': '提示词编排提示词',
  'Test Connection': '测试连接',
  'Save': '保存',
  'Show/hide': '显示/隐藏',
};

let locale: Locale = 'en';
let observer: MutationObserver | null = null;
const originalText = new WeakMap<Text, string>();
const originalAttributes = new WeakMap<Element, Map<string, string>>();

export function getLocale(): Locale {
  return locale;
}

export function t(value: string): string {
  return locale === 'zh' ? translations[value] || value : value;
}

function readLocale(): Locale {
  return localStorage.getItem(STORAGE_KEY) === 'zh' ? 'zh' : 'en';
}

export function applyTranslations(root: ParentNode = document): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) nodes.push(node as Text);
  nodes.forEach(textNode => {
    if (!originalText.has(textNode)) originalText.set(textNode, textNode.nodeValue || '');
    const value = originalText.get(textNode) || '';
    if (locale === 'en') textNode.nodeValue = value;
    else textNode.nodeValue = value.replace(value.trim(), t(value.trim()));
  });

  const elements = root instanceof Element ? [root, ...Array.from(root.querySelectorAll('*'))] : Array.from(root.querySelectorAll('*'));
  elements.forEach(element => {
    for (const attribute of ['title', 'placeholder', 'aria-label']) {
      const value = element.getAttribute(attribute);
      if (value === null) continue;
      const values = originalAttributes.get(element) || new Map<string, string>();
      if (!values.has(attribute)) values.set(attribute, value);
      originalAttributes.set(element, values);
      element.setAttribute(attribute, locale === 'en' ? values.get(attribute)! : t(values.get(attribute)!));
    }
  });
}

export function setLocale(next: Locale): void {
  locale = next === 'zh' ? 'zh' : 'en';
  localStorage.setItem(STORAGE_KEY, locale);
  applyTranslations();
  window.dispatchEvent(new CustomEvent('prompt-editor:locale-change', { detail: locale }));
}

export function initI18n(): void {
  locale = readLocale();
  applyTranslations();
  observer?.disconnect();
  observer = new MutationObserver(records => {
    if (locale !== 'zh') return;
    records.forEach(record => record.addedNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) applyTranslations(node as Element);
    }));
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
