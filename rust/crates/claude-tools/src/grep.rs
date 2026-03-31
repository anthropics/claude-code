//! Grep tool implementation

use async_trait::async_trait;
use claude_core::{ClaudeResult, PermissionResult, ToolContext, ToolDefinition, ToolInput, ToolOutput, ToolValidation};
use claude_core::tool::Tool;
use regex::Regex;
use serde_json::Value;
use std::collections::HashMap;

/// Grep tool for file searching
pub struct GrepTool {
    definition: ToolDefinition,
}

impl GrepTool {
    /// Create a new grep tool
    pub fn new() -> Self {
        let definition = ToolDefinition::new(
            "Grep",
            "Search file contents using regex",
        )
        .with_schema(serde_json::json!({
            "type": "object",
            "properties": {
                "pattern": {
                    "type": "string",
                    "description": "Regex pattern to search for"
                },
                "paths": {
                    "type": "array",
                    "items": { "type": "string" },
                    "description": "Paths to search (default: current directory)"
                },
                "file_pattern": {
                    "type": "string",
                    "description": "File pattern to match (e.g., '*.rs')"
                }
            },
            "required": ["pattern"]
        }));
        
        Self { definition }
    }
}

impl Default for GrepTool {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Tool for GrepTool {
    fn definition(&self) -> &ToolDefinition {
        &self.definition
    }
    
    fn validate(&self, input: &ToolInput) -> ToolValidation {
        match input.input.get("pattern").and_then(Value::as_str) {
            Some(_) => ToolValidation::Valid,
            None => ToolValidation::Invalid("Missing 'pattern' field".to_string()),
        }
    }
    
    fn check_permission(&self, _input: &ToolInput, _ctx: &ToolContext) -> PermissionResult {
        PermissionResult::Allowed
    }
    
    async fn execute(&self, input: ToolInput, context: ToolContext) -> ClaudeResult<ToolOutput> {
        let pattern_str = input.input.get("pattern").and_then(Value::as_str).unwrap_or("");
        let paths = input.input.get("paths").and_then(Value::as_array).map(|arr| {
            arr.iter()
                .filter_map(Value::as_str)
                .map(String::from)
                .collect::<Vec<_>>()
        }).unwrap_or_else(|| vec![".".to_string()]);
        
        let file_pattern = input.input.get("file_pattern").and_then(Value::as_str);
        
        let regex = Regex::new(pattern_str).map_err(|e| claude_core::ClaudeError::Validation {
            field: "pattern".to_string(),
            message: e.to_string(),
        })?;
        
        let mut results = HashMap::new();
        let mut total_matches = 0;
        
        for path in paths {
            let full_path = std::path::Path::new(&context.cwd).join(&path);
            
            for result in ignore::Walk::new(&full_path) {
                if let Ok(entry) = result {
                    let path = entry.path();
                    
                    if let Some(pattern) = file_pattern {
                        if let Some(filename) = path.file_name() {
                            let filename = filename.to_string_lossy();
                            if !filename.matches(pattern).any(|_| true) {
                                continue;
                            }
                        }
                    }
                    
                    if path.is_file() {
                        if let Ok(content) = std::fs::read_to_string(path) {
                            let mut file_matches = Vec::new();
                            
                            for (line_num, line) in content.lines().enumerate() {
                                if regex.is_match(line) {
                                    file_matches.push(format!("{}: {}", line_num + 1, line));
                                    total_matches += 1;
                                    
                                    if total_matches >= 100 {
                                        break;
                                    }
                                }
                            }
                            
                            if !file_matches.is_empty() {
                                results.insert(
                                    path.strip_prefix(&context.cwd).unwrap_or(path).to_string_lossy().to_string(),
                                    file_matches,
                                );
                            }
                        }
                    }
                }
            }
        }
        
        let output = if results.is_empty() {
            "No matches found".to_string()
        } else {
            let mut lines = Vec::new();
            for (file, matches) in results {
                lines.push(format!("\n{file}:"));
                for m in matches {
                    lines.push(format!("  {m}"));
                }
            }
            lines.join("\n")
        };
        
        Ok(ToolOutput::success(output))
    }
}

