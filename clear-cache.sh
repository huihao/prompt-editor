#!/bin/bash
# 清理 Prompt Editor 的缓存数据
# 用于重置到初始状态

echo "清理 Prompt Editor 缓存..."

# 方法 1: 通过 macOS 清理应用数据
defaults delete com.prompteditor.app 2>/dev/null || true

# 方法 2: 清理可能的沙盒数据
sandbox_path="$HOME/Library/Containers/com.prompteditor.app/Data"
if [ -d "$sandbox_path" ]; then
    echo "清理沙盒数据: $sandbox_path"
    rm -rf "$sandbox_path/Library/Application Support"
    rm -rf "$sandbox_path/Library/Caches"
fi

# 方法 3: 清理 localStorage（通过应用内部）
# 需要在应用中手动操作：打开管理面板 → 点击 Reset to Default

echo ""
echo "清理完成。请重新启动 PromptEditor.app"
echo "如果修改仍未出现，请在应用中："
echo "  1. 打开 Snippet 管理面板"
echo "  2. 点击工具栏的 '🔄 Reset to Default' 按钮"
echo "  3. 然后点击 '📋 View Logs' 按钮查看日志"