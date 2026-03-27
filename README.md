# Prompt Editor

一个多平台原生 Prompt 编辑器，为 CLI 工具（Claude Code、Codex 等）提供舒适的编辑体验。

## 架构

```
prompt-editor/
├── core/       Rust 核心库（存储、剪贴板、Markdown 渲染、C FFI）
├── editor/     CodeMirror 6 Web 编辑器，打包为单一 HTML 文件
├── macos/      Swift + AppKit 原生外壳（WKWebView、全局快捷键、菜单栏）
├── windows/    Rust + Tauri Windows 应用（WebView2、系统托盘）
├── linux/      Rust + GTK4 + WebKitGTK Linux 应用
└── build/      构建产物输出目录
```

- **core** — Rust 编写，通过 cbindgen 生成 C 头文件 (`core/include/prompt_editor.h`)，导出为 staticlib/cdylib 供原生端调用。主要模块：`storage`（持久化）、`clipboard`（剪贴板）、`markdown`（渲染）。
- **editor** — 基于 CodeMirror 6 的 Markdown 编辑器，使用 `vite-plugin-singlefile` 打包为约 542KB（gzip）的单一 HTML，方便嵌入。
- **macos** — Swift Package 构建的 macOS 应用，通过 WKWebView 加载编辑器 HTML。设置 `LSUIElement=YES`（不显示 Dock 图标），通过 `window.webkit.messageHandlers.promptEditor.postMessage()` 进行 JS 桥接通信。
- **windows** — 使用 Tauri 框架构建的 Windows 应用，使用 WebView2 渲染编辑器，支持全局快捷键 `Alt+Space` 和系统托盘。
- **linux** — 使用 GTK4 + WebKitGTK 构建的 Linux 应用，支持 X11 全局快捷键。

## 环境要求

- Rust 1.85+
- Swift 5.6+ (macOS only)
- Node.js（用于编辑器构建）
- Windows: Windows 10/11 + WebView2 Runtime
- Linux: GTK4 + WebKitGTK 6.0 + libx11-dev (for X11 support)

## 构建

一键完整构建：

```bash
./build.sh
```

分步构建：

```bash
make core      # 构建 Rust 核心库
make editor    # 构建 Web 编辑器
make macos     # 构建 macOS 应用
make windows   # 构建 Windows 应用
make linux     # 构建 Linux 应用
```

跨平台构建：

```bash
make windows-cross   # 从 Linux/macOS 交叉编译 Windows 版本
make linux-cross     # 从 macOS 交叉编译 Linux 版本
```

构建完成后运行：

```bash
# macOS
open build/PromptEditor.app

# Linux
./linux/target/release/prompt-editor

# Windows
./windows/target/release/prompt-editor.exe
```

## 安装

```bash
# macOS
make install-macos

# Linux
make install-linux

# Windows
make install-windows
```

## 功能特性

### 编辑器功能
- 📝 Markdown 语法高亮
- 🖼️ 图片粘贴支持
- 📜 历史记录管理
- ⬆️⬇️ 上下方向键快速切换历史提示词
- 📋 一键复制到剪贴板
- ✓ 发送前确认对话框

### 快捷键
| 平台 | 快捷键 | 功能 |
|------|--------|------|
| macOS | `⌘ + ↵` | 发送提示词 |
| macOS | `⌥ + Space` | 显示/隐藏编辑器 |
| Windows | `Alt + Space` | 显示/隐藏编辑器 |
| Linux | `Ctrl + Alt + Space` | 显示/隐藏编辑器 |
| All | `Esc` | 隐藏编辑器 |

### 发送流程
1. 编辑完成后按 `⌘ + ↵` (或点击 Send 按钮)
2. 弹出确认对话框，显示将要发送的内容预览
3. 按 `Enter` 确认发送，或按 `Escape` 取消

## 测试

```bash
make test           # 运行所有测试
make test-core      # Rust 核心测试
make test-editor    # 编辑器测试（vitest）
make test-macos     # Swift 测试
```

## 清理

```bash
make clean
```

## Linux 依赖安装

### Ubuntu/Debian
```bash
sudo apt-get install -y libgtk-4-dev libwebkitgtk-6.0-dev libx11-dev
```

### Fedora
```bash
sudo dnf install gtk4-devel webkitgtk6.0-devel libX11-devel
```

### Arch Linux
```bash
sudo pacman -S gtk4 webkitgtk-6.0 libx11
```

## Windows 依赖

- 安装 [Rust](https://rustup.rs/)
- 安装 [Node.js](https://nodejs.org/)
- 安装 [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/)
- WebView2 Runtime（Windows 10/11 已预装）
