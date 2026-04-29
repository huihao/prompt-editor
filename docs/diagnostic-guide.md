# 如何使用诊断工具检查问题

## 方法 1：使用内置诊断函数（推荐）

### 步骤：

1. **打开 PromptEditor.app**
   ```bash
   open build/PromptEditor.app
   ```

2. **打开 Snippet 管理面板**
   - 在编辑器中点击 snippet 按钮
   - 或使用全局快捷键

3. **在 Safari 开发者工具中运行诊断**

   **启用 Safari 开发者工具：**
   - Safari → Preferences → Advanced → 勾选 "Show Develop menu in menu bar"

   **连接到应用：**
   - Safari 菜单 → Develop → [你的电脑名] → PromptEditor

   **在 Console 中运行：**
   ```javascript
   diagnosticSnippetManager()
   ```

4. **查看诊断报告**

   会输出类似这样的信息：
   ```javascript
   {
     uiOpen: true,
     logsButtonExists: false,  // 如果是 false，说明按钮没有加载
     logsButtonHTML: undefined,
     toolbarHTML: "<button class=\"btn btn-primary\" id=\"btn-add-category\">...",
     currentView: "list",
     overlayState: true
   }
   ```

5. **如果 logsButtonExists 是 false**

   诊断工具会尝试手动添加按钮：
   ```javascript
   console.log("✓ Logs button manually added");
   ```

   然后检查工具栏是否出现了 📋 按钮。

## 方法 2：直接检查 DOM

在 Safari Console 中运行：

```javascript
// 检查工具栏是否存在
document.querySelector('.snippet-manager-toolbar')

// 检查所有按钮
document.querySelectorAll('.snippet-manager-toolbar button')

// 检查日志按钮
document.getElementById('btn-logs')

// 如果按钮不存在，手动添加
const toolbar = document.querySelector('.snippet-manager-toolbar');
const spacer = toolbar.querySelector('.toolbar-spacer');
const logsBtn = document.createElement('button');
logsBtn.className = 'btn btn-icon';
logsBtn.id = 'btn-logs';
logsBtn.title = 'View Logs';
logsBtn.textContent = '📋';
spacer.after(logsBtn);

// 测试点击
logsBtn.click();
```

## 方法 3：检查 localStorage 日志

如果能看到日志按钮并打开日志面板，但日志为空：

```javascript
// 检查 localStorage 中的日志
localStorage.getItem('prompt-editor-logs')

// 检查日志对象
ue.getAllLogs()

// 手动添加一条测试日志
ue.info('Test', 'This is a test log entry');
ue.getAllLogs();
```

## 方法 4：测试保存功能

在 Console 中运行：

```javascript
// 监听所有日志输出
const originalLog = console.log;
console.log = function(...args) {
  originalLog.apply(console, args);
  // 如果有日志系统，也写入日志
  if (typeof ue === 'object') {
    ue.info('Console', args.join(' '));
  }
};

// 打开编辑分类视图
const ui = O$;
ui.showEditCategoryView();

// 然后在 UI 中填写表单并点击 Save

// 查看日志
ue.getRecentLogs(50);
```

## 常见问题分析

### 问题：按钮不存在

**可能原因：**
1. **CSS 问题**：按钮被隐藏或样式错误
   ```javascript
   // 检查样式
   const btn = document.getElementById('btn-logs');
   console.log('Display:', btn?.style.display);
   console.log('Visibility:', btn?.style.visibility);
   console.log('Width:', btn?.offsetWidth);
   console.log('Height:', btn?.offsetHeight);
   ```

2. **HTML 未生成**：`showListView()` 方法没有正确生成 HTML
   ```javascript
   // 检查当前视图内容
   document.querySelector('.snippet-manager-body').innerHTML
   ```

3. **版本缓存**：虽然清理了缓存，但 macOS 可能还在使用旧的 WebContent 进程
   ```bash
   # 强制终止所有 WebKit 进程
   killall -9 "com.apple.WebKit.WebContent"
   killall PromptEditor
   sleep 2
   open build/PromptEditor.app
   ```

### 问题：保存功能不工作

**诊断步骤：**

```javascript
// 1. 检查表单元素
const form = {
  id: document.getElementById('category-id'),
  name: document.getElementById('category-name'),
  parent: document.getElementById('category-parent')
};
console.log('Form elements:', form);

// 2. 检查 saveCategory 方法是否存在
console.log('saveCategory method:', typeof O$['saveCategory']);

// 3. 手动触发保存
const testCategory = {
  id: 'test-diagnostic',
  name: 'Test Category',
  icon: '📁',
  description: 'Diagnostic test'
};

// 调用 API
be.addCategory(testCategory, 'ai-assistance')
  .then(success => {
    console.log('Save result:', success);
    console.log('Logs:', ue.getRecentLogs(10));
  });
```

## 报告问题

如果上述方法都无法解决，请提供以下信息：

1. **诊断报告截图**
2. **Console 输出截图**
3. **管理面板截图**（即使看不到按钮）
4. **浏览器信息**
   ```javascript
   console.log('User Agent:', navigator.userAgent);
   console.log('Platform:', navigator.platform);
   ```

这样可以帮助快速定位问题的根本原因！