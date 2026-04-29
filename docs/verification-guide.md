# 验证 Snippet Manager 修改是否生效

## 快速验证清单

### ✅ 构建确认（已验证）
- MD5 checksum 匹配：`631ca6104a489f36336862911c5cc99d`
- 构建时间：2026-04-16 16:49
- `btn-logs` 按钮在构建文件中出现 2 次
- Logger 类已打包（压缩为 `class xW`）

### 🔍 用户端验证步骤

#### 1. 完全重启应用
```bash
# 方法 A: 通过终端
killall PromptEditor
sleep 1
open build/PromptEditor.app

# 方法 B: 在应用中
按 Cmd+Q 或点击菜单 PromptEditor → Quit PromptEditor
然后重新打开应用
```

#### 2. 打开 Snippet 管理面板
- 在编辑器界面点击 snippet 管理按钮
- 或使用全局快捷键（如果已配置）

#### 3. 查找新增的日志按钮

**工具栏布局应该是：**
```
[📁 New Category] [📝 New Snippet] | [📋] [📤] [📥] [🔄]
```

**按钮功能：**
- 📁 New Category - 创建新分类
- 📝 New Snippet - 创建新片段
- **📋 View Logs** ← 新增的日志按钮
- 📤 Export - 导出数据
- 📥 Import - 导入数据
- 🔄 Reset to Default - 重置到默认

#### 4. 测试日志功能

**操作流程：**
1. 点击 📋 按钮打开日志视图
2. 应该看到日志列表（可能为空或有一些历史数据）
3. 点击 "← Back" 返回列表视图
4. 创建一个新的分类（填写 ID 和名称）
5. 点击 Save 保存
6. 再次点击 📋 查看日志
7. 应该看到详细的保存操作日志

**日志示例：**
```
[2026-04-16T16:49:00.123Z] [INFO] [SnippetManagerUI] saveCategory called
[2026-04-16T16:49:00.125Z] [INFO] [SnippetManagerUI] Form values extracted
[2026-04-16T16:49:00.127Z] [INFO] [SnippetManager] addCategory called
[2026-04-16T16:49:00.130Z] [INFO] [SnippetManager] Calling saveUserData
[2026-04-16T16:49:00.135Z] [INFO] [SnippetManager] User data saved successfully
```

#### 5. 测试保存功能

**创建子分类测试：**
1. 点击 "📁 New Category"
2. 填写表单：
   - ID: `test-subcategory`
   - Name: `Test Subcategory`
   - Parent Category: 选择一个已有分类（如 "AI Assistance"）
3. 点击 Save
4. 返回列表视图
5. 展开 "AI Assistance" 分类
6. 应该看到新的 "Test Subcategory"，**且原有的子分类仍然存在**

**验证原有数据未被清空：**
- "AI Assistance" 下原有的子分类：
  - "Context Management"（应该保留）
  - "Code Assistance"（应该保留）
- 新增的 "Test Subcategory" 应该被添加到列表中

## 如果修改仍未出现

### 可能原因分析

#### 1. macOS 缓存问题
macOS 可能缓存了旧版本的 WebContent 进程。

**解决方法：**
```bash
# 清理 macOS WebContent 缓存
rm -rf ~/Library/Caches/com.apple.WebKit.WebContent

# 重启应用
killall PromptEditor
open build/PromptEditor.app
```

#### 2. localStorage 缓存
旧的 localStorage 数据可能导致某些功能异常。

**解决方法：**
在 Snippet 管理面板中：
1. 点击 "🔄 Reset to Default" 按钮
2. 确认清空所有用户数据
3. 重新测试功能

#### 3. 开发者工具确认
如果修改仍然看不到，可以启用 Safari 的开发者工具来检查：

**步骤：**
1. 在 Safari 中启用开发者菜单：
   - Safari → Preferences → Advanced → Show Develop menu
2. 打开 PromptEditor.app
3. 在 Safari 菜单中：Develop → [你的电脑] → PromptEditor
4. 打开 Web Inspector
5. 在 Console 中输入：
   ```javascript
   // 检查 logger 是否存在
   console.log(typeof ue);  // 应该输出 "object"

   // 检查日志按钮
   console.log(document.getElementById('btn-logs'));  // 应该输出按钮元素

   // 手动触发日志按钮点击
   document.getElementById('btn-logs').click();
   ```

#### 4. 检查构建产物
确认 app bundle 使用的是最新构建：

```bash
# 检查文件大小和日期
ls -lh build/PromptEditor.app/Contents/Resources/editor.html

# 应该看到：1.7M, 日期为最近构建时间（2026-04-16 16:49）

# 检查关键内容
grep "btn-logs" build/PromptEditor.app/Contents/Resources/editor.html
# 应该看到 2 处匹配
```

## 预期功能对比

### 旧版本（修复前）
- ❌ 创建子分类时，父分类的原有子分类被清空
- ❌ 保存失败时没有错误提示
- ❌ console.log 不可见，无法排查问题

### 新版本（修复后）
- ✅ 创建子分类时，原有子分类被保留
- ✅ 保存失败时有 alert 错误提示
- ✅ 详细日志记录所有操作（可导出为文件）
- ✅ 日志面板显示最近 100 条操作记录

## 需要进一步帮助

如果按照上述步骤验证后，修改仍未生效，请提供以下信息：

1. **截图：** Snippet 管理面板工具栏的截图
2. **日志：** 如果能打开日志面板，导出日志文件
3. **Web Inspector 输出：** 在 Safari 开发者工具 Console 中运行上述检查命令的结果
4. **构建信息：**
   ```bash
   # 运行这些命令并提供输出
   md5 build/PromptEditor.app/Contents/Resources/editor.html
   stat -f "%Sm" build/PromptEditor.app/Contents/Resources/editor.html
   grep -c "btn-logs" build/PromptEditor.app/Contents/Resources/editor.html
   ```

这样可以帮助快速定位问题的根本原因。