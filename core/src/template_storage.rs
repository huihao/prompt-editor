//! 模板和数据源存储模块
//!
//! 提供提示词模板和数据源的持久化存储功能

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// 变量类型
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum VariableType {
    #[default]
    Text,
    Textarea,
    Select,
    Multiselect,
    Number,
}

/// 数据源项
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataSourceItem {
    pub value: String,
    pub label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

/// 数据源类型
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DataSourceType {
    #[default]
    Static,
    Dynamic,
}

/// 数据源定义
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataSource {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default)]
    pub source_type: DataSourceType,
    pub items: Vec<DataSourceItem>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// 模板变量定义
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateVariable {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub variable_type: VariableType,
    pub label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub placeholder: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_value: Option<serde_json::Value>,
    #[serde(default)]
    pub required: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data_source_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub validation: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub order: Option<i32>,
}

/// 提示词模板
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptTemplate {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    pub content: String,
    pub variables: Vec<TemplateVariable>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
    #[serde(default)]
    pub is_builtin: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// 模板存储数据
#[derive(Debug, Serialize, Deserialize)]
struct TemplateStoreData {
    version: i32,
    templates: Vec<PromptTemplate>,
    last_updated: DateTime<Utc>,
}

impl Default for TemplateStoreData {
    fn default() -> Self {
        Self {
            version: 1,
            templates: Vec::new(),
            last_updated: Utc::now(),
        }
    }
}

/// 数据源存储数据
#[derive(Debug, Serialize, Deserialize)]
struct DataSourceStoreData {
    version: i32,
    data_sources: Vec<DataSource>,
    last_updated: DateTime<Utc>,
}

impl Default for DataSourceStoreData {
    fn default() -> Self {
        Self {
            version: 1,
            data_sources: Vec::new(),
            last_updated: Utc::now(),
        }
    }
}

/// 模板存储
pub struct TemplateStore {
    path: PathBuf,
    data: TemplateStoreData,
}

impl TemplateStore {
    /// 打开默认存储位置 (~/.prompt-editor/templates.json)
    pub fn open_default() -> Result<Self, String> {
        let dir = dirs::home_dir()
            .ok_or("Cannot find home directory")?
            .join(".prompt-editor");
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        Self::open(dir.join("templates.json"))
    }

    /// 打开指定路径的存储
    pub fn open(path: PathBuf) -> Result<Self, String> {
        let data = if path.exists() {
            let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            TemplateStoreData::default()
        };
        Ok(Self { path, data })
    }

    fn flush(&self) -> Result<(), String> {
        let json = serde_json::to_string_pretty(&self.data).map_err(|e| e.to_string())?;
        fs::write(&self.path, json).map_err(|e| e.to_string())
    }

    /// 获取所有模板
    pub fn list(&self) -> &[PromptTemplate] {
        &self.data.templates
    }

    /// 根据ID获取模板
    pub fn get(&self, id: &str) -> Option<&PromptTemplate> {
        self.data.templates.iter().find(|t| t.id == id)
    }

    /// 保存模板（新建或更新）
    pub fn save(&mut self, template: PromptTemplate) -> Result<(), String> {
        // 查找并更新或追加
        let mut found = false;
        for (i, t) in self.data.templates.iter().enumerate() {
            if t.id == template.id {
                self.data.templates[i] = template.clone();
                found = true;
                break;
            }
        }

        if !found {
            self.data.templates.push(template);
        }

        self.data.last_updated = Utc::now();
        self.flush()
    }

    /// 删除模板
    pub fn delete(&mut self, id: &str) -> Result<(), String> {
        let len_before = self.data.templates.len();
        self.data.templates.retain(|t| t.id != id);

        if self.data.templates.len() == len_before {
            return Err("Template not found".to_string());
        }

        self.data.last_updated = Utc::now();
        self.flush()
    }

    /// 搜索模板
    pub fn search(&self, query: &str) -> Vec<&PromptTemplate> {
        let query = query.to_lowercase();
        self.data
            .templates
            .iter()
            .filter(|t| {
                t.name.to_lowercase().contains(&query)
                    || t.description
                        .as_ref()
                        .map(|d| d.to_lowercase().contains(&query))
                        .unwrap_or(false)
                    || t.tags
                        .as_ref()
                        .map(|tags| tags.iter().any(|tag| tag.to_lowercase().contains(&query)))
                        .unwrap_or(false)
            })
            .collect()
    }

    /// 根据分类获取模板
    pub fn by_category(&self, category: &str) -> Vec<&PromptTemplate> {
        self.data
            .templates
            .iter()
            .filter(|t| t.category.as_ref().map(|c| c == category).unwrap_or(false))
            .collect()
    }

    /// 导出为JSON字符串
    pub fn to_json(&self) -> Result<String, String> {
        serde_json::to_string_pretty(&self.data).map_err(|e| e.to_string())
    }

    /// 从JSON字符串导入
    pub fn import_json(&mut self, json: &str) -> Result<(), String> {
        let data: TemplateStoreData = serde_json::from_str(json).map_err(|e| e.to_string())?;

        // 合并导入的数据，避免重复
        for template in data.templates {
            if self.get(&template.id).is_none() {
                self.data.templates.push(template);
            }
        }

        self.data.last_updated = Utc::now();
        self.flush()
    }
}

/// 数据源存储
pub struct DataSourceStore {
    path: PathBuf,
    data: DataSourceStoreData,
}

impl DataSourceStore {
    /// 打开默认存储位置 (~/.prompt-editor/datasources.json)
    pub fn open_default() -> Result<Self, String> {
        let dir = dirs::home_dir()
            .ok_or("Cannot find home directory")?
            .join(".prompt-editor");
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        Self::open(dir.join("datasources.json"))
    }

    /// 打开指定路径的存储
    pub fn open(path: PathBuf) -> Result<Self, String> {
        let data = if path.exists() {
            let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            DataSourceStoreData::default()
        };
        Ok(Self { path, data })
    }

    fn flush(&self) -> Result<(), String> {
        let json = serde_json::to_string_pretty(&self.data).map_err(|e| e.to_string())?;
        fs::write(&self.path, json).map_err(|e| e.to_string())
    }

    /// 获取所有数据源
    pub fn list(&self) -> &[DataSource] {
        &self.data.data_sources
    }

    /// 根据ID获取数据源
    pub fn get(&self, id: &str) -> Option<&DataSource> {
        self.data.data_sources.iter().find(|d| d.id == id)
    }

    /// 保存数据源（新建或更新）
    pub fn save(&mut self, data_source: DataSource) -> Result<(), String> {
        let mut found = false;
        for (i, d) in self.data.data_sources.iter().enumerate() {
            if d.id == data_source.id {
                self.data.data_sources[i] = data_source.clone();
                found = true;
                break;
            }
        }

        if !found {
            self.data.data_sources.push(data_source);
        }

        self.data.last_updated = Utc::now();
        self.flush()
    }

    /// 删除数据源
    pub fn delete(&mut self, id: &str) -> Result<(), String> {
        let len_before = self.data.data_sources.len();
        self.data.data_sources.retain(|d| d.id != id);

        if self.data.data_sources.len() == len_before {
            return Err("Data source not found".to_string());
        }

        self.data.last_updated = Utc::now();
        self.flush()
    }

    /// 搜索数据源
    pub fn search(&self, query: &str) -> Vec<&DataSource> {
        let query = query.to_lowercase();
        self.data
            .data_sources
            .iter()
            .filter(|d| {
                d.name.to_lowercase().contains(&query)
                    || d.description
                        .as_ref()
                        .map(|desc| desc.to_lowercase().contains(&query))
                        .unwrap_or(false)
            })
            .collect()
    }

    /// 导出为JSON字符串
    pub fn to_json(&self) -> Result<String, String> {
        serde_json::to_string_pretty(&self.data).map_err(|e| e.to_string())
    }

    /// 从JSON字符串导入
    pub fn import_json(&mut self, json: &str) -> Result<(), String> {
        let data: DataSourceStoreData = serde_json::from_str(json).map_err(|e| e.to_string())?;

        // 合并导入的数据
        for ds in data.data_sources {
            if self.get(&ds.id).is_none() {
                self.data.data_sources.push(ds);
            }
        }

        self.data.last_updated = Utc::now();
        self.flush()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use std::sync::atomic::{AtomicU64, Ordering};

    static COUNTER: AtomicU64 = AtomicU64::new(0);

    fn temp_template_store() -> TemplateStore {
        let id = COUNTER.fetch_add(1, Ordering::SeqCst);
        let path = env::temp_dir().join(format!(
            "prompt_editor_templates_{}_{}.json",
            std::process::id(),
            id
        ));
        let _ = fs::remove_file(&path);
        TemplateStore::open(path).unwrap()
    }

    fn temp_data_source_store() -> DataSourceStore {
        let id = COUNTER.fetch_add(1, Ordering::SeqCst);
        let path = env::temp_dir().join(format!(
            "prompt_editor_datasources_{}_{}.json",
            std::process::id(),
            id
        ));
        let _ = fs::remove_file(&path);
        DataSourceStore::open(path).unwrap()
    }

    fn create_test_template(id: &str) -> PromptTemplate {
        PromptTemplate {
            id: id.to_string(),
            name: format!("Test Template {}", id),
            description: Some("Test description".to_string()),
            category: Some("test".to_string()),
            content: "Hello {{name}}!".to_string(),
            variables: vec![TemplateVariable {
                id: "name".to_string(),
                name: "Name".to_string(),
                variable_type: VariableType::Text,
                label: "Your Name".to_string(),
                placeholder: Some("Enter name".to_string()),
                default_value: Some(serde_json::json!("World")),
                required: true,
                data_source_id: None,
                options: None,
                validation: None,
                order: Some(1),
            }],
            tags: Some(vec!["test".to_string()]),
            is_builtin: false,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    fn create_test_data_source(id: &str) -> DataSource {
        DataSource {
            id: id.to_string(),
            name: format!("Test DataSource {}", id),
            description: Some("Test description".to_string()),
            source_type: DataSourceType::Static,
            items: vec![
                DataSourceItem {
                    value: "option1".to_string(),
                    label: "Option 1".to_string(),
                    description: None,
                },
                DataSourceItem {
                    value: "option2".to_string(),
                    label: "Option 2".to_string(),
                    description: None,
                },
            ],
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    #[test]
    fn test_template_store_save_and_get() {
        let mut store = temp_template_store();
        let template = create_test_template("test1");

        store.save(template.clone()).unwrap();

        let retrieved = store.get("test1");
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().name, "Test Template test1");
    }

    #[test]
    fn test_template_store_update() {
        let mut store = temp_template_store();
        let mut template = create_test_template("test1");
        store.save(template.clone()).unwrap();

        template.name = "Updated Name".to_string();
        store.save(template).unwrap();

        let retrieved = store.get("test1").unwrap();
        assert_eq!(retrieved.name, "Updated Name");
        assert_eq!(store.list().len(), 1);
    }

    #[test]
    fn test_template_store_delete() {
        let mut store = temp_template_store();
        let template = create_test_template("test1");
        store.save(template).unwrap();

        store.delete("test1").unwrap();
        assert!(store.get("test1").is_none());
        assert_eq!(store.list().len(), 0);
    }

    #[test]
    fn test_template_store_search() {
        let mut store = temp_template_store();
        let mut template1 = create_test_template("test1");
        template1.name = "Hello World".to_string();
        let mut template2 = create_test_template("test2");
        template2.name = "Goodbye World".to_string();

        store.save(template1).unwrap();
        store.save(template2).unwrap();

        let results = store.search("hello");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].name, "Hello World");

        let results = store.search("world");
        assert_eq!(results.len(), 2);
    }

    #[test]
    fn test_template_store_persistence() {
        let id = COUNTER.fetch_add(1, Ordering::SeqCst);
        let path = env::temp_dir().join(format!("prompt_editor_persist_test_{}.json", id));
        let _ = fs::remove_file(&path);

        // 保存
        {
            let mut store = TemplateStore::open(path.clone()).unwrap();
            let template = create_test_template("persist");
            store.save(template).unwrap();
        }

        // 读取
        {
            let store = TemplateStore::open(path.clone()).unwrap();
            let retrieved = store.get("persist");
            assert!(retrieved.is_some());
            assert_eq!(retrieved.unwrap().name, "Test Template persist");
        }

        let _ = fs::remove_file(&path);
    }

    #[test]
    fn test_data_source_store_save_and_get() {
        let mut store = temp_data_source_store();
        let ds = create_test_data_source("ds1");

        store.save(ds.clone()).unwrap();

        let retrieved = store.get("ds1");
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().name, "Test DataSource ds1");
    }

    #[test]
    fn test_data_source_store_delete() {
        let mut store = temp_data_source_store();
        let ds = create_test_data_source("ds1");
        store.save(ds).unwrap();

        store.delete("ds1").unwrap();
        assert!(store.get("ds1").is_none());
    }

    #[test]
    fn test_data_source_store_items() {
        let mut store = temp_data_source_store();
        let ds = create_test_data_source("ds1");
        store.save(ds).unwrap();

        let retrieved = store.get("ds1").unwrap();
        assert_eq!(retrieved.items.len(), 2);
        assert_eq!(retrieved.items[0].value, "option1");
        assert_eq!(retrieved.items[1].label, "Option 2");
    }
}
