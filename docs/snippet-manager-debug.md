# Snippet Manager 保存流程与日志排查指南

## 问题背景

Snippet Manager 是一个基于 localStorage 的分类管理系统。由于运行在 macOS WKWebView 中，console.log 输出不可见，因此需要使用本地日志系统排查问题。

## 保存流程详解

### 1. 用户界面层 (snippet-manager-ui.ts)

当用户点击"保存"按钮时，流程如下：

```
UI 点击
  ↓
showEditCategoryView() / showEditSnippetView()
  ↓
用户填写表单
  ↓
点击 Save 按钮
  ↓
saveCategory() / saveSnippet()
  ↓
表单验证（必填字段检查）
  ↓
创建 Category/Snippet 对象
  ↓
调用 SnippetManager API
```

**关键节点：**
- 表单元素获取 (`document.getElementById`)
- 表单数据提取和验证
- Category/Snippet 对象构造
- 调用 `snippetManager.addCategory()` 或 `updateCategory()`

### 2. 数据管理层 (snippet-manager.ts)

```
snippetManager.addCategory(category, parentId)
  ↓
ensureLoaded() - 确保数据已加载
  ↓
检查 ID 是否重复
  ↓
处理 parentId：
  - 有 parentId：查找父分类
    - 父分类在 userData 中：直接添加子分类
    - 父分类是内置数据：克隆父分类结构到 userData
  - 无 parentId：添加到 root categories
  ↓
saveUserData() - 保存到 localStorage
  ↓
reloadData() - 重新加载合并数据
  ↓
返回 success/failure
```

**关键节点：**
- `userData` 初始化
- `findCategoryInUserData(parentId)` - 查找父分类
- `cloneCategoryStructure(categoryId)` - 克隆分类结构（保留原有内容）
- `saveUserData()` - localStorage 写入
- `reloadData()` - 重新加载并合并内置数据和用户数据

### 3. 数据持久化层 (localStorage)

```typescript
STORAGE_KEY = 'prompt-editor-snippets'

// 保存
localStorage.setItem(STORAGE_KEY, JSON.stringify(userData))

// 加载
const stored = localStorage.getItem(STORAGE_KEY)
userData = JSON.parse(stored)
```

### 4. 数据合并机制

```
内置数据（snippets.json） + 用户数据（localStorage）
  ↓
mergeData() 方法
  ↓
合并策略：
  - 内置分类存在：合并 snippets 和 subcategories
  - 内置分类不存在：添加用户自定义分类到 root
  ↓
buildMaps() - 构建索引映射
```

## 日志系统使用指南

### 1. 查看日志

打开 Snippet Manager 管理面板，点击工具栏的 **📋 (View Logs)** 按钮。

### 2. 日志内容

日志记录了所有关键操作：
- 数据加载过程
- 表单提交事件
- API 调用详情
- localStorage 操作
- 错误和异常信息

### 3. 日志示例

```
[2026-04-15T12:22:00.123Z] [INFO] [SnippetManagerUI] saveCategory called
[2026-04-15T12:22:00.125Z] [INFO] [SnippetManagerUI] Form values extracted | Data: {"id":"test","name":"Test Category","icon":"📁","description":"","parentId":"ai-assistance"}
[2026-04-15T12:22:00.127Z] [INFO] [SnippetManager] addCategory called | Data: {"categoryId":"test","name":"Test Category","parentId":"ai-assistance"}
[2026-04-15T12:22:00.130Z] [INFO] [SnippetManager] Cloning built-in parent to user data | Data: {"parentId":"ai-assistance"}
[2026-04-15T12:22:00.132Z] [INFO] [SnippetManager] Calling saveUserData
[2026-04-15T12:22:00.135Z] [INFO] [SnippetManager] User data saved successfully
[2026-04-15T12:22:00.140Z] [INFO] [SnippetManager] Category saved successfully
```

### 4. 导出日志

点击日志视图中的 **Export All Logs** 按钮，日志会下载为 `.txt` 文件。

### 5. 清空日志

点击 **Clear Logs** 按钮，清空所有历史日志（用于开始新的排查）。

## 常见问题排查

### 问题 1：点击保存没有任何反应

**排查步骤：**

1. 打开日志面板
2. 尝试保存操作
3. 查看日志中的错误信息

**可能原因：**
- 表单元素未找到（检查 `hasId`, `hasName` 字段）
- 必填字段为空（检查验证日志）
- localStorage 写入失败（检查 ERROR 日志）
- JavaScript 异常（查看 stack trace）

### 问题 2：保存后原有分类消失

**排查步骤：**

1. 查看日志中的 `Cloning built-in parent` 信息
2. 检查 `subcategoryCount` 是否包含原有子分类
3. 查看合并后的数据结构

**修复状态：**
✅ 已修复 `cloneCategoryStructure` 方法，现在会保留原有 `snippets` 和 `subcategories`。

### 问题 3：localStorage 写入失败

**排查日志：**
```
[ERROR] [SnippetManager] Failed to save user snippets | Data: {"error":"...","storageKey":"prompt-editor-snippets"}
```

**可能原因：**
- localStorage 空间限制（~5MB）
- JSON.stringify 失败（循环引用）
- 浏览器限制 localStorage 访问

## 调试技巧

### 1. 分段测试

清空日志后，逐步操作：
1. 打开管理面板 → 查看加载日志
2. 填写表单 → 查看表单元素日志
3. 点击保存 → 查看保存流程日志
4. 关闭面板 → 查看数据持久化日志

### 2. 数据验证

在日志中查看：
- `categoryCount`: 分类数量
- `snippetCount`: snippet 总数
- `subcategoryCount`: 子分类数量（验证克隆是否正确）
- `size`: JSON 数据大小（检查 localStorage 限制）

### 3. 错误定位

查找 `[ERROR]` 标记：
- ERROR 日志会包含详细的错误信息和堆栈跟踪
- 根据错误类型定位问题层（UI / Manager / Storage）

## 架构说明

```
┌─────────────────────────────────────────────┐
│          macOS App (WKWebView)              │
├─────────────────────────────────────────────┤
│  editor/index.html (Single HTML Bundle)     │
│  ├─ snippet-manager-ui.ts (UI Layer)       │
│  ├─ snippet-manager.ts (Data Layer)        │
│  └─ logger.ts (Logging System)             │
├─────────────────────────────────────────────┤
│  localStorage (Persistence Layer)           │
│  └─ prompt-editor-snippets                  │
└─────────────────────────────────────────────┘
```

## 修复历史

### Bug #1: cloneCategoryStructure 清空原有内容

**问题：** 克隆内置分类时，清空了所有 `snippets` 和 `subcategories`，导致原有内容丢失。

**修复：**
```typescript
// 错误代码
return {
  id: category.id,
  name: category.name,
  icon: category.icon,
  description: category.description,
  snippets: [],  // ❌ 清空原有 snippets
  subcategories: undefined  // ❌ 清空原有 subcategories
};

// 修复代码
return {
  id: category.id,
  name: category.name,
  icon: category.icon,
  description: category.description,
  snippets: category.snippets ? [...category.snippets] : [],  // ✅ 保留原有
  subcategories: category.subcategories ? [...category.subcategories] : undefined  // ✅ 保留原有
};
```

### Bug #2: addCategory 替换 subcategories 数组

**问题：** 添加子分类时，替换父分类的整个 `subcategories` 数组，导致原有子分类消失。

**修复：**
```typescript
// 错误代码
clonedParent.subcategories = [category];  // ❌ 替换整个数组

// 修复代码
clonedParent.subcategories = clonedParent.subcategories || [];
clonedParent.subcategories.push(category);  // ✅ 添加到现有数组
```

## 联系支持

如果问题仍未解决：

1. 导出完整日志
2. 描述具体操作步骤
3. 提供期望结果和实际结果

日志文件会提供完整的错误追踪信息，帮助快速定位问题根源。