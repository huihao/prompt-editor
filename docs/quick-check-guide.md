# 立即操作指南 - 查找日志按钮并测试保存

## ⚡ 快速检查步骤（5分钟）

### 第 1 步：完全重启应用（1分钟）

```bash
# 强制终止所有进程
killall -9 PromptEditor
killall -9 "com.apple.WebKit.WebContent"

# 等待 2 秒
sleep 2

# 打开最新版本
open build/PromptEditor.app
```

### 第 2 步：打开管理面板（30秒）

1. 在编辑器界面，点击 **snippet 管理按钮**（通常在工具栏）
2. 管理面板应该弹出

### 第 3 步：检查工具栏（30秒）

**期望看到的按钮布局：**
```
[📁 New Category] [📝 New Snippet]  [📋] [📤] [📥] [🔄]
```

**重点检查：**
- 是否看到 **📋 (View Logs)** 按钮？
- 它应该在工具栏的中间位置，紧跟着 "📝 New Snippet" 后面

### 第 4 步：如果看不到 📋 按钮（2分钟）

**方案 A：使用 Safari 开发者工具检查**

1. **启用开发者菜单：**
   - 打开 Safari
   - Safari → Preferences → Advanced
   - 勾选 "Show Develop menu in menu bar"

2. **连接到应用：**
   - PromptEditor.app 必须正在运行
   - Safari 菜单：Develop → [你的电脑] → PromptEditor
   - 点击后会打开 Web Inspector

3. **在 Console 标签中粘贴以下代码：**

   ```javascript
   diagnosticSnippetManager()
   ```

4. **查看输出：**
   - 会显示诊断报告
   - 如果 `logsButtonExists: false`，说明按钮确实没有加载
   - 诊断工具会尝试手动添加按钮

**方案 B：手动添加按钮（如果方案 A 失败）**

在 Safari Console 中粘贴：

```javascript
const toolbar = document.querySelector('.snippet-manager-toolbar');
const spacer = toolbar.querySelector('.toolbar-spacer');
const logsBtn = document.createElement('button');
logsBtn.className = 'btn btn-icon';
logsBtn.id = 'btn-logs';
logsBtn.title = 'View Logs';
logsBtn.textContent = '📋';
spacer.after(logsBtn);

// 测试点击
logsBtn.onclick = () => {
  console.log('[Manual] Logs clicked');
  O$['showLogsView']();
};

logsBtn.click();
```

### 第 5 步：测试保存功能（1分钟）

**创建测试分类：**

1. 点击 "📁 New Category"
2. 填写表单：
   - **ID:** `test-save-2026`
   - **Name:** `Test Save 2026`
   - **Parent Category:** 选择 "AI Assistance"（可选）
3. 点击 **Save**

**检查结果：**

如果成功：
- 返回列表视图
- 在列表中看到新的 "Test Save 2026" 分类
- 如果选择了父分类，检查父分类的原有子分类是否仍然存在

如果失败：
- 是否出现错误提示 alert？
- 点击 📋 查看日志，找到错误信息

## 🔍 详细日志检查

### 查看 localStorage 日志

在 Safari Console 中：

```javascript
// 查看所有日志
localStorage.getItem('prompt-editor-logs')

// 或者使用日志对象
ue.getRecentLogs(50)
```

### 导出日志文件

如果能打开日志面板：
1. 点击 📋 按钮
2. 点击 "Export All Logs" 按钮
3. 日志会下载为 `.txt` 文件

## 📊 验证清单

请按照以下清单检查：

- [ ] 应用已完全重启（使用 killall -9）
- [ ] 管理面板能够打开
- [ ] 工具栏显示 6 个按钮（包括 📋）
- [ ] 点击 📋 能看到日志视图
- [ ] 创建测试分类能够保存
- [ ] 保存后原有分类没有被删除
- [ ] 日志中记录了保存操作的详细信息

## ❓ 如果问题仍然存在

**请提供以下信息：**

1. **截图：** 管理面板工具栏（即使看不到 📋 按钮）
2. **Console 输出：** Safari 开发者工具的 Console 标签截图
3. **诊断报告：** 运行 `diagnosticSnippetManager()` 的完整输出
4. **操作描述：** 详细描述您看到的界面和操作步骤

**文件路径验证：**

```bash
# 检查文件是否最新
ls -lh build/PromptEditor.app/Contents/Resources/editor.html
stat -f "%Sm" build/PromptEditor.app/Contents/Resources/editor.html
md5 build/PromptEditor.app/Contents/Resources/editor.html

# 应该看到：
# - 文件大小：约 1.8M
# - 修改时间：最近几分钟
# - MD5：与构建时间匹配
```

## 🎯 预期结果

### 成功状态

**工具栏应该包含：**
```
📁 New Category  |  📝 New Snippet  |  📋  |  📤  |  📥  |  🔄
```

**日志视图应该显示：**
```
📋 Debug Logs (Last 100 entries)
[← Back] [Export All Logs] [Clear Logs]

[日志内容区域]
```

**保存操作应该：**
- 成功添加新分类
- 不清空原有子分类
- 在日志中记录详细信息

### 失败状态

**如果看到：**
- 工具栏只有 5 个按钮（缺少 📋）
- 保存后原有分类消失
- 没有任何错误提示

**请立即：**
1. 运行 `diagnosticSnippetManager()`
2. 截图所有输出
3. 提供完整的问题描述

这样我才能准确定位并提供修复方案！