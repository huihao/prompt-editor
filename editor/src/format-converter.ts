/**
 * Format Converter - Phase 3
 * 将文件引用转换为不同 Code Agent 支持的格式
 */

import { fileReferenceManager, FileReference } from './file-reference';
import { workspaceManager } from './workspace-manager';

export type AgentFormat = 'claude' | 'codex' | 'kimi' | 'cursor' | 'vscode' | 'plain' | 'default';

export interface FormatOptions {
  format: AgentFormat;
  includeContent?: boolean;      // 是否内联文件内容
  maxFileSize?: number;          // 最大内联文件大小（字节）
  maxTotalSize?: number;         // 所有内联内容的总大小限制
  wrapInXml?: boolean;           // 是否使用 XML 标签包裹（Claude 风格）
  useMarkdownCodeBlock?: boolean; // 使用 Markdown 代码块
}

// 默认配置
export const DEFAULT_FORMAT_OPTIONS: FormatOptions = {
  format: 'default',
  includeContent: false,
  maxFileSize: 50 * 1024,     // 50KB
  maxTotalSize: 500 * 1024,   // 500KB
  wrapInXml: true,
  useMarkdownCodeBlock: true,
};

// Agent 格式配置
interface AgentConfig {
  id: AgentFormat;
  name: string;
  supportsAtReference: boolean;  // 是否支持 @ 引用
  defaultIncludeContent: boolean;
  description: string;
}

const AGENT_CONFIGS: AgentConfig[] = [
  {
    id: 'claude',
    name: 'Claude Code',
    supportsAtReference: true,
    defaultIncludeContent: false,
    description: 'Claude CLI (claude)',
  },
  {
    id: 'codex',
    name: 'Codex CLI',
    supportsAtReference: true,
    defaultIncludeContent: false,
    description: 'OpenAI Codex CLI',
  },
  {
    id: 'kimi',
    name: 'Kimi CLI',
    supportsAtReference: true,
    defaultIncludeContent: false,
    description: 'Kimi Code CLI',
  },
  {
    id: 'cursor',
    name: 'Cursor',
    supportsAtReference: true,
    defaultIncludeContent: false,
    description: 'Cursor Editor',
  },
  {
    id: 'vscode',
    name: 'VSCode Copilot',
    supportsAtReference: true,
    defaultIncludeContent: false,
    description: 'VSCode with GitHub Copilot',
  },
  {
    id: 'plain',
    name: 'Plain Text',
    supportsAtReference: false,
    defaultIncludeContent: true,
    description: 'No @ references, inline content only',
  },
  {
    id: 'default',
    name: 'Default Terminal',
    supportsAtReference: true,
    defaultIncludeContent: false,
    description: 'Keep @ references as-is',
  },
];

export class FormatConverter {
  private options: FormatOptions;

  constructor(options: Partial<FormatOptions> = {}) {
    this.options = { ...DEFAULT_FORMAT_OPTIONS, ...options };
  }

  /**
   * 获取 Agent 配置
   */
  getAgentConfig(format: AgentFormat): AgentConfig | undefined {
    return AGENT_CONFIGS.find(a => a.id === format);
  }

  /**
   * 获取所有支持的 Agent 格式
   */
  getAllAgentConfigs(): AgentConfig[] {
    return AGENT_CONFIGS;
  }

  /**
   * 转换内容为指定 Agent 格式
   */
  async convert(content: string, format?: AgentFormat): Promise<string> {
    const targetFormat = format || this.options.format;
    const config = this.getAgentConfig(targetFormat);
    
    if (!config) {
      console.warn(`Unknown format: ${targetFormat}, using default`);
      return content;
    }

    // 解析所有文件引用
    const refs = fileReferenceManager.parseFileReferences(content);
    
    if (refs.length === 0) {
      // 没有文件引用，直接返回
      return content;
    }

    // 根据配置决定是否内联内容
    const shouldInline = this.options.includeContent ?? 
                        config.defaultIncludeContent ?? 
                        !config.supportsAtReference;

    if (!shouldInline && config.supportsAtReference) {
      // 只转换引用格式，不内联内容
      return this.convertReferencesOnly(content, refs, targetFormat);
    }

    // 内联文件内容
    return this.inlineFileContent(content, refs, targetFormat);
  }

  /**
   * 仅转换引用格式（不内联内容）
   */
  private convertReferencesOnly(
    content: string,
    refs: Array<{ match: string; path: string; file?: FileReference }>,
    format: AgentFormat
  ): string {
    let result = content;
    
    // 按路径长度降序排序，避免替换时冲突
    const sortedRefs = [...refs].sort((a, b) => b.path.length - a.path.length);

    for (const ref of sortedRefs) {
      const replacement = this.formatReference(ref.path, ref.file, format, false);
      result = result.replace(new RegExp(this.escapeRegExp(ref.match), 'g'), replacement);
    }

    return result;
  }

  /**
   * 内联文件内容
   */
  private async inlineFileContent(
    content: string,
    refs: Array<{ match: string; path: string; file?: FileReference }>,
    format: AgentFormat
  ): Promise<string> {
    let result = content;
    let totalSize = 0;
    const maxTotal = this.options.maxTotalSize || DEFAULT_FORMAT_OPTIONS.maxTotalSize!;

    // 按路径长度降序排序
    const sortedRefs = [...refs].sort((a, b) => b.path.length - a.path.length);

    for (const ref of sortedRefs) {
      const file = ref.file;
      if (!file) {
        // 文件不存在，保留原样或标记为无效
        continue;
      }

      // 检查总大小限制
      if (totalSize >= maxTotal) {
        // 已达到总大小限制，用占位符替换
        const placeholder = this.formatReference(ref.path, file, format, false);
        result = result.replace(new RegExp(this.escapeRegExp(ref.match), 'g'), placeholder);
        continue;
      }

      // 读取文件内容
      try {
        const fileContent = await this.readFileContent(file.path);
        const fileSize = new TextEncoder().encode(fileContent).length;

        // 检查单个文件大小
        const maxFile = this.options.maxFileSize || DEFAULT_FORMAT_OPTIONS.maxFileSize!;
        let contentToInline: string;

        if (fileSize > maxFile) {
          // 文件太大，截断
          const truncated = fileContent.substring(0, maxFile);
          contentToInline = truncated + '\n... (truncated, file too large)';
        } else {
          contentToInline = fileContent;
        }

        // 检查总大小
        const inlineSize = new TextEncoder().encode(contentToInline).length;
        if (totalSize + inlineSize > maxTotal) {
          // 超过总限制，用占位符
          const placeholder = this.formatReference(ref.path, file, format, false);
          result = result.replace(new RegExp(this.escapeRegExp(ref.match), 'g'), placeholder);
          continue;
        }

        totalSize += inlineSize;

        // 格式化内联内容
        const inlined = this.formatInlinedContent(file, contentToInline, format);
        result = result.replace(new RegExp(this.escapeRegExp(ref.match), 'g'), inlined);

      } catch (e) {
        console.error(`Failed to read file ${file.path}:`, e);
        // 读取失败，保留原样
        const placeholder = this.formatReference(ref.path, file, format, false);
        result = result.replace(new RegExp(this.escapeRegExp(ref.match), 'g'), placeholder);
      }
    }

    return result;
  }

  /**
   * 检测当前平台
   */
  private getPlatform(): 'macos' | 'linux' | 'windows' | 'unknown' {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('win')) return 'windows';
    if (userAgent.includes('mac')) return 'macos';
    if (userAgent.includes('linux')) return 'linux';
    return 'unknown';
  }

  /**
   * 将路径转换为当前平台的格式
   */
  private toPlatformPath(absolutePath: string): string {
    const platform = this.getPlatform();
    
    // 标准化路径分隔符
    const normalizedPath = absolutePath.replace(/\\/g, '/');
    
    switch (platform) {
      case 'windows':
        // Windows: 使用反斜杠，但如果路径已经是 Unix 格式（如 WSL/Git Bash）则保持
        // 检查是否是 Windows 绝对路径 (如 C:/path)
        if (/^[a-zA-Z]:\//.test(normalizedPath)) {
          // 已经是 Windows 风格的绝对路径，转换反斜杠
          return normalizedPath.replace(/\//g, '\\');
        }
        // 对于 WSL 或 Git Bash 路径，保持 Unix 格式
        return normalizedPath;
      case 'macos':
      case 'linux':
      default:
        // macOS/Linux: 使用正斜杠
        return normalizedPath;
    }
  }

  /**
   * 获取绝对路径（用于复制到 CLI）
   */
  private getAbsolutePath(file: FileReference | undefined, relativePath: string): string {
    if (!file) {
      // 文件不在缓存中，尝试通过工作空间解析
      return workspaceManager.getAbsolutePath(relativePath);
    }
    
    // 使用文件的绝对路径
    return file.path;
  }

  /**
   * 格式化单个文件引用（不包含内容）
   */
  private formatReference(
    path: string,
    file: FileReference | undefined,
    format: AgentFormat,
    withContent: boolean
  ): string {
    // 获取绝对路径并转换为当前平台格式
    const absolutePath = this.getAbsolutePath(file, path);
    const platformPath = this.toPlatformPath(absolutePath);
    
    // 同时保留相对路径用于显示
    const displayPath = file?.relativePath || path;

    switch (format) {
      case 'vscode':
        // VSCode Copilot 支持 @filename 和 #file:path 两种格式
        // 简单文件名用 @，复杂路径用 #file:
        if (displayPath.includes('/') || displayPath.includes('\\')) {
          return `#file:${platformPath}`;
        }
        return `@${platformPath}`;
      case 'plain':
        return platformPath;
      case 'claude':
      case 'codex':
      case 'kimi':
      case 'cursor':
      default:
        return `@${platformPath}`;
    }
  }

  /**
   * 格式化内联的文件内容
   */
  private formatInlinedContent(
    file: FileReference,
    content: string,
    format: AgentFormat
  ): string {
    // 使用绝对路径以便 CLI 识别
    const path = this.toPlatformPath(file.path);
    const ext = file.relativePath.split('.').pop() || '';

    switch (format) {
      case 'claude':
        if (this.options.wrapInXml) {
          return `\n<file path="${path}">\n${content}\n</file>\n`;
        }
        return `\n--- File: ${path} ---\n${content}\n--- End ---\n`;

      case 'codex':
      case 'kimi':
        return `\n\n=== ${path} ===\n\`\`\`${ext}\n${content}\n\`\`\`\n`;

      case 'cursor':
        return `\n\n[File: ${path}]\n\`\`\`${ext}\n${content}\n\`\`\`\n`;

      case 'vscode':
        return `\n\n<!-- File: ${path} -->\n\`\`\`${ext}\n${content}\n\`\`\`\n`;

      case 'plain':
      default:
        if (this.options.useMarkdownCodeBlock) {
          return `\n\n[File: ${path}]\n\`\`\`${ext}\n${content}\n\`\`\`\n`;
        }
        return `\n\n--- ${path} ---\n${content}\n---\n`;
    }
  }

  /**
   * 读取文件内容
   */
  private async readFileContent(path: string): Promise<string> {
    // 首先尝试使用 bridge 读取（原生支持）
    const bridge = (window as any).promptEditorBridge;
    if (bridge?.readFile) {
      const content = await bridge.readFile(path);
      if (content !== null) {
        return content;
      }
    }

    // 如果 Web 有 File System Access API，可以尝试使用
    // 但在大多数情况下，我们依赖原生桥接
    throw new Error('File reading not available');
  }

  /**
   * 转义正则表达式特殊字符
   */
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 更新选项
   */
  setOptions(options: Partial<FormatOptions>) {
    this.options = { ...this.options, ...options };
  }

  /**
   * 获取当前选项
   */
  getOptions(): FormatOptions {
    return { ...this.options };
  }
}

// 导出单例
export const formatConverter = new FormatConverter();

// 根据 Agent 获取推荐选项
export function getRecommendedOptions(format: AgentFormat): Partial<FormatOptions> {
  switch (format) {
    case 'claude':
      return {
        includeContent: false,
        wrapInXml: true,
      };
    case 'codex':
    case 'kimi':
      return {
        includeContent: false,
        useMarkdownCodeBlock: true,
      };
    case 'plain':
      return {
        includeContent: true,
        useMarkdownCodeBlock: true,
      };
    default:
      return {
        includeContent: false,
      };
  }
}

// 预览转换结果（不读取文件内容）
export function previewConversion(content: string, format: AgentFormat): string {
  const refs = fileReferenceManager.parseFileReferences(content);
  if (refs.length === 0) {
    return content;
  }

  const config = AGENT_CONFIGS.find(a => a.id === format);
  if (!config || config.supportsAtReference) {
    // 支持 @ 引用的 Agent，预览保持不变
    return content;
  }

  // 不支持 @ 引用的 Agent，显示提示
  return `${content}\n\n[Note: This agent doesn't support @ references. Files will be inlined when sending.]`;
}
