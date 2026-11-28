//! File cache with TTL

use dashmap::DashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

/// Cached file entry
#[derive(Debug, Clone)]
pub struct CacheEntry {
    /// File content
    pub content: String,
    /// Metadata
    pub modified: std::time::SystemTime,
    /// Cache time
    pub cached_at: Instant,
}

/// File cache with TTL
pub struct FileCache {
    cache: Arc<DashMap<String, CacheEntry>>,
    ttl: Duration,
    max_size: usize,
}

impl FileCache {
    /// Create new file cache
    pub fn new() -> Self {
        Self {
            cache: Arc::new(DashMap::new()),
            ttl: Duration::from_secs(300), // 5 minutes
            max_size: 100 * 1024 * 1024, // 100MB
        }
    }
    
    /// Get entry if not expired
    pub fn get(&self, path: &str) -> Option<CacheEntry> {
        let entry = self.cache.get(path)?;
        if entry.cached_at.elapsed() < self.ttl {
            Some(entry.clone())
        } else {
            drop(entry);
            self.cache.remove(path);
            None
        }
    }
    
    /// Insert entry
    pub fn insert(&self, path: String, content: String, modified: std::time::SystemTime) {
        if content.len() > self.max_size {
            return;
        }
        
        let entry = CacheEntry {
            content,
            modified,
            cached_at: Instant::now(),
        };
        self.cache.insert(path, entry);
    }
    
    /// Clear cache
    pub fn clear(&self) {
        self.cache.clear();
    }
}

impl Default for FileCache {
    fn default() -> Self {
        Self::new()
    }
}

