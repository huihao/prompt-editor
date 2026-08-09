#!/bin/bash
# 测试保存功能脚本

echo "=== Prompt Editor 保存功能测试 ==="
echo ""

# 1. 强制重启
echo "1. 强制重启应用..."
killall -9 PromptEditor 2>/dev/null
killall -9 "com.apple.WebKit.WebContent" 2>/dev/null
sleep 2

# 2. 验证文件版本
echo ""
echo "2. 验证构建版本..."
editor_html="build/PromptEditor.app/Contents/Resources/editor.html"

if [ -f "$editor_html" ]; then
    echo "  ✓ Editor HTML 存在"
    size=$(ls -lh "$editor_html" | awk '{print $5}')
    mod_time=$(stat -f "%Sm" "$editor_html")
    echo "  - 文件大小: $size"
    echo "  - 修改时间: $mod_time"

    # 检查关键功能
    save_method=$(grep -c "saveCategory" "$editor_html")
    echo "  - saveCategory 方法出现次数: $save_method"

    if [ $save_method -ge 10 ]; then
        echo "  ✓ 保存功能代码已嵌入"
    else
        echo "  ✗ 保存功能代码缺失！"
        echo "  → 需要重新构建: cd editor && corepack pnpm build"
        exit 1
    fi
else
    echo "  ✗ Editor HTML 不存在！"
    echo "  → 需要运行: ./build.sh"
    exit 1
fi

# 3. 打开应用
echo ""
echo "3. 启动应用..."
open build/PromptEditor.app
echo "  ✓ 应用已启动"

echo ""
echo "=== 准备测试 ==="
echo ""
echo "请按照以下步骤操作："
echo ""
echo "步骤 1: 打开 Safari 开发者工具"
echo "  - Safari → Develop → [你的电脑] → PromptEditor"
echo ""
echo "步骤 2: 在 Console 中运行诊断命令"
echo "  复制并粘贴以下代码："
echo ""
echo "---"
cat <<'EOF'
// 检查 UI 元素和事件绑定
const uiCheck = {
  // 检查管理面板是否打开
  panelOpen: !!document.querySelector('.snippet-manager-overlay'),

  // 检查工具栏按钮
  toolbarButtons: document.querySelectorAll('.snippet-manager-toolbar button').length,

  // 检查 Add Category 按钮
  addCategoryBtn: !!document.getElementById('btn-add-category'),

  // 检查日志按钮
  logsBtn: !!document.getElementById('btn-logs'),

  // 检查编辑视图表单元素
  editViewOpen: !!document.querySelector('.edit-category-view'),

  // 检查表单元素（如果编辑视图打开）
  formElements: {
    idInput: !!document.getElementById('category-id'),
    nameInput: !!document.getElementById('category-name'),
    iconInput: !!document.getElementById('category-icon'),
    descInput: !!document.getElementById('category-desc'),
    parentSelect: !!document.getElementById('category-parent'),
    saveBtn: !!document.querySelector('.btn-save')
  }
};

console.log('=== UI 检查报告 ===');
console.log(JSON.stringify(uiCheck, null, 2));

// 测试手动添加分类（模拟用户操作）
const testAddCategory = async () => {
  console.log('\n=== 开始测试保存功能 ===');

  try {
    // 创建测试分类对象
    const testCategory = {
      id: 'test-manual-' + Date.now(),
      name: 'Manual Test Category',
      icon: '🧪',
      description: 'Manual test via console'
    };

    console.log('测试分类对象:', testCategory);

    // 调用 SnippetManager API
    console.log('\n调用 snippetManager.addCategory...');
    const success = await be.addCategory(testCategory, 'ai-assistance');

    console.log('\n保存结果:', success);

    if (success) {
      console.log('✓ 保存成功！');
      console.log('\n查看最近的日志:');
      const logs = ue.getRecentLogs(20);
      logs.forEach(log => console.log(`[${log.level}] ${log.message}`, log.data || ''));

      console.log('\n检查 localStorage:');
      const stored = localStorage.getItem('prompt-editor-snippets');
      console.log('存储的数据:', stored ? JSON.parse(stored) : null);
    } else {
      console.log('✗ 保存失败');
      console.log('\n查看最近的错误日志:');
      const logs = ue.getRecentLogs(20);
      const errors = logs.filter(l => l.level === 'ERROR');
      errors.forEach(log => console.log(`[ERROR] ${log.message}`, log.data || ''));
    }
  } catch (error) {
    console.log('✗ 异常:', error);
    console.log('错误栈:', error.stack);

    console.log('\n查看最近的错误日志:');
    const logs = ue.getRecentLogs(20);
    logs.forEach(log => console.log(`[${log.level}] ${log.message}`, log.data || ''));
  }
};

// 自动执行测试
await testAddCategory();
EOF
echo "---"
echo ""
echo "步骤 3: 观察输出结果"
echo "  - 如果看到 '✓ 保存成功！'，说明功能正常"
echo "  - 如果看到 '✗ 保存失败'，查看错误日志"
echo "  - 检查 localStorage 是否包含新保存的分类"
echo ""
echo "步骤 4: 在应用中验证"
echo "  - 关闭并重新打开 Snippet 管理面板"
echo "  - 检查 'AI Assistance' 分类下是否有新的子分类 'Manual Test Category'"
echo "  - 点击 📋 查看日志，确认保存操作记录"
echo ""
echo "如果手动测试成功，但 UI 操作失败："
echo "  - 打开编辑分类视图（点击 📁 New Category）"
echo "  - 填写表单："
echo "    ID: test-ui-2026"
echo "    Name: Test UI Save"
echo "    Parent: AI Assistance"
echo "  - 点击 Save 按钮"
echo "  - 如果没有反应，再次运行上述 UI 检查代码"
echo "  - 查看是否有 'saveCategory called' 日志"
echo ""
