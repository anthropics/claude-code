//! File operations wrapper

use tokio::fs;
use tokio::io::AsyncWriteExt;

/// Async file operations
pub struct FileOperations;

impl FileOperations {
    /// Read file to string
    pub async fn read_string(path: impl AsRef<std::path::Path>) -> std::io::Result<String> {
        fs::read_to_string(path).await
    }
    
    /// Read file to bytes
    pub async fn read_bytes(path: impl AsRef<std::path::Path>) -> std::io::Result<Vec<u8>> {
        fs::read(path).await
    }
    
    /// Write string to file
    pub async fn write_string(
        path: impl AsRef<std::path::Path>,
        content: impl AsRef<[u8]>,
    ) -> std::io::Result<()> {
        fs::write(path, content).await
    }
    
    /// Append to file
    pub async fn append(
        path: impl AsRef<std::path::Path>,
        content: impl AsRef<[u8]>,
    ) -> std::io::Result<()> {
        let mut file = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(path).await?;
        file.write_all(content.as_ref()).await
    }
    
    /// Check if file exists
    pub async fn exists(path: impl AsRef<std::path::Path>) -> bool {
        fs::try_exists(path).await.unwrap_or(false)
    }
    
    /// Get file metadata
    pub async fn metadata(path: impl AsRef<std::path::Path>) -> std::io::Result<std::fs::Metadata> {
        fs::metadata(path).await
    }
    
    /// Create directory
    pub async fn create_dir(path: impl AsRef<std::path::Path>) -> std::io::Result<()> {
        fs::create_dir_all(path).await
    }
    
    /// Remove file
    pub async fn remove_file(path: impl AsRef<std::path::Path>) -> std::io::Result<()> {
        fs::remove_file(path).await
    }
    
    /// Copy file
    pub async fn copy(
        from: impl AsRef<std::path::Path>,
        to: impl AsRef<std::path::Path>,
    ) -> std::io::Result<u64> {
        fs::copy(from, to).await
    }
}

