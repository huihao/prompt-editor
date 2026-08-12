//! File Scanner Module - Phase 2
//! Provides file system scanning and caching for @ file references

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

/// File information structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
    pub path: String,
    pub relative_path: String,
    pub name: String,
    pub is_directory: bool,
    pub size: u64,
    pub last_modified: u64,
}

/// Scan configuration
#[derive(Debug, Clone)]
pub struct ScanConfig {
    pub max_depth: usize,
    pub max_files: usize,
    pub follow_symlinks: bool,
}

impl Default for ScanConfig {
    fn default() -> Self {
        Self {
            max_depth: 5,
            max_files: 10000,
            follow_symlinks: false,
        }
    }
}

/// Default ignore patterns
const DEFAULT_IGNORE: &[&str] = &[
    ".git",
    "node_modules",
    "target",
    "dist",
    "build",
    "__pycache__",
    ".venv",
    "venv",
    ".idea",
    ".vscode",
    ".next",
    ".nuxt",
    "coverage",
    ".coverage",
    "*.min.js",
    "*.min.css",
    ".DS_Store",
    "Thumbs.db",
];

/// Check if a path should be ignored
fn should_ignore(path: &Path, is_root: bool) -> bool {
    // Don't ignore root path even if it's hidden (e.g., temp dirs)
    if is_root {
        return false;
    }

    if let Some(name) = path.file_name() {
        let name = name.to_string_lossy();

        // Check exact matches
        for pattern in DEFAULT_IGNORE {
            if name == *pattern {
                return true;
            }
            // Check glob patterns
            if let Some(ext) = pattern.strip_prefix('*') {
                if name.ends_with(ext) {
                    return true;
                }
            }
        }

        // Ignore hidden files/dirs (starting with .)
        if name.starts_with('.') && name != "." && name != ".." {
            return true;
        }
    }
    false
}

/// Scan a directory and return file list
pub fn scan_directory<P: AsRef<Path>>(
    root: P,
    config: Option<ScanConfig>,
) -> Result<Vec<FileInfo>, Box<dyn std::error::Error>> {
    let root = root.as_ref();
    // Try to canonicalize, but fall back to absolute path if it fails
    let root = match root.canonicalize() {
        Ok(p) => p,
        Err(_) => std::env::current_dir()?.join(root),
    };

    if !root.exists() || !root.is_dir() {
        return Err("Path does not exist or is not a directory".into());
    }

    let config = config.unwrap_or_default();
    let mut files = Vec::new();

    scan_recursive(&root, &root, 0, &config, &mut files, true)?;

    Ok(files)
}

fn scan_recursive(
    root: &Path,
    current: &Path,
    depth: usize,
    config: &ScanConfig,
    files: &mut Vec<FileInfo>,
    is_root: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    // Check depth limit
    if depth > config.max_depth {
        return Ok(());
    }

    // Check file count limit
    if files.len() >= config.max_files {
        return Ok(());
    }

    // Skip ignored paths
    if should_ignore(current, is_root) {
        return Ok(());
    }

    // Read directory entries
    let entries = match std::fs::read_dir(current) {
        Ok(entries) => entries,
        Err(_) => return Ok(()), // Skip directories we can't read
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let metadata = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };

        // Calculate relative path
        let relative_path = match path.strip_prefix(root) {
            Ok(p) => p.to_string_lossy().to_string(),
            Err(_) => continue,
        };

        let name = entry.file_name().to_string_lossy().to_string();

        files.push(FileInfo {
            path: path.to_string_lossy().to_string(),
            relative_path,
            name,
            is_directory: metadata.is_dir(),
            size: metadata.len(),
            last_modified: metadata
                .modified()
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs())
                .unwrap_or(0),
        });

        // Recurse into subdirectories
        if metadata.is_dir() {
            scan_recursive(root, &path, depth + 1, config, files, false)?;
        }
    }

    Ok(())
}

/// Search files by query
pub fn search_files<'a>(files: &'a [FileInfo], query: &str) -> Vec<&'a FileInfo> {
    let query = query.to_lowercase();
    let mut results: Vec<&FileInfo> = files
        .iter()
        .filter(|f| {
            f.name.to_lowercase().contains(&query)
                || f.relative_path.to_lowercase().contains(&query)
        })
        .collect();

    // Sort by relevance
    results.sort_by(|a, b| {
        let a_exact = a.name.to_lowercase() == query;
        let b_exact = b.name.to_lowercase() == query;

        if a_exact && !b_exact {
            return std::cmp::Ordering::Less;
        }
        if b_exact && !a_exact {
            return std::cmp::Ordering::Greater;
        }

        let a_starts = a.name.to_lowercase().starts_with(&query);
        let b_starts = b.name.to_lowercase().starts_with(&query);

        if a_starts && !b_starts {
            return std::cmp::Ordering::Less;
        }
        if b_starts && !a_starts {
            return std::cmp::Ordering::Greater;
        }

        a.name.len().cmp(&b.name.len())
    });

    results
}

/// Read file content
pub fn read_file<P: AsRef<Path>>(path: P) -> Result<String, std::io::Error> {
    std::fs::read_to_string(path)
}

/// Read file content with size limit
pub fn read_file_limited<P: AsRef<Path>>(
    path: P,
    max_size: usize,
) -> Result<String, Box<dyn std::error::Error>> {
    let path = path.as_ref();
    let metadata = std::fs::metadata(path)?;

    if metadata.len() > max_size as u64 {
        // Read only first max_size bytes
        let content = std::fs::read(path)?;
        let truncated = &content[..max_size.min(content.len())];
        let mut result = String::from_utf8_lossy(truncated).to_string();
        result.push_str("\n... (file truncated)");
        return Ok(result);
    }

    Ok(std::fs::read_to_string(path)?)
}

/// File cache for fast lookups
pub struct FileCache {
    files: HashMap<String, FileInfo>,
    root_path: Option<PathBuf>,
}

impl FileCache {
    pub fn new() -> Self {
        Self {
            files: HashMap::new(),
            root_path: None,
        }
    }

    pub fn update(&mut self, files: Vec<FileInfo>) {
        self.files.clear();
        for file in files {
            self.files.insert(file.path.clone(), file);
        }
    }

    pub fn get(&self, path: &str) -> Option<&FileInfo> {
        self.files.get(path)
    }

    pub fn find_by_relative_path(&self, relative_path: &str) -> Option<&FileInfo> {
        self.files
            .values()
            .find(|f| f.relative_path == relative_path)
    }

    pub fn search(&self, query: &str) -> Vec<&FileInfo> {
        let query = query.to_lowercase();
        self.files
            .values()
            .filter(|f| {
                f.name.to_lowercase().contains(&query)
                    || f.relative_path.to_lowercase().contains(&query)
            })
            .collect()
    }

    pub fn all(&self) -> Vec<&FileInfo> {
        self.files.values().collect()
    }

    pub fn clear(&mut self) {
        self.files.clear();
        self.root_path = None;
    }
}

impl Default for FileCache {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_scan_directory() {
        let temp_dir = TempDir::new().unwrap();
        let root = temp_dir.path();

        eprintln!("Temp dir: {:?}", root);
        eprintln!("Temp dir exists: {}", root.exists());

        // Create test files
        std::fs::create_dir(root.join("src")).unwrap();
        std::fs::write(root.join("README.md"), "# Test").unwrap();
        std::fs::write(root.join("src/main.rs"), "fn main() {}").unwrap();

        eprintln!("Files created successfully");

        let files = scan_directory(root, None).unwrap();

        // Debug output
        eprintln!("Scanned {} files:", files.len());
        for f in &files {
            eprintln!(
                "  - {} ({}, is_dir={})",
                f.name, f.relative_path, f.is_directory
            );
        }

        assert!(
            files
                .iter()
                .any(|f| f.name == "README.md" && !f.is_directory),
            "README.md should be scanned"
        );
        assert!(
            files.iter().any(|f| f.name == "main.rs" && !f.is_directory),
            "main.rs should be scanned"
        );
        assert!(
            files.iter().any(|f| f.name == "src" && f.is_directory),
            "src directory should be scanned"
        );
        assert!(
            !files
                .iter()
                .any(|f| f.name.starts_with('.') && f.name != "." && f.name != ".."),
            "hidden files should be ignored"
        );
    }

    #[test]
    fn test_search_files() {
        let files = vec![
            FileInfo {
                path: "/test/main.rs".to_string(),
                relative_path: "main.rs".to_string(),
                name: "main.rs".to_string(),
                is_directory: false,
                size: 100,
                last_modified: 0,
            },
            FileInfo {
                path: "/test/lib.rs".to_string(),
                relative_path: "lib.rs".to_string(),
                name: "lib.rs".to_string(),
                is_directory: false,
                size: 100,
                last_modified: 0,
            },
        ];

        let results = search_files(&files, "main");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].name, "main.rs");
    }

    #[test]
    fn test_should_ignore() {
        assert!(should_ignore(Path::new("node_modules"), false));
        assert!(should_ignore(Path::new(".git"), false));
        assert!(should_ignore(Path::new(".hidden"), false));
        assert!(!should_ignore(Path::new("src"), false));
        // Root should not be ignored even if hidden
        assert!(!should_ignore(Path::new(".hidden"), true));
    }

    #[test]
    fn test_file_cache() {
        let mut cache = FileCache::new();

        let files = vec![FileInfo {
            path: "/test/main.rs".to_string(),
            relative_path: "main.rs".to_string(),
            name: "main.rs".to_string(),
            is_directory: false,
            size: 100,
            last_modified: 0,
        }];

        cache.update(files);

        assert!(cache.get("/test/main.rs").is_some());
        assert!(cache.find_by_relative_path("main.rs").is_some());
        assert_eq!(cache.search("main").len(), 1);
    }
}
