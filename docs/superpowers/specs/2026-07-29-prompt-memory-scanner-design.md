# 本机提示词扫描与收藏设计

## 目标

在 macOS 版 Prompt Editor 中新增“扫描提示词”功能。用户可以选择本机 Coding Agent 的历史目录，提取其中由用户输入的自然语言提示词和 shell 命令，在列表中筛选、预览并批量保存到现有历史收藏。

首版支持 Claude Code、Codex、OpenCode、Pi 和 Kimi。扫描、解析和去重全部在本机完成，不发送网络请求，也不修改 Agent 的原始文件。

## 已确认的产品决策

- 保存目标是现有历史记录，导入时自动标记为收藏。
- 自动检测常见默认目录，同时允许添加自定义目录。
- 自定义目录必须指定对应的 Agent 类型，不做模糊格式猜测。
- 自动检测到的目录默认全部勾选。
- 保留自然语言提示词和 shell 命令，过滤 Agent 控制命令。
- 按规范化后的完整内容去重，保留最新时间并汇总来源。
- 扫描结果中的输入条目默认不勾选，避免意外批量收藏。
- 取消历史记录 100 条的应用级数量上限。
- 首版只实现 macOS 原生扫描，Windows 和 Linux 不在本次范围内。

## 非目标

- 不读取或展示模型回复、工具调用结果、系统提示词、认证信息或配置内容。
- 不建立后台持续监听或自动导入；每次扫描都由用户主动触发。
- 不修改、整理或删除任何 Agent 历史文件。
- 不为未知 Agent 提供通用递归文本扫描。
- 不在首版实现跨设备同步、云端备份或语义分类。

## 用户流程

1. 用户点击工具栏中历史按钮旁的“扫描提示词”图标按钮。
2. 弹窗进入目录选择阶段，调用原生层检测默认目录并默认全选存在的目录。
3. 用户可以取消目录、添加自定义目录，或移除之前添加的自定义目录。
4. 添加自定义目录时，用户必须选择 Claude Code、Codex、OpenCode、Pi 或 Kimi 类型。
5. 用户点击“确认扫描”，原生层在后台扫描选中的目录，并逐目录上报进度。
6. 前端分批接收条目，过滤和去重后的结果按时间倒序显示。
7. 用户通过关键词、Agent 来源筛选结果，展开预览并勾选需要的条目。
8. 用户点击“保存到收藏”，所选条目批量写入历史并设为收藏。
9. 已存在的内容不重复写入，列表即时更新为“已存在”或“已收藏”。

关闭弹窗后丢弃扫描结果。目录选择持久化到本机，下一次打开时恢复；历史文件不会被自动重新扫描。

## 界面设计

### 工具栏入口

新增一个固定尺寸的图标按钮，沿用现有工具栏按钮视觉状态，放在历史记录按钮旁。按钮提供 `title`/tooltip 和无障碍标签“扫描提示词”，不使用文字胶囊按钮。

### 目录选择阶段

弹窗按 Agent 分组展示目录。每一行包含：

- 勾选框
- Agent 名称
- 目录路径
- 自动检测或自定义标记
- 存在状态
- 最近更新时间（可获得时）
- 自定义目录的移除按钮

底部提供“添加目录”“取消”“确认扫描”。系统检测项不可删除，只能取消勾选。没有检测到任何目录时，仍允许添加自定义目录。

### 扫描阶段

点击确认后保留同一弹窗，目录列表变为进度列表。每个目录独立显示等待、扫描中、完成、跳过、失败或已取消，以及已读取文件数、已提取条数和已跳过条数。扫描期间提供取消按钮。

### 结果阶段

结果区域包含：

- 关键词搜索框
- Agent 来源筛选菜单
- 全选和取消全选命令
- 结果总数和当前筛选数
- 固定高度、可滚动的结果列表
- 已选数量和“保存到收藏”按钮

每项显示复选框、正文预览、来源 Agent、项目目录和时间。点击正文区域展开完整内容，点击复选框只改变选择状态。已存在条目禁用复选框并显示状态。保存完成后弹窗保持打开，已保存条目即时更新。

## 架构

### 原生层

新增以下职责边界：

- `PromptMemoryModels.swift`：Agent 类型、目录描述、扫描进度、扫描条目和错误模型。
- `PromptMemoryScanner.swift`：目录发现、扫描任务调度、取消、结果合并、过滤和去重。
- `PromptMemoryParser.swift`：解析器协议，定义支持的 Agent、候选文件和异步条目流。
- `PromptMemoryParsers/ClaudeCodeParser.swift`
- `PromptMemoryParsers/CodexParser.swift`
- `PromptMemoryParsers/OpenCodeParser.swift`
- `PromptMemoryParsers/PiParser.swift`
- `PromptMemoryParsers/KimiParser.swift`

`MainWindow.swift` 只注册桥接动作和转发结构化消息，不包含文件格式解析代码。

### 前端

新增以下模块：

- `prompt-memory.ts`：桥接协议、扫描会话状态和前端数据模型。
- `prompt-memory-ui.ts`：弹窗生命周期、目录选择、筛选、展开、选择和批量收藏。
- `history-store.ts`：历史读取、迁移、内容查重和批量写入。

`editor/index.html` 只增加工具栏入口、弹窗挂载点和与现有主题一致的样式。现有 `bridge.ts` 通过 `HistoryStore` 使用历史数据，不再直接维护数量截断逻辑。

## 默认目录与解析策略

### Claude Code

- 默认根目录：`~/.claude`
- 主要数据：`projects/**/*.jsonl`
- 只接受明确标记为用户消息的记录。
- 从 `message.content` 提取字符串或文本块；忽略附件事件、工具结果和助手消息。
- 使用记录时间；项目目录优先使用 `cwd`，否则使用项目目录编码推断结果。

### Codex

- 默认根目录：`~/.codex`
- 首选数据：`history.jsonl`，字段为 `session_id`、`ts`、`text`。
- 兼容数据：`sessions/**/*.jsonl` 中 `payload.role == "user"` 的文本内容。
- 同一内容若同时存在于两个来源，由统一去重阶段合并。
- 过滤 Codex 自动注入的环境、权限、技能和协作模式上下文块。

### OpenCode

- 配置目录：`~/.config/opencode`
- 历史目录：`~/.local/state/opencode` 与 `~/.local/share/opencode`
- 首选数据：`~/.local/state/opencode/prompt-history.jsonl` 的 `input` 字段。
- 如果轻量历史文件不存在，回退到只读打开 `opencode.db`，优先查询 `session_input.prompt/time_created`，并连接 `session.directory` 获取项目目录。
- 数据库必须以只读方式打开；表或字段不匹配时跳过回退，不尝试遍历 `message`、`part` 或工具输出表。

### Pi

- 默认根目录：`~/.pi/agent`
- 主要数据：`sessions/**/*.jsonl`
- 只接受 `message.role == "user"` 的文本块。
- 时间优先使用消息时间，否则使用记录时间；项目目录来自会话头部的 `cwd`。

### Kimi

- 默认根目录：`~/.kimi`
- 首选数据：`user-history/*.jsonl` 的 `content` 字段。
- 如果记录不含时间，使用文件修改时间作为回退时间。
- 不扫描 `logs`、`plans`、`wire.jsonl`、`context*.jsonl` 或子 Agent 数据。

## 数据模型

```swift
enum PromptMemoryAgent: String, Codable {
    case claudeCode, codex, openCode, pi, kimi
}

struct PromptMemoryDirectory: Codable, Identifiable {
    let id: String
    let agent: PromptMemoryAgent
    let path: String
    let isDetected: Bool
    let exists: Bool
    let modifiedAt: Date?
}

struct PromptMemoryItem: Codable, Identifiable {
    let id: String
    let content: String
    let timestamp: Date?
    let agents: [PromptMemoryAgent]
    let sourceDirectories: [String]
    let projectDirectory: String?
}
```

`id` 由规范化内容的稳定摘要生成，不使用原文件中的会话 ID。桥接返回 ISO 8601 时间字符串；无法确定时间的条目排在有时间条目之后。

## 提取、过滤与去重

### 内容规范化

1. 将 CRLF 和 CR 统一为 LF。
2. 去除正文首尾空白。
3. 保留正文内部空格、缩进和换行。
4. 空内容直接丢弃。

### 控制命令过滤

每个解析器维护自己的已知控制命令集合，例如 `/help`、`/clear`、`/compact`、`/exit`。只有整条输入匹配“已知命令 + 可选参数”时才过滤，不能因为内容以 `/` 开头就过滤，以免误删文件路径或自然语言内容。

以 `!` 开头或解析器明确标记为 shell 输入的内容保留。普通文本中的代码块和命令行保持原样。

### 自动上下文过滤

过滤由宿主自动注入、不是用户主动输入的完整上下文记录，包括已知的环境、权限、技能、协作模式和系统提醒包裹块。只在整条记录符合已知结构时过滤，不从用户正文中删除局部 XML/Markdown 内容。

### 去重

以规范化后的完整内容计算摘要并分组：

- 时间取所有重复记录中的最新值。
- `agents` 和 `sourceDirectories` 去重后汇总。
- 项目目录优先取最新记录的非空值。
- 最终按时间倒序排列；无时间条目按稳定摘要排序。

## 历史存储迁移

现有历史通过 `localStorage` 保存，并在写入时截断为 100 条。批量导入后该机制存在容量和数据丢失风险，因此引入 `HistoryStore`：

- 使用 IndexedDB 保存历史条目，不设置应用级条数上限。
- 启动时一次性读取 `promptEditor:history`，在单个事务中写入 IndexedDB。
- 迁移成功后记录迁移版本，再删除旧键；迁移失败时保留旧键并继续从旧数据读取。
- 初始化后在内存维护按 ID 和内容摘要的索引，支持现有同步渲染和快速查重。
- 批量收藏使用单个事务：全部成功后更新内存索引；失败则事务回滚，不出现部分导入。
- 旧历史 ID、名称、时间和收藏状态保持不变。

IndexedDB 仍受系统可用磁盘和 WebKit 配额约束，但产品不再施加固定记录数量限制。写入失败时显示明确错误，不删除任何已有记录。

## 原生桥接协议

前端向 `promptEditor` message handler 发送：

- `detectPromptMemoryDirectories`
- `choosePromptMemoryDirectory`
- `startPromptMemoryScan`
- `cancelPromptMemoryScan`

每次扫描生成唯一 `scanId`。原生层向前端回调：

- `onPromptMemoryDirectories`
- `onPromptMemoryScanProgress`
- `onPromptMemoryScanBatch`
- `onPromptMemoryScanCompleted`
- `onPromptMemoryScanFailed`

结果按批次发送，每批最多 100 条。所有回调都携带 `scanId`，前端忽略已取消或已关闭弹窗对应的迟到消息。路径和正文通过 JSON 序列化传递，不拼接进 JavaScript 字符串。

## 并发、性能与取消

- 文件枚举和解析在 utility 优先级后台任务中执行。
- 不跟随符号链接，防止循环和越界扫描。
- 只读取解析器声明的文件名、扩展名和数据库表。
- JSONL 按行流式读取，不能一次将大文件全部加载进内存。
- 目录之间允许有限并发，单个文件顺序读取，避免磁盘争用。
- 每处理一批记录检查取消状态。
- 单行损坏只增加跳过计数；单文件不可读只标记该文件失败；其他目录继续扫描。
- OpenCode 数据库使用只读查询和分页，不复制或修改数据库及 WAL 文件。

## 隐私与安全

- 扫描只在用户点击确认后开始。
- 目录选择明确展示将被读取的路径和 Agent 类型。
- 不读取 `auth.json`、配置文件、日志、缓存、工具输出或模型回复。
- 不把提示词正文写入控制台、原生日志或错误信息。
- 错误信息只包含 Agent、目录、文件名和错误类别。
- 扫描结果仅存在于当前弹窗内存；只有用户选择的条目进入历史存储。

## 错误处理

- 目录不存在：显示“未找到”，不作为扫描失败。
- 无读取权限：该目录显示失败，并允许用户重新选择自定义目录。
- 格式版本不支持：跳过不匹配记录并显示跳过数量。
- 文件在扫描中被修改：保留已成功解析的数据，并将文件标记为部分完成。
- 扫描取消：停止新文件和新数据库分页，丢弃尚未发送的批次，保留弹窗中的已接收结果供查看但禁止保存，直到重新扫描完成。
- 历史写入失败：事务回滚，结果选择保持不变，用户可重试。

## 测试策略

### Swift 单元测试

使用仓库内脱敏 fixture，不读取开发机真实目录：

- 五个解析器的正常记录和不同内容形态。
- 自然语言、多行文本和 shell 命令保留。
- 控制命令、模型回复、工具结果、附件和自动上下文过滤。
- 损坏 JSONL 行、不可读文件和格式字段缺失。
- 内容规范化、跨 Agent 去重、来源汇总和最新时间选择。
- 默认目录检测、自定义目录绑定、符号链接跳过和取消扫描。
- OpenCode 轻量历史优先及只读 SQLite 回退。

### 前端单元测试

- 旧历史迁移成功、失败回退和幂等迁移。
- 无数量上限的批量写入、事务回滚和内容查重。
- 目录默认全选、自定义目录增删和 Agent 类型选择。
- 搜索、来源筛选、全选/取消全选、展开和选择计数。
- 已存在/已收藏状态及批量收藏后的状态更新。
- 迟到批次、取消、局部目录失败和空结果状态。

### 验证命令

- `npm test`（`editor/`）
- `npm run build`（`editor/`）
- `swift test`（`macos/`）
- `swift build`（`macos/`）

## 验收标准

- macOS 工具栏可以打开新的提示词扫描弹窗。
- 默认检测并展示已安装的五类 Agent 历史目录，存在项默认勾选。
- 用户可以添加带 Agent 类型的自定义目录并完成扫描。
- 扫描结果不包含模型回复、工具输出、配置或已知控制命令。
- 自然语言和 shell 命令正确保留，重复内容只显示一次。
- 用户可筛选、展开、选择并批量保存条目到现有历史收藏。
- 已存在内容不会重复导入。
- 历史记录不再按 100 条截断，旧历史完整迁移。
- 大型历史扫描期间界面可响应，进度可见且可以取消。
- 单目录或单文件失败不会中止其他目录扫描。
- 扫描和收藏过程不产生网络请求，不修改 Agent 原始数据。
