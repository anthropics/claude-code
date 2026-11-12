//! LS tool implementation

use async_trait::async_trait;
use claude_core::{ClaudeResult, PermissionResult, ToolContext, ToolDefinition, ToolInput, ToolOutput, ToolValidation};
use claude_core::tool::Tool;
use serde_json::Value;
use tokio::fs;

/// LS tool for directory listing
pub struct LSTool {
    definition: ToolDefinition,
}

impl LSTool {
    /// Create a new LS tool
    pub fn new() -> Self {
        let definition = ToolDefinition::new(
            "LS",
            "List files and directories",
        )
        .with_schema(serde_json::json!({
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Directory path to list (default: current directory)"
                },
                "recursive": {
                    "type": "boolean",
                    "description": "List recursively",
                    "default": false
                }
            }
        }));
        
        Self { definition }
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
        ToolValidation::Valid
    }
    
    fn check_permission(&self, _input: &ToolInput, _ctx: &ToolContext) -> PermissionResult {
        PermissionResult::Allowed
    }
    
    async fn execute(&self, input: ToolInput, context: ToolContext) -> ClaudeResult<ToolOutput> {
        let path = input.input.get("path").and_then(Value::as_str).unwrap_or(".");
        let _recursive = input.input.get("recursive").and_then(Value::as_bool).unwrap_or(false);
        
        let full_path = std::path::Path::new(&context.cwd).join(path);
        
        let mut output = Vec::new();
        output.push(format!("Directory listing of {}:\n", path));
        
        let mut entries = fs::read_dir(&full_path).await.map_err(|e| claude_core::ClaudeError::Io(e))?;
        
        while let Some(entry) = entries.next_entry().await.map_err(|e| claude_core::ClaudeError::Io(e))? {
            let metadata = entry.metadata().await.ok();
            let name = entry.file_name().to_string_lossy().to_string();
            
            let prefix = if metadata.as_ref().map(|m| m.is_dir()).unwrap_or(false) {
                "📁"
            } else {
                "📄"
            };
            
            let size = metadata.as_ref()
                .map(|m| format!(" ({})", human_bytes(m.len())))
                .unwrap_or_default();
            
            output.push(format!("  {} {}{}", prefix, name, size));
        }
        
        Ok(ToolOutput::success(output.join("\n")))
    }
}

/// Format bytes in human readable form
fn human_bytes(bytes: u64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];
    let mut size = bytes as f64;
    let mut unit_idx = 0;
    
    while size >= 1024.0 && unit_idx < UNITS.len() - 1 {
        size /= 1024.0;
        unit_idx += 1;
    }
    
    format!("{:.1} {}", size, UNITS[unit_idx])
}

