#!/bin/bash
# 快速更新脚本 - 重新构建并部署到 app bundle

echo "=== 快速更新 Prompt Editor ==="

cd "$(dirname "$0")"

# 1. 构建 editor
echo ""
echo "1. 构建 editor..."
cd editor && pnpm build && cd ..

# 2. 复制到 app bundle
echo ""
echo "2. 复制到 app bundle..."
cp editor/dist/index.html build/PromptEditor.app/Contents/Resources/editor.html

# 3. 重启应用
echo ""
echo "3. 重启应用..."
killall PromptEditor 2>/dev/null
sleep 1
open build/PromptEditor.app

echo ""
echo "=== 更新完成 ==="
echo "请在应用中测试功能："
echo "  1. 打开 Snippet 管理面板"
echo "  2. 查看是否能看到分类列表"
echo "  3. 创建测试分类并保存"
echo "  4. 点击 📋 查看日志"
echo ""
