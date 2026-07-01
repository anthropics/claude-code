//! LSP (Language Server Protocol) tool for IDE features

use async_trait::async_trait;
use claude_core::{ClaudeError, ClaudeResult, PermissionResult, Tool, ToolContext, ToolDefinition, ToolInput, ToolOutput, ToolProgress, ToolValidation};
use serde_json::json;
use tracing::{info, instrument, warn};

/// LSP tool for IDE features
pub struct LSPTool {
    definition: ToolDefinition,
}

impl LSPTool {
    /// Create new LSP tool
    pub fn new() -> Self {
        Self {
            definition: ToolDefinition::new(
                "LSP",
                "Interact with Language Server Protocol servers for code analysis, completions, and diagnostics."
            )
            .with_schema(json!({
                "type": "object",
                "required": ["action", "file_path"],
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": ["hover", "definition", "references", "diagnostics", "symbols"],
                        "description": "LSP action to perform"
                    },
                    "file_path": {
                        "type": "string",
                        "description": "Path to the file"
                    },
                    "line": {
                        "type": "number",
                        "description": "Line number (0-indexed)"
                    },
                    "character": {
                        "type": "number",
                        "description": "Character position (0-indexed)"
                    }
                }
            }))
            .with_alias("lsp")
            .with_alias("language_server"),
        }
    }
}

impl Default for LSPTool {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Tool for LSPTool {
    fn definition(&self) -> &ToolDefinition {
        &self.definition
    }
    
    fn validate(&self, input: &ToolInput) -> ToolValidation {
        let has_action = input.get_string("action")
            .map(|a| ["hover", "definition", "references", "diagnostics", "symbols"].contains(&a.as_str()))
            .unwrap_or(false);
        
        let has_file = input.get_string("file_path")
            .map(|f| !f.is_empty())
            .unwrap_or(false);
        
        if !has_action {
            return ToolValidation::Invalid("action must be one of: hover, definition, references, diagnostics, symbols".to_string());
        }
        
        if !has_file {
            return ToolValidation::Invalid("file_path is required".to_string());
        }
        
        ToolValidation::Valid
    }
    
    fn check_permission(&self, _input: &ToolInput, _ctx: &ToolContext) -> PermissionResult {
        // Read-only, always allowed
        PermissionResult::Allowed
    }
    
    #[instrument(skip(self, input, context))]
    async fn execute(&self, input: ToolInput, context: ToolContext) -> ClaudeResult<ToolOutput> {
        let action = input.get_string("action")
            .ok_or_else(|| ClaudeError::validation("action", "Required parameter missing"))?;
        
        let file_path = input.get_string("file_path")
            .ok_or_else(|| ClaudeError::validation("file_path", "Required parameter missing"))?;
        
        let line = input.input.get("line")
            .and_then(|v| v.as_i64())
            .unwrap_or(0);
        
        let character = input.input.get("character")
            .and_then(|v| v.as_i64())
            .unwrap_or(0);
        
        info!("LSP {} on {} at {}:{}", action, file_path, line, character);
        
        // Placeholder implementation - would connect to actual LSP server
        // in production
        
        Ok(ToolOutput {
            content: format!(
                "LSP '{}' action on '{}' at line {}, char {}\n\n[LSP integration would connect to language server]",
                action,
                file_path,
                line,
                character
            ),
            is_error: false,
            metadata: Some(json!({
                "action": action,
                "file_path": file_path,
                "line": line,
                "character": character,
            })),
            suggestions: Some(vec![
                "Ensure language server is installed".to_string(),
                "LSP tool requires LSP server connection".to_string(),
            ]),
            progress: Vec::new(),
        })
    }
}

