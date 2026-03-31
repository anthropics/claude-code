//! File tool implementation

use async_trait::async_trait;
use claude_core::{ClaudeError, ClaudeResult, PermissionResult, ToolContext, ToolDefinition, ToolInput, ToolOutput, ToolValidation};
use claude_core::tool::Tool;
use serde_json::Value;
use tokio::fs;

/// File tool for read/write operations
pub struct FileTool {
    definition: ToolDefinition,
    max_file_size: usize,
}

impl FileTool {
    /// Create a new file tool
    pub fn new() -> Self {
        let definition = ToolDefinition::new(
            "File",
            "Read from or write to files",
        )
        .with_schema(serde_json::json!({
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Path to the file"
                },
                "operation": {
                    "type": "string",
                    "enum": ["read", "write", "append"],
                    "description": "File operation to perform"
                },
                "content": {
                    "type": "string",
                    "description": "Content to write (for write/append)"
                }
            },
            "required": ["path", "operation"]
        }));
        
        Self {
            definition,
            max_file_size: 10 * 1024 * 1024, // 10MB
        }
    }
    
    /// Validate file path
    fn validate_path(&self, path: &str, ctx: &ToolContext) -> ToolValidation {
        let full_path = std::path::Path::new(&ctx.cwd).join(path);
        
        if path.contains("..") {
            return ToolValidation::Invalid("Path traversal not allowed".to_string());
        }
        
        if !ctx.permission.is_path_allowed(full_path.to_str().unwrap_or("")) {
            return ToolValidation::Invalid("Path not in allowed directories".to_string());
        }
        
        ToolValidation::Valid
    }
}

impl Default for FileTool {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Tool for FileTool {
    fn definition(&self) -> &ToolDefinition {
        &self.definition
    }
    
    fn validate(&self, input: &ToolInput) -> ToolValidation {
        let path = input.input.get("path").and_then(Value::as_str);
        let operation = input.input.get("operation").and_then(Value::as_str);
        
        if path.is_none() {
            return ToolValidation::Invalid("Missing 'path' field".to_string());
        }
        
        match operation {
            Some("read") | Some("write") | Some("append") => ToolValidation::Valid,
            Some(other) => ToolValidation::Invalid(format!("Unknown operation: {}", other)),
            None => ToolValidation::Invalid("Missing 'operation' field".to_string()),
        }
    }
    
    fn check_permission(&self, input: &ToolInput, ctx: &ToolContext) -> PermissionResult {
        let path = input.input.get("path").and_then(Value::as_str).unwrap_or("");
        let operation = input.input.get("operation").and_then(Value::as_str).unwrap_or("read");
        
        match self.validate_path(path, ctx) {
            ToolValidation::Valid => {
                if operation == "write" || operation == "append" {
                    PermissionResult::NeedsConfirmation {
                        action: format!("{} to {}", operation, path)
                    }
                } else {
                    PermissionResult::Allowed
                }
            }
            ToolValidation::Invalid(reason) => PermissionResult::Denied { reason },
        }
    }
    
    async fn execute(&self, input: ToolInput, context: ToolContext) -> ClaudeResult<ToolOutput> {
        let path = input.input.get("path").and_then(Value::as_str).ok_or_else(|| ClaudeError::Validation {
            field: "path".to_string(),
            message: "Required field".to_string(),
        })?;
        
        let operation = input.input.get("operation").and_then(Value::as_str).unwrap_or("read");
        let full_path = std::path::Path::new(&context.cwd).join(path);
        
        match operation {
            "read" => {
                let metadata = fs::metadata(&full_path).await.map_err(|e| ClaudeError::Io(e))?;
                
                if metadata.len() > self.max_file_size as u64 {
                    return Err(ClaudeError::Validation {
                        field: "path".to_string(),
                        message: format!("File too large: {} bytes (max: {})", metadata.len(), self.max_file_size),
                    });
                }
                
                let content = fs::read_to_string(&full_path).await.map_err(|e| ClaudeError::Io(e))?;
                Ok(ToolOutput::success(content))
            }
            "write" => {
                let content = input.input.get("content").and_then(Value::as_str).unwrap_or("");
                fs::write(&full_path, content).await.map_err(|e| ClaudeError::Io(e))?;
                Ok(ToolOutput::success(format!("Wrote {} bytes to {}", content.len(), path)))
            }
            "append" => {
                let content = input.input.get("content").and_then(Value::as_str).unwrap_or("");
                let mut file = fs::OpenOptions::new()
                    .create(true)
                    .append(true)
                    .open(&full_path).await
                    .map_err(|e| ClaudeError::Io(e))?;
                use tokio::io::AsyncWriteExt;
                file.write_all(content.as_bytes()).await.map_err(|e| ClaudeError::Io(e))?;
                Ok(ToolOutput::success(format!("Appended {} bytes to {}", content.len(), path)))
            }
            _ => Err(ClaudeError::Tool {
                tool: "file".to_string(),
                message: format!("Unknown operation: {}", operation),
            }),
        }
    }
}

