# Prompt Editor

[English](README.md) | 简体中文

Prompt Editor 是一个为编程智能体（coding agent）和终端工具打造的 macOS 原生提示词工作台。它集成了 CodeMirror Markdown 编辑器、可复用的片段与模板、提示词历史、智能体历史扫描，以及感知终端的发送能力。

支持平台为 macOS 12 及更高版本。Windows 和 Linux 移植仍处于实验阶段：源码保留，但不纳入签名发布流程。

## 功能特性

- Markdown 编辑，支持语法高亮与图片粘贴
- 提示词历史、收藏、模板、片段库与 AI 辅助编辑
- 从支持的编程智能体历史记录中导入 Prompt Memory
- macOS 全局快捷键与感知终端的粘贴/发送行为
- Rust 核心通过稳定的 C FFI 边界共享
- 同时支持 Apple Silicon 与 Intel 的 Universal 2 构建

## 安装

从 GitHub Release 下载 `.dmg`，打开后将 **Prompt Editor** 拖入「应用程序」。`.tar.gz` 面向自动化或不便挂载磁盘镜像的环境。安装前请校验附带的校验和：

```bash
shasum -a 256 -c PromptEditor-0.1.0-macos-universal.dmg.sha256
```

应用仅在终端粘贴自动化需要时才会请求辅助功能（Accessibility）权限。源码构建、卸载步骤、Gatekeeper 问题排查与权限详情见[安装文档](docs/INSTALLATION.md)。

## 使用

从「应用程序」启动 Prompt Editor。使用 `Command+Shift+P` 显示或隐藏窗口，`Escape` 隐藏。将提示词复制到剪贴板，或粘贴回上次的输入位置，然后粘贴进你的 CLI 工具。向其他应用粘贴可能需要在 **系统设置 > 隐私与安全性** 中授予辅助功能权限。

## 开发

环境要求：Rust 1.85+、Node.js 24+（配合 Corepack）与 GNU Make。macOS 构建另需 Xcode 命令行工具及两个 Rust target：

```bash
rustup target add aarch64-apple-darwin x86_64-apple-darwin
corepack pnpm --dir editor install --frozen-lockfile
make verify
```

常用命令：

```bash
make test                    # 在 macOS 上运行 Rust、编辑器与 macOS 测试
make lint                    # rustfmt、Clippy、TypeScript、Swift manifest 检查
make coverage                # 生成编辑器与 Rust 的 LCOV 覆盖率报告
make macos                   # 构建 Universal 2 应用包
make package-macos VERSION=0.1.0
```

Rust 覆盖率依赖 `cargo-llvm-cov` 与 `llvm-tools-preview`；缺少可执行文件时 `make coverage` 会打印安装命令。真实剪贴板测试通过 `make test-clipboard` 选择性开启。

## 架构

```text
core/       Rust 实现存储、剪贴板、Markdown、扫描、模板与 C FFI
editor/     TypeScript/CodeMirror 编辑器，打包为单个内嵌 HTML 文件
macos/      SwiftPM/AppKit 外壳、WKWebView 桥接与终端集成
windows/    实验性 Tauri 外壳
linux/      实验性 GTK4/WebKitGTK 外壳
scripts/    版本校验、Universal 2 构建、签名、公证与打包
```

详细的支持矩阵见 [docs/feature-support-matrix.md](docs/feature-support-matrix.md)。仓库风险与整改状态记录在 [CODE_REVIEW.md](CODE_REVIEW.md) 与 [OPENSOURCE_PLAN.md](OPENSOURCE_PLAN.md)。

## 参与贡献

提交改动前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。使用 Conventional Commits，附带聚焦的测试，并运行 `make verify`。安全漏洞请按 [SECURITY.md](SECURITY.md) 报告，不要在公开 issue 中披露。

## 许可证

Prompt Editor 基于 [MIT 许可证](LICENSE) 发布。Copyright (c) 2026 Kimi Wu.
