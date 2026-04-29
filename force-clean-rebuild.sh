#!/bin/bash
# 强制清理 macOS WebKit 缓存和重启应用

echo "=== 强制清理 Prompt Editor 缓存 ==="

echo ""
echo "1. 停止所有相关进程..."
killall PromptEditor 2>/dev/null
killall -9 "com.apple.WebKit.WebContent" 2>/dev/null
sleep 2

echo ""
echo "2. 清理 WebKit 缓存..."
rm -rf ~/Library/Caches/com.apple.WebKit.WebContent
rm -rf ~/Library/Caches/com.apple.WebKit.Networking
rm -rf ~/Library/WebKit/com.prompteditor.app

echo ""
echo "3. 清理应用沙盒数据..."
sandbox_path="$HOME/Library/Containers/com.prompteditor.app"
if [ -d "$sandbox_path" ]; then
    echo "清理沙盒: $sandbox_path"
    rm -rf "$sandbox_path/Data/Library/Application Support"
    rm -rf "$sandbox_path/Data/Library/Caches"
    rm -rf "$sandbox_path/Data/Library/WebKit"
fi

echo ""
echo "4. 清理应用偏好设置..."
defaults delete com.prompteditor.app 2>/dev/null || true

echo ""
echo "5. 重新构建应用..."
cd "$(dirname "$0")"
./build.sh

echo ""
echo "=== 清理和重新构建完成 ==="
echo ""
echo "重要提示："
echo "1. 现在打开应用应该会看到最新版本"
echo "2. 如果仍然看不到，可能需要在 Safari 开发者工具中检查"
echo "3. 管理面板工具栏应该包含 📋 (日志) 按钮"
echo ""
echo "立即启动应用："
echo "  open build/PromptEditor.app"
echo ""