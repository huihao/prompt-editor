#!/bin/bash
# 一键诊断脚本

echo "=== Prompt Editor 一键诊断 ==="
echo ""

# 1. 强制重启
echo "1. 强制重启应用..."
killall -9 PromptEditor 2>/dev/null
killall -9 "com.apple.WebKit.WebContent" 2>/dev/null
sleep 2

# 2. 验证文件
echo ""
echo "2. 验证构建文件..."
editor_html="build/PromptEditor.app/Contents/Resources/editor.html"

if [ -f "$editor_html" ]; then
    echo "  ✓ Editor HTML 存在"
    size=$(ls -lh "$editor_html" | awk '{print $5}')
    echo "  - 文件大小: $size"

    # 检查关键内容
    logs_btn=$(grep -c "btn-logs" "$editor_html")
    echo "  - 日志按钮出现次数: $logs_btn"

    if [ $logs_btn -ge 2 ]; then
        echo "  ✓ 日志按钮代码存在"
    else
        echo "  ✗ 日志按钮代码缺失！"
        echo "  → 需要重新构建: ./build.sh"
    fi

    # 检查诊断功能
    diagnostic=$(grep -c "diagnosticSnippetManager" "$editor_html")
    echo "  - 诊断功能出现次数: $diagnostic"

    if [ $diagnostic -ge 1 ]; then
        echo "  ✓ 诊断功能已嵌入"
    else
        echo "  ✗ 诊断功能未嵌入"
    fi

else
    echo "  ✗ Editor HTML 不存在！"
    echo "  → 需要运行: ./build.sh"
fi

# 3. 打开应用
echo ""
echo "3. 启动应用..."
open build/PromptEditor.app
echo "  ✓ 应用已启动"

echo ""
echo "=== 诊断完成 ==="
echo ""
echo "下一步操作："
echo ""
echo "1. 打开 Snippet 管理面板"
echo "2. 检查工具栏是否包含 📋 (日志) 按钮"
echo ""
echo "3. 如果看不到按钮，使用 Safari 开发者工具："
echo "   - Safari → Develop → [你的电脑] → PromptEditor"
echo "   - 在 Console 中运行: diagnosticSnippetManager()"
echo ""
echo "4. 查看诊断报告，按照提示操作"
echo ""
echo "5. 如需帮助，请提供："
echo "   - 管理面板截图"
echo "   - Console 输出截图"
echo "   - diagnosticSnippetManager() 的完整输出"
echo ""