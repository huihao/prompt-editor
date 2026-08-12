use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Prompt {
    pub id: u64,
    pub title: String,
    pub content: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
struct StoreData {
    next_id: u64,
    prompts: Vec<Prompt>,
}

impl Default for StoreData {
    fn default() -> Self {
        Self {
            next_id: 1,
            prompts: Vec::new(),
        }
    }
}

pub struct PromptStore {
    path: PathBuf,
    data: StoreData,
}

impl PromptStore {
    /// Open the default store location (~/.prompt-editor/prompts.json).
    pub fn open_default() -> Result<Self, String> {
        let dir = dirs::home_dir()
            .ok_or("Cannot find home directory")?
            .join(".prompt-editor");
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        Self::open(dir.join("prompts.json"))
    }

    /// Open a store at a specific path.
    pub fn open(path: PathBuf) -> Result<Self, String> {
        let data = if path.exists() {
            let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            StoreData::default()
        };
        Ok(Self { path, data })
    }

    fn flush(&self) -> Result<(), String> {
        let json = serde_json::to_string_pretty(&self.data).map_err(|e| e.to_string())?;
        fs::write(&self.path, json).map_err(|e| e.to_string())
    }

    /// Save a prompt. Returns its ID.
    pub fn save(&mut self, title: &str, content: &str) -> Result<u64, String> {
        let now = Utc::now();
        let id = self.data.next_id;
        self.data.next_id += 1;
        self.data.prompts.push(Prompt {
            id,
            title: title.to_string(),
            content: content.to_string(),
            created_at: now,
            updated_at: now,
        });
        self.flush()?;
        Ok(id)
    }

    /// Update an existing prompt by ID.
    pub fn update(&mut self, id: u64, title: &str, content: &str) -> Result<(), String> {
        let prompt = self
            .data
            .prompts
            .iter_mut()
            .find(|p| p.id == id)
            .ok_or("Prompt not found")?;
        prompt.title = title.to_string();
        prompt.content = content.to_string();
        prompt.updated_at = Utc::now();
        self.flush()
    }

    /// Delete a prompt by ID.
    pub fn delete(&mut self, id: u64) -> Result<(), String> {
        let len_before = self.data.prompts.len();
        self.data.prompts.retain(|p| p.id != id);
        if self.data.prompts.len() == len_before {
            return Err("Prompt not found".to_string());
        }
        self.flush()
    }

    /// List all prompts, most recent first.
    pub fn list(&self) -> &[Prompt] {
        &self.data.prompts
    }

    /// Get a prompt by ID.
    pub fn get(&self, id: u64) -> Option<&Prompt> {
        self.data.prompts.iter().find(|p| p.id == id)
    }

    /// List recent prompts (up to `limit`), most recent first.
    pub fn recent(&self, limit: usize) -> Vec<&Prompt> {
        self.data.prompts.iter().rev().take(limit).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use std::sync::atomic::{AtomicU64, Ordering};

    static COUNTER: AtomicU64 = AtomicU64::new(0);

    fn temp_store() -> PromptStore {
        let id = COUNTER.fetch_add(1, Ordering::SeqCst);
        let path = env::temp_dir().join(format!(
            "prompt_editor_test_{}_{}.json",
            std::process::id(),
            id
        ));
        let _ = fs::remove_file(&path);
        PromptStore::open(path).unwrap()
    }

    #[test]
    fn test_save_and_list() {
        let mut store = temp_store();
        let id = store.save("Test", "Hello world").unwrap();
        assert_eq!(id, 1);
        assert_eq!(store.list().len(), 1);
        assert_eq!(store.list()[0].content, "Hello world");
    }

    #[test]
    fn test_update() {
        let mut store = temp_store();
        let id = store.save("Test", "v1").unwrap();
        store.update(id, "Test Updated", "v2").unwrap();
        assert_eq!(store.get(id).unwrap().content, "v2");
        assert_eq!(store.get(id).unwrap().title, "Test Updated");
    }

    #[test]
    fn test_delete() {
        let mut store = temp_store();
        let id = store.save("Test", "content").unwrap();
        store.delete(id).unwrap();
        assert!(store.get(id).is_none());
        assert_eq!(store.list().len(), 0);
    }

    #[test]
    fn test_recent() {
        let mut store = temp_store();
        store.save("A", "1").unwrap();
        store.save("B", "2").unwrap();
        store.save("C", "3").unwrap();
        let recent = store.recent(2);
        assert_eq!(recent.len(), 2);
        assert_eq!(recent[0].title, "C");
        assert_eq!(recent[1].title, "B");
    }

    #[test]
    fn test_empty_store() {
        let store = temp_store();
        assert_eq!(store.list().len(), 0);
        assert!(store.get(1).is_none());
        assert_eq!(store.recent(10).len(), 0);
    }

    #[test]
    fn test_incrementing_ids() {
        let mut store = temp_store();
        let id1 = store.save("A", "1").unwrap();
        let id2 = store.save("B", "2").unwrap();
        let id3 = store.save("C", "3").unwrap();
        assert_eq!(id1, 1);
        assert_eq!(id2, 2);
        assert_eq!(id3, 3);
    }

    #[test]
    fn test_ids_not_reused_after_delete() {
        let mut store = temp_store();
        let id1 = store.save("A", "1").unwrap();
        store.delete(id1).unwrap();
        let id2 = store.save("B", "2").unwrap();
        assert!(id2 > id1);
    }

    #[test]
    fn test_delete_nonexistent() {
        let mut store = temp_store();
        let result = store.delete(999);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Prompt not found");
    }

    #[test]
    fn test_update_nonexistent() {
        let mut store = temp_store();
        let result = store.update(999, "X", "Y");
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Prompt not found");
    }

    #[test]
    fn test_persistence_roundtrip() {
        let id = COUNTER.fetch_add(1, Ordering::SeqCst);
        let path = env::temp_dir().join(format!(
            "prompt_editor_persist_{}_{}.json",
            std::process::id(),
            id
        ));
        let _ = fs::remove_file(&path);

        // Write
        {
            let mut store = PromptStore::open(path.clone()).unwrap();
            store.save("Persisted", "This should survive").unwrap();
        }

        // Read back
        {
            let store = PromptStore::open(path.clone()).unwrap();
            assert_eq!(store.list().len(), 1);
            assert_eq!(store.list()[0].title, "Persisted");
            assert_eq!(store.list()[0].content, "This should survive");
        }

        let _ = fs::remove_file(&path);
    }

    #[test]
    fn test_corrupted_json_fallback() {
        let id = COUNTER.fetch_add(1, Ordering::SeqCst);
        let path = env::temp_dir().join(format!(
            "prompt_editor_corrupt_{}_{}.json",
            std::process::id(),
            id
        ));
        fs::write(&path, "not valid json{{{").unwrap();

        let store = PromptStore::open(path.clone()).unwrap();
        // Should fall back to default empty store
        assert_eq!(store.list().len(), 0);

        let _ = fs::remove_file(&path);
    }

    #[test]
    fn test_unicode_content() {
        let mut store = temp_store();
        let id = store
            .save("中文标题", "你好世界 🌍 Ελληνικά العربية")
            .unwrap();
        let prompt = store.get(id).unwrap();
        assert_eq!(prompt.title, "中文标题");
        assert_eq!(prompt.content, "你好世界 🌍 Ελληνικά العربية");
    }

    #[test]
    fn test_empty_title_and_content() {
        let mut store = temp_store();
        let id = store.save("", "").unwrap();
        let prompt = store.get(id).unwrap();
        assert_eq!(prompt.title, "");
        assert_eq!(prompt.content, "");
    }

    #[test]
    fn test_large_content() {
        let mut store = temp_store();
        let large = "x".repeat(100_000);
        let id = store.save("Large", &large).unwrap();
        assert_eq!(store.get(id).unwrap().content.len(), 100_000);
    }

    #[test]
    fn test_special_chars_in_content() {
        let mut store = temp_store();
        let content = "quotes: \" ' \\ \n \t \r end";
        let id = store.save("Special", content).unwrap();
        assert_eq!(store.get(id).unwrap().content, content);
    }

    #[test]
    fn test_timestamps() {
        let mut store = temp_store();
        let id = store.save("Time", "test").unwrap();
        let prompt = store.get(id).unwrap();
        assert_eq!(prompt.created_at, prompt.updated_at);

        // Update should change updated_at
        store.update(id, "Time", "updated").unwrap();
        let prompt = store.get(id).unwrap();
        assert!(prompt.updated_at >= prompt.created_at);
    }

    #[test]
    fn test_recent_more_than_available() {
        let mut store = temp_store();
        store.save("A", "1").unwrap();
        let recent = store.recent(100);
        assert_eq!(recent.len(), 1);
    }

    #[test]
    fn test_recent_zero() {
        let mut store = temp_store();
        store.save("A", "1").unwrap();
        let recent = store.recent(0);
        assert_eq!(recent.len(), 0);
    }

    #[test]
    fn test_multiple_deletes() {
        let mut store = temp_store();
        let id1 = store.save("A", "1").unwrap();
        let id2 = store.save("B", "2").unwrap();
        let id3 = store.save("C", "3").unwrap();

        store.delete(id2).unwrap();
        assert_eq!(store.list().len(), 2);
        assert!(store.get(id1).is_some());
        assert!(store.get(id2).is_none());
        assert!(store.get(id3).is_some());

        store.delete(id1).unwrap();
        assert_eq!(store.list().len(), 1);
        assert_eq!(store.list()[0].id, id3);
    }

    #[test]
    fn test_update_preserves_created_at() {
        let mut store = temp_store();
        let id = store.save("A", "1").unwrap();
        let created = store.get(id).unwrap().created_at;
        store.update(id, "B", "2").unwrap();
        assert_eq!(store.get(id).unwrap().created_at, created);
    }

    #[test]
    fn test_markdown_content_storage() {
        let mut store = temp_store();
        let md = "# Heading\n\n- item 1\n- item 2\n\n```rust\nfn main() {}\n```";
        let id = store.save("Markdown", md).unwrap();
        assert_eq!(store.get(id).unwrap().content, md);
    }
}
