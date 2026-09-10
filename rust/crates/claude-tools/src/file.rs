//! File tools - Read, Write, Edit

use async_trait::async_trait;
use claude_core::{ClaudeError, ClaudeResult, PermissionResult, Tool, ToolContext, ToolDefinition, ToolInput, ToolOutput, ToolProgress, ToolValidation};
use serde_json::json;
use std::path::Path;
use tokio::fs;
use tracing::{debug, error, info, instrument, warn};

/// Maximum file size to read (50MB)
const MAX_FILE_SIZE: u64 = 50 * 1024 * 1024;

/// Maximum output size for previews
const MAX_PREVIEW_SIZE: usize = 50_000;

/// File read tool
pub struct FileReadTool {
    definition: ToolDefinition,
}

impl FileReadTool {
    /// Create new file read tool
    pub fn new() -> Self {
        Self {
            definition: ToolDefinition::new(
                "Read",
                "Read the contents of a file from the local filesystem. Returns file content as string."
            )
            .with_schema(json!({
                "type": "object",
                "required": ["file_path"],
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "The path of the file to read (relative or absolute)"
                    },
                    "offset": {
                        "type": "number",
                        "description": "Line number to start reading from (1-indexed)"
                    },
                    "limit": {
                        "type": "number",
                        "description": "Maximum number of lines to read"
                    }
                }
            }))
            .with_alias("read")
            .with_alias("file_read")
            .with_alias("cat"),
        }
    }
    
    /// Resolve path
    fn resolve_path(&self, path: &str, cwd: &str) -> ClaudeResult<std::path::PathBuf> {
        let path_obj = Path::new(path);
        
        if path_obj.is_absolute() {
            Ok(path_obj.to_path_buf())
        } else {
            Ok(Path::new(cwd).join(path))
        }
    }
}

impl Default for FileReadTool {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Tool for FileReadTool {
    fn definition(&self) -> &ToolDefinition {
        &self.definition
    }
    
    fn validate(&self, input: &ToolInput) -> ToolValidation {
        match input.get_string("file_path") {
            Some(path) if !path.is_empty() => ToolValidation::Valid,
            _ => ToolValidation::Invalid("file_path is required".to_string()),
        }
    }
    
    fn check_permission(&self, input: &ToolInput, ctx: &ToolContext) -> PermissionResult {
        // Read is always allowed
        PermissionResult::Allowed
    }
    
    #[instrument(skip(self, input, context))]
    async fn execute(&self, input: ToolInput, context: ToolContext) -> ClaudeResult<ToolOutput> {
        let file_path = input.get_string("file_path")
            .ok_or_else(|| ClaudeError::validation("file_path", "Required parameter missing"))?;
        
        let resolved = self.resolve_path(&file_path, &context.cwd)?;
        
        info!("Reading file: {}", resolved.display());
        
        // Check if exists and is file
        let metadata = fs::metadata(&resolved).await
            .map_err(|e| ClaudeError::tool("Read", format!(
                "Cannot access file '{}': {}", 
                resolved.display(), 
                e
            )))?;
        
        if !metadata.is_file() {
            return Err(ClaudeError::tool("Read", format!(
                "'{}' is not a file",
                resolved.display()
            )));
        }
        
        // Check size
        if metadata.len() > MAX_FILE_SIZE {
            return Err(ClaudeError::tool("Read", format!(
                "File '{}' is too large ({} bytes, max {})",
                resolved.display(),
                metadata.len(),
                MAX_FILE_SIZE
            )));
        }
        
        // Read content
        let content = fs::read_to_string(&resolved).await
            .map_err(|e| ClaudeError::tool("Read", format!(
                "Failed to read '{}': {}",
                resolved.display(),
                e
            )))?;
        
        // Handle offset and limit
        let offset = input.input.get("offset")
            .and_then(|v| v.as_i64())
            .map(|v| v.max(1) as usize)
            .unwrap_or(1);
        
        let limit = input.input.get("limit")
            .and_then(|v| v.as_i64())
            .map(|v| v.max(1) as usize);
        
        let lines: Vec<&str> = content.lines().collect();
        let total_lines = lines.len();
        
        let start_idx = (offset - 1).min(total_lines);
        let end_idx = limit
            .map(|l| (start_idx + l).min(total_lines))
            .unwrap_or(total_lines);
        
        let selected_lines = &lines[start_idx..end_idx];
        let result_content = selected_lines.join("\n");
        
        // Add truncation notice if needed
        let final_content = if offset > 1 || end_idx < total_lines {
            format!(
                "[Showing lines {}-{} of {}]\n{}",
                offset,
                end_idx,
                total_lines,
                result_content
            )
        } else {
            result_content
        };
        
        Ok(ToolOutput {
            content: final_content,
            is_error: false,
            metadata: Some(json!({
                "file_path": resolved.display().to_string(),
                "total_lines": total_lines,
                "shown_lines": end_idx - start_idx,
                "size_bytes": metadata.len(),
            })),
            suggestions: None,
            progress: Vec::new(),
        })
    }
}

/// File write tool
pub struct FileWriteTool {
    definition: ToolDefinition,
}

impl FileWriteTool {
    /// Create new file write tool
    pub fn new() -> Self {
        Self {
            definition: ToolDefinition::new(
                "Write",
                "Create a new file or overwrite an existing file with new content."
            )
            .with_schema(json!({
                "type": "object",
                "required": ["file_path", "content"],
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "The path of the file to write"
                    },
                    "content": {
                        "type": "string",
                        "description": "The content to write to the file"
                    }
                }
            }))
            .with_alias("write")
            .with_alias("file_write"),
        }
    }
    
    fn resolve_path(&self, path: &str, cwd: &str) -> ClaudeResult<std::path::PathBuf> {
        let path_obj = Path::new(path);
        
        if path_obj.is_absolute() {
            Ok(path_obj.to_path_buf())
        } else {
            Ok(Path::new(cwd).join(path))
        }
    }
}

impl Default for FileWriteTool {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Tool for FileWriteTool {
    fn definition(&self) -> &ToolDefinition {
        &self.definition
    }
    
    fn validate(&self, input: &ToolInput) -> ToolValidation {
        let has_path = input.get_string("file_path").map(|p| !p.is_empty()).unwrap_or(false);
        let has_content = input.input.get("content").is_some();
        
        if !has_path {
            return ToolValidation::Invalid("file_path is required".to_string());
        }
        
        if !has_content {
            return ToolValidation::Invalid("content is required".to_string());
        }
        
        ToolValidation::Valid
    }
    
    fn check_permission(&self, input: &ToolInput, ctx: &ToolContext) -> PermissionResult {
        // Check read-only mode
        if ctx.permission.mode == claude_core::PermissionMode::ReadOnly {
            return PermissionResult::Denied {
                reason: "Write operations disabled in read-only mode".to_string(),
            };
        }
        
        // Check auto-yes
        if ctx.permission.mode == claude_core::PermissionMode::AutoYes {
            return PermissionResult::Allowed;
        }
        
        // In normal mode, needs confirmation for writes
        match input.get_string("file_path") {
            Some(path) => PermissionResult::NeedsConfirmation {
                action: format!("Write file: {}", path),
            },
            None => PermissionResult::Invalid {
                reason: "Missing file_path".to_string(),
            },
        }
    }
    
    #[instrument(skip(self, input, context))]
    async fn execute(&self, input: ToolInput, context: ToolContext) -> ClaudeResult<ToolOutput> {
        let file_path = input.get_string("file_path")
            .ok_or_else(|| ClaudeError::validation("file_path", "Required parameter missing"))?;
        
        let content = input.get_string("content")
            .ok_or_else(|| ClaudeError::validation("content", "Required parameter missing"))?;
        
        let resolved = self.resolve_path(&file_path, &context.cwd)?;
        
        info!("Writing file: {}", resolved.display());
        
        // Ensure parent directory exists
        if let Some(parent) = resolved.parent() {
            fs::create_dir_all(parent).await
                .map_err(|e| ClaudeError::tool("Write", format!(
                    "Failed to create directory '{}': {}",
                    parent.display(),
                    e
                )))?;
        }
        
        // Check if overwriting
        let exists = resolved.exists();
        
        // Write content
        fs::write(&resolved, content).await
            .map_err(|e| ClaudeError::tool("Write", format!(
                "Failed to write '{}': {}",
                resolved.display(),
                e
            )))?;
        
        let size = content.len();
        
        Ok(ToolOutput {
            content: if exists {
                format!("Successfully overwrote {} ({} bytes)", resolved.display(), size)
            } else {
                format!("Successfully created {} ({} bytes)", resolved.display(), size)
            },
            is_error: false,
            metadata: Some(json!({
                "file_path": resolved.display().to_string(),
                "size_bytes": size,
                "overwrote": exists,
            })),
            suggestions: None,
            progress: Vec::new(),
        })
    }
}

/// File edit tool - search and replace
pub struct FileEditTool {
    definition: ToolDefinition,
}

impl FileEditTool {
    /// Create new file edit tool
    pub fn new() -> Self {
        Self {
            definition: ToolDefinition::new(
                "Edit",
                "Edit an existing file by replacing a specific string with another string."
            )
            .with_schema(json!({
                "type": "object",
                "required": ["file_path", "old_string", "new_string"],
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "The path of the file to edit"
                    },
                    "old_string": {
                        "type": "string",
                        "description": "The string to search for and replace"
                    },
                    "new_string": {
                        "type": "string",
                        "description": "The new string to replace with"
                    }
                }
            }))
            .with_alias("edit")
            .with_alias("replace")
            .with_alias("sed"),
        }
    }
    
    fn resolve_path(&self, path: &str, cwd: &str) -> ClaudeResult<std::path::PathBuf> {
        let path_obj = Path::new(path);
        
        if path_obj.is_absolute() {
            Ok(path_obj.to_path_buf())
        } else {
            Ok(Path::new(cwd).join(path))
        }
    }
}

impl Default for FileEditTool {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Tool for FileEditTool {
    fn definition(&self) -> &ToolDefinition {
        &self.definition
    }
    
    fn validate(&self, input: &ToolInput) -> ToolValidation {
        let has_path = input.get_string("file_path").map(|p| !p.is_empty()).unwrap_or(false);
        let has_old = input.input.get("old_string").is_some();
        let has_new = input.input.get("new_string").is_some();
        
        if !has_path {
            return ToolValidation::Invalid("file_path is required".to_string());
        }
        
        if !has_old {
            return ToolValidation::Invalid("old_string is required".to_string());
        }
        
        if !has_new {
            return ToolValidation::Invalid("new_string is required".to_string());
        }
        
        ToolValidation::Valid
    }
    
    fn check_permission(&self, input: &ToolInput, ctx: &ToolContext) -> PermissionResult {
        // Check read-only mode
        if ctx.permission.mode == claude_core::PermissionMode::ReadOnly {
            return PermissionResult::Denied {
                reason: "Edit operations disabled in read-only mode".to_string(),
            };
        }
        
        // Check auto-yes
        if ctx.permission.mode == claude_core::PermissionMode::AutoYes {
            return PermissionResult::Allowed;
        }
        
        // In normal mode, needs confirmation
        match input.get_string("file_path") {
            Some(path) => PermissionResult::NeedsConfirmation {
                action: format!("Edit file: {}", path),
            },
            None => PermissionResult::Invalid {
                reason: "Missing file_path".to_string(),
            },
        }
    }
    
    #[instrument(skip(self, input, context))]
    async fn execute(&self, input: ToolInput, context: ToolContext) -> ClaudeResult<ToolOutput> {
        let file_path = input.get_string("file_path")
            .ok_or_else(|| ClaudeError::validation("file_path", "Required parameter missing"))?;
        
        let old_string = input.get_string("old_string")
            .ok_or_else(|| ClaudeError::validation("old_string", "Required parameter missing"))?;
        
        let new_string = input.get_string("new_string")
            .ok_or_else(|| ClaudeError::validation("new_string", "Required parameter missing"))?;
        
        let resolved = self.resolve_path(&file_path, &context.cwd)?;
        
        info!("Editing file: {}", resolved.display());
        
        // Read existing content
        let content = fs::read_to_string(&resolved).await
            .map_err(|e| ClaudeError::tool("Edit", format!(
                "Failed to read '{}': {}",
                resolved.display(),
                e
            )))?;
        
        // Find and replace
        let occurrences = content.matches(&old_string).count();
        
        if occurrences == 0 {
            return Err(ClaudeError::tool("Edit", format!(
                "Could not find 'old_string' in {}. The text to replace must match exactly.",
                resolved.display()
            )));
        }
        
        if occurrences > 1 {
            return Err(ClaudeError::tool("Edit", format!(
                "Found {} occurrences of 'old_string' in {}. The replacement must be unique.",
                occurrences,
                resolved.display()
            )));
        }
        
        let new_content = content.replacen(&old_string, &new_string, 1);
        
        // Write back
        fs::write(&resolved, new_content).await
            .map_err(|e| ClaudeError::tool("Edit", format!(
                "Failed to write '{}': {}",
                resolved.display(),
                e
            )))?;
        
        Ok(ToolOutput {
            content: format!(
                "Successfully edited {} (replaced {} character string with {} character string)",
                resolved.display(),
                old_string.len(),
                new_string.len()
            ),
            is_error: false,
            metadata: Some(json!({
                "file_path": resolved.display().to_string(),
                "replacements": 1,
                "old_len": old_string.len(),
                "new_len": new_string.len(),
            })),
            suggestions: None,
            progress: Vec::new(),
        })
    }
}

