//! File indexing for fast search

use ignore::Walk;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

/// File index entry
#[derive(Debug, Clone)]
pub struct FileEntry {
    /// Relative path
    pub path: String,
    /// Absolute path
    pub absolute: PathBuf,
    /// File size
    pub size: u64,
    /// Is directory
    pub is_dir: bool,
}

/// File index
pub struct FileIndex {
    root: String,
    files: Arc<RwLock<HashMap<String, FileEntry>>>,
}

impl FileIndex {
    /// Create new file index
    pub fn new(root: impl Into<String>) -> Self {
        Self {
            root: root.into(),
            files: Arc::new(RwLock::new(HashMap::new())),
        }
    }
    
    /// Build index
    pub async fn build(&self) -> anyhow::Result<()> {
        let mut files = self.files.write().await;
        files.clear();
        
        let root_path = std::path::Path::new(&self.root);
        
        for result in Walk::new(&root_path) {
            if let Ok(entry) = result {
                let path = entry.path();
                if let Ok(metadata) = std::fs::metadata(path) {
                    let relative = path.strip_prefix(&root_path)
                        .unwrap_or(path)
                        .to_string_lossy()
                        .to_string();
                    
                    files.insert(relative.clone(), FileEntry {
                        path: relative,
                        absolute: path.to_path_buf(),
                        size: metadata.len(),
                        is_dir: metadata.is_dir(),
                    });
                }
            }
        }
        
        Ok(())
    }
    
    /// Get file by path
    pub async fn get(&self, path: &str) -> Option<FileEntry> {
        self.files.read().await.get(path).cloned()
    }
    
    /// Search files by pattern
    pub async fn search(&self, pattern: &str) -> Vec<FileEntry> {
        let files = self.files.read().await;
        files
            .values()
            .filter(|e| e.path.contains(pattern))
            .cloned()
            .collect()
    }
    
    /// Get file count
    pub async fn count(&self) -> usize {
        self.files.read().await.len()
    }
}

