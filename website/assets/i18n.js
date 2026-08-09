/* Prompt Editor site i18n — zh / en toggle */
(function () {
  "use strict";

  const dict = {
    zh: {
      "nav.features": "功能",
      "nav.download": "下载",
      "nav.github": "GitHub",

      "hero.eyebrow": "Prompt Editor",
      "hero.title": "为 CLI 而生的\n原生 Prompt 编辑器。",
      "hero.sub": "一个轻巧的多平台原生编辑器，为 Claude Code、Codex 等命令行 AI 工具带来舒适的提示词编辑体验。全局快捷键呼出，写完即走。",
      "hero.cta.download": "立即下载",
      "hero.cta.features": "了解功能 >",

      "highlights.title": "写得快。发得准。",
      "highlights.sub": "所有为提示词而生的细节，都已经替你想到。",

      "card.markdown.title": "Markdown 高亮",
      "card.markdown.desc": "基于 CodeMirror 6 的 Markdown 编辑器，语法高亮、即时渲染，长提示词也清晰易读。",
      "card.hotkey.title": "全局快捷键",
      "card.hotkey.desc": "任何应用内一键呼出编辑器，写完即发送，发送后自动隐藏，不打断你的工作流。",
      "card.history.title": "历史记录",
      "card.history.desc": "自动保存历史提示词，上下方向键即可快速切换、复用和修改。",
      "card.image.title": "图片粘贴",
      "card.image.desc": "截图直接粘贴进编辑器，随提示词一起发送，多模态输入一步到位。",
      "card.copy.title": "一键复制",
      "card.copy.desc": "内容一键复制到剪贴板，在任何工具之间自由搬运你的提示词。",
      "card.confirm.title": "发送前确认",
      "card.confirm.desc": "发送前弹出内容预览确认，Enter 发送、Esc 取消，不再误发半截提示词。",

      "platforms.title": "三大平台，原生体验。",
      "platforms.sub": "不是 Electron。每个平台都使用原生技术栈构建，轻巧、快速、省电。",
      "platform.macos.desc": "Swift + AppKit\nWKWebView · 菜单栏常驻",
      "platform.windows.desc": "Rust + Tauri\nWebView2 · 系统托盘",
      "platform.linux.desc": "GTK4 + WebKitGTK\nX11 全局快捷键",

      "cta.title": "开始更高效地与 AI 对话。",
      "cta.download": "下载 Prompt Editor >",
      "cta.source": "查看源码 >",

      "features.title": "功能",
      "features.sub": "为提示词编辑而生的每一项能力。",
      "shortcuts.title": "快捷键",
      "shortcuts.sub": "肌肉记忆级别的操作速度。",
      "shortcuts.col.platform": "平台",
      "shortcuts.col.key": "快捷键",
      "shortcuts.col.action": "功能",
      "shortcuts.send": "发送提示词",
      "shortcuts.toggle": "显示 / 隐藏编辑器",
      "shortcuts.hide": "隐藏编辑器",
      "shortcuts.history": "切换历史提示词",
      "flow.title": "发送流程",
      "flow.sub": "三步，不多不少。",
      "flow.1.title": "编辑",
      "flow.1.desc": "用熟悉的快捷键呼出编辑器，以 Markdown 书写提示词，支持图片粘贴。",
      "flow.2.title": "确认",
      "flow.2.desc": "按下发送快捷键，弹出内容预览确认框，所见即所得。",
      "flow.3.title": "发送",
      "flow.3.desc": "Enter 确认发送，内容直达 CLI 工具；Esc 随时取消。",

      "download.title": "下载",
      "download.sub": "选择你的平台，或从源码构建。",
      "download.coming": "预编译版本即将发布",
      "download.build.title": "从源码构建",
      "download.build.sub": "需要 Rust 1.85+ 与 Node.js；macOS 另需 Swift 5.6+。",
      "download.requirements": "环境要求",
      "download.req.rust": "Rust 1.85+",
      "download.req.node": "Node.js（编辑器构建）",
      "download.req.swift": "Swift 5.6+（仅 macOS）",
      "download.req.win": "Windows 10/11 + WebView2 Runtime",
      "download.req.linux": "GTK4 + WebKitGTK 6.0 + libx11-dev",

      "footer.tagline": "为 CLI 工具提供舒适的 Prompt 编辑体验。",
      "footer.copyright": "Copyright © 2026 Prompt Editor. 保留所有权利。"
    },

    en: {
      "nav.features": "Features",
      "nav.download": "Download",
      "nav.github": "GitHub",

      "hero.eyebrow": "Prompt Editor",
      "hero.title": "A native prompt editor,\nborn for the CLI.",
      "hero.sub": "A lightweight, multi-platform native editor that brings a comfortable prompt-writing experience to CLI AI tools like Claude Code and Codex. Summon it with a global hotkey, write, and go.",
      "hero.cta.download": "Download",
      "hero.cta.features": "Explore features >",

      "highlights.title": "Write fast. Send right.",
      "highlights.sub": "Every detail that matters for prompts, already thought through.",

      "card.markdown.title": "Markdown Highlighting",
      "card.markdown.desc": "A CodeMirror 6 based Markdown editor with syntax highlighting. Long prompts stay clear and readable.",
      "card.hotkey.title": "Global Hotkey",
      "card.hotkey.desc": "Summon the editor from any app with one keystroke. It hides after sending, never breaking your flow.",
      "card.history.title": "History",
      "card.history.desc": "Prompts are saved automatically. Cycle through history with the up/down arrow keys to reuse and refine.",
      "card.image.title": "Image Paste",
      "card.image.desc": "Paste screenshots straight into the editor and send them with your prompt. Multimodal input in one step.",
      "card.copy.title": "One-click Copy",
      "card.copy.desc": "Copy everything to the clipboard in one click and move your prompts freely between tools.",
      "card.confirm.title": "Confirm Before Send",
      "card.confirm.desc": "A preview dialog confirms your content before sending. Enter to send, Esc to cancel — no more half-sent prompts.",

      "platforms.title": "Three platforms. Truly native.",
      "platforms.sub": "No Electron. Each platform is built with its native stack — light, fast, and power-efficient.",
      "platform.macos.desc": "Swift + AppKit\nWKWebView · Menu bar app",
      "platform.windows.desc": "Rust + Tauri\nWebView2 · System tray",
      "platform.linux.desc": "GTK4 + WebKitGTK\nX11 global hotkey",

      "cta.title": "Start talking to AI more efficiently.",
      "cta.download": "Download Prompt Editor >",
      "cta.source": "View source >",

      "features.title": "Features",
      "features.sub": "Every capability, built for prompt editing.",
      "shortcuts.title": "Shortcuts",
      "shortcuts.sub": "Muscle-memory speed.",
      "shortcuts.col.platform": "Platform",
      "shortcuts.col.key": "Shortcut",
      "shortcuts.col.action": "Action",
      "shortcuts.send": "Send prompt",
      "shortcuts.toggle": "Show / hide editor",
      "shortcuts.hide": "Hide editor",
      "shortcuts.history": "Cycle prompt history",
      "flow.title": "How Sending Works",
      "flow.sub": "Three steps. No more, no less.",
      "flow.1.title": "Write",
      "flow.1.desc": "Summon the editor with a familiar hotkey, write your prompt in Markdown, paste images freely.",
      "flow.2.title": "Confirm",
      "flow.2.desc": "Press send, and a preview dialog shows exactly what will be sent.",
      "flow.3.title": "Send",
      "flow.3.desc": "Enter confirms and delivers to your CLI tool. Esc cancels anytime.",

      "download.title": "Download",
      "download.sub": "Pick your platform, or build from source.",
      "download.coming": "Prebuilt binaries coming soon",
      "download.build.title": "Build from Source",
      "download.build.sub": "Requires Rust 1.85+ and Node.js; macOS also needs Swift 5.6+.",
      "download.requirements": "Requirements",
      "download.req.rust": "Rust 1.85+",
      "download.req.node": "Node.js (editor build)",
      "download.req.swift": "Swift 5.6+ (macOS only)",
      "download.req.win": "Windows 10/11 + WebView2 Runtime",
      "download.req.linux": "GTK4 + WebKitGTK 6.0 + libx11-dev",

      "footer.tagline": "A comfortable prompt editing experience for CLI tools.",
      "footer.copyright": "Copyright © 2026 Prompt Editor. All rights reserved."
    }
  };

  function detectLang() {
    const saved = localStorage.getItem("pe-lang");
    if (saved === "zh" || saved === "en") return saved;
    return (navigator.language || "en").toLowerCase().startsWith("zh") ? "zh" : "en";
  }

  function apply(lang) {
    const d = dict[lang];
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (d[key] !== undefined) el.textContent = d[key];
    });
    document.querySelectorAll(".lang-toggle").forEach((btn) => {
      btn.textContent = lang === "zh" ? "EN" : "中文";
    });
    localStorage.setItem("pe-lang", lang);
  }

  window.toggleLang = function () {
    apply(document.documentElement.lang === "zh-CN" ? "en" : "zh");
  };

  document.addEventListener("DOMContentLoaded", () => apply(detectLang()));
})();
