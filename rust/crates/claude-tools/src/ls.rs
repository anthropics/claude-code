//! LS tool for listing directory contents

use async_trait::async_trait;
use claude_core::{ClaudeError, ClaudeResult, PermissionResult, Tool, ToolContext, ToolDefinition, ToolInput, ToolOutput, ToolProgress, ToolValidation};
use serde_json::json;
use std::path::Path;
use tokio::fs;
use tracing::{debug, info, instrument};

/// LS (List) tool
pub struct LSTool {
    definition: ToolDefinition,
}

impl LSTool {
    /// Create new LS tool
    pub fn new() -> Self {
        Self {
            definition: ToolDefinition::new(
                "LS",
                "List files and directories in a specified path. Shows file details including permissions, size, and modification time."
            )
            .with_schema(json!({
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "The path to list (default: current working directory)"
                    }
                }
            }))
            .with_alias("ls")
            .with_alias("list")
            .with_alias("dir"),
        }
    }
    
    fn resolve_path(&self, path: Option<&str>, cwd: &str) -> std::path::PathBuf {
        match path {
            Some(p) => {
                let path_obj = Path::new(p);
                if path_obj.is_absolute() {
                    path_obj.to_path_buf()
                } else {
                    Path::new(cwd).join(p)
                }
            }
            None => Path::new(cwd).to_path_buf(),
        }
    }
}

impl Default for LSTool {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Tool for LSTool {
    fn definition(&self) -> &ToolDefinition {
        &self.definition
    }
    
    fn validate(&self, _input: &ToolInput) -> ToolValidation {
        // Path is optional
        ToolValidation::Valid
    }
    
    fn check_permission(&self, _input: &ToolInput, _ctx: &ToolContext) -> PermissionResult {
        // Read-only, always allowed
        PermissionResult::Allowed
    }
    
    #[instrument(skip(self, input, context))]
    async fn execute(&self, input: ToolInput, context: ToolContext) -> ClaudeResult<ToolOutput> {
        let path = self.resolve_path(
            input.get_string("path").as_deref(),
            &context.cwd
        );
        
        info!("Listing directory: {}", path.display());
        
        // Check if path exists
        let metadata = fs::metadata(&path).await
            .map_err(|e| ClaudeError::tool("LS", format!(
                "Cannot access '{}': {}",
                path.display(),
                e
            )))?;
        
        // If it's a file, just show info about the file
        if metadata.is_file() {
            return Ok(ToolOutput {
                content: format_file_info(&path, &metadata),
                is_error: false,
                metadata: Some(json!({
                    "path": path.display().to_string(),
                    "type": "file",
                    "size": metadata.len(),
                })),
                suggestions: None,
                progress: Vec::new(),
            });
        }
        
        // Read directory entries
        let mut entries = fs::read_dir(&path).await
            .map_err(|e| ClaudeError::tool("LS", format!(
                "Cannot read directory '{}': {}",
                path.display(),
                e
            )))?;
        
        let mut files: Vec<DirEntry> = Vec::new();
        
        while let Some(entry) = entries.next_entry().await.transpose() {
            if let Ok(entry) = entry {
                if let Ok(meta) = entry.metadata().await {
                    let name = entry.file_name().to_string_lossy().to_string();
                    let is_dir = meta.is_dir();
                    let size = if is_dir { None } else { Some(meta.len()) };
                    let modified = meta.modified().ok();
                    
                    files.push(DirEntry {
                        name,
                        is_dir,
                        size,
                        modified,
                    });
                }
            }
        }
        
        // Sort: directories first, then alphabetically
        files.sort_by(|a, b| {
            match (a.is_dir, b.is_dir) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => a.name.cmp(&b.name),
            }
        });
        
        // Format output
        let mut lines = vec![format!("{}/:", path.display())];
        lines.push(String::new());
        
        for entry in &files {
            let size_str = entry.size
                .map(format_size)
                .unwrap_or_else(|| "-".to_string());
            
            let type_indicator = if entry.is_dir { "d" } else { "-" };
            let name = if entry.is_dir {
                format!("{}/", entry.name)
            } else {
                entry.name.clone()
            };
            
            lines.push(format!("{} {:>10} {}", type_indicator, size_str, name));
        }
        
        lines.push(String::new());
        lines.push(format!(
            "Total: {} entries ({} directories, {} files)",
            files.len(),
            files.iter().filter(|e| e.is_dir).count(),
            files.iter().filter(|e| !e.is_dir).count()
        ));
        
        Ok(ToolOutput {
            content: lines.join("\n"),
            is_error: false,
            metadata: Some(json!({
                "path": path.display().to_string(),
                "type": "directory",
                "entry_count": files.len(),
            })),
            suggestions: None,
            progress: Vec::new(),
        })
    }
}

/// Directory entry
#[derive(Debug)]
struct DirEntry {
    name: String,
    is_dir: bool,
    size: Option<u64>,
    modified: Option<std::time::SystemTime>,
}

/// Format file size
fn format_size(bytes: u64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];
    
    if bytes == 0 {
        return "0 B".to_string();
    }
    
    let exp = (bytes as f64).log(1024.0).min(UNITS.len() as f64 - 1.0) as usize;
    let value = bytes as f64 / 1024_f64.powi(exp as i32);
    
    if exp == 0 {
        format!("{} {}", bytes, UNITS[exp])
    } else {
        format!("{:.1} {}", value, UNITS[exp])
    }
}

/// Format file info
fn format_file_info(path: &Path, metadata: &std::fs::Metadata) -> String {
    let size = format_size(metadata.len());
    format!(
        "- {:>10} {}",
        size,
        path.display()
    )
}

