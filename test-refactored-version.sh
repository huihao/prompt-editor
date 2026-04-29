#!/bin/bash
# 重构版本测试脚本

echo "=== Snippet Manager 重构版本测试 ==="
echo ""

echo "✓ 重构版本已部署并应用已重启"
echo ""

echo "=== 关键改进 ==="
echo "1. 全局错误捕获 - 所有未处理的错误都会被记录"
echo "2. 使用 onclick 直接绑定 - Save 按钮事件更可靠"
echo "3. 详细日志记录 - 每个步骤都有完整日志"
echo "4. 全局测试函数 - 可直接在 Console 调用 API"
echo ""

echo "=== 测试步骤 ==="
echo ""

echo "步骤 1: 打开 Safari 开发者工具"
echo "  - Safari → Develop → [您的电脑] → PromptEditor"
echo ""

echo "步骤 2: 在 Console 中查看版本标识"
echo "  应该看到:"
echo "  ✓ Snippet Manager UI loaded. Global test functions available:"
echo ""

echo "步骤 3: 测试全局 API 函数（最简单的测试方式）"
echo ""
echo "  在 Console 中粘贴以下代码:"
echo ""
echo "---"
cat <<'EOF'
// 测试 1: 使用全局测试函数保存分类
await testSaveCategory('test-global-api', 'Global API Test', 'ai-assistance');

// 应该看到输出:
// ★★★ Global test: saving category ★★★
// Result: true
// ✓ Saved! Check logs:
// [INFO] addCategory called ...
// [INFO] User data saved successfully ...
// [INFO] Category saved successfully ...

console.log('\n验证 localStorage:');
const stored = localStorage.getItem('prompt-editor-snippets');
console.log('存储数据:', stored ? JSON.parse(stored) : '(空)');

console.log('\n完整的最近日志:');
logger.getRecentLogs(15).split('\n').forEach(line => console.log(line));
EOF
echo "---"
echo ""

echo "步骤 4: 测试 UI 保存功能"
echo "  1. 在应用中打开 Snippet 管理面板"
echo "  2. 点击 📁 New Category"
echo "  3. 填写表单:"
echo "     - ID: test-ui-refactored"
echo "     - Name: Test UI Refactored"
echo "     - Parent: AI Assistance"
echo "  4. 点击 Save Category 按钮"
echo "  5. 观察:"
echo "     - Console 是否显示 '★ Save Category button clicked'"
echo "     - Console 是否显示 '★ Calling addCategory API'"
echo "     - 是否出现 alert '✓ Category saved successfully!'"
echo "     - 是否返回列表视图"
echo ""

echo "步骤 5: 验证结果"
echo "  - 关闭并重新打开管理面板"
echo "  - 检查 AI Assistance 下是否有新的子分类"
echo "  - 点击 📋 查看日志，确认有完整的保存流程记录"
echo ""

echo "=== 如果 UI 仍然失败 ==="
echo ""
echo "在 Console 中运行完整诊断:"
echo ""
echo "---"
cat <<'EOF'
// 检查按钮绑定状态
const saveBtn = document.querySelector('.btn-save-category');
console.log('Save button:', {
  exists: !!saveBtn,
  className: saveBtn?.className,
  hasOnClick: !!saveBtn?.onclick,
  onclickType: typeof saveBtn?.onclick
});

// 手动触发保存（绕过 UI）
if (!saveBtn?.onclick) {
  console.log('✗ onclick 未绑定，手动绑定...');
  saveBtn.onclick = async () => {
    console.log('★ Manual onclick triggered');
    const idEl = document.getElementById('category-id');
    const nameEl = document.getElementById('category-name');
    const parentEl = document.getElementById('category-parent');

    const id = idEl?.value.trim();
    const name = nameEl?.value.trim();
    const parentId = parentEl?.value;

    console.log('Form values:', { id, name, parentId });

    if (!id || !name) {
      alert('Please fill ID and Name');
      return;
    }

    const success = await snippetManager.addCategory(
      { id, name, icon: '📁', description: '' },
      parentId
    );

    if (success) {
      alert('✓ Saved!');
      snippetManagerUI.showListView();
    } else {
      alert('✗ Failed');
    }
  };

  console.log('✓ 手动绑定完成，点击按钮测试');
}
EOF
echo "---"
echo ""

echo "=== 日志分析 ==="
echo ""
echo "如果保存成功，日志应该包含:"
echo "  [INFO] ★★★ handleSaveCategory() called ★★★"
echo "  [INFO] ★ Form values extracted"
echo "  [INFO] ★ Category object created"
echo "  [INFO] ★ Calling addCategory API"
echo "  [INFO] addCategory called"
echo "  [INFO] Calling saveUserData"
echo "  [INFO] User data saved successfully"
echo "  [INFO] ★ API call completed {success: true}"
echo "  [INFO] ✓✓✓ Category saved successfully!"
echo ""

echo "如果保存失败，查看:"
echo "  - ERROR 级别日志"
echo "  - WARN 级别日志"
echo "  - 异常信息"
echo ""

echo "=== 提供诊断报告 ==="
echo ""
echo "如果问题仍然存在，请提供:"
echo "1. Safari Console 完整输出截图"
echo "2. 点击 📋 导出的日志文件"
echo "3. localStorage.getItem('prompt-editor-snippets') 的输出"
echo "4. 操作步骤描述"
echo ""