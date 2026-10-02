//! Glob tool for finding files by pattern

use async_trait::async_trait;
use claude_core::{ClaudeError, ClaudeResult, PermissionResult, Tool, ToolContext, ToolDefinition, ToolInput, ToolOutput, ToolProgress, ToolValidation};
use serde_json::json;
use std::path::Path;
use ignore::Walk;
use tracing::{debug, info, instrument};

/// Maximum matches
const MAX_MATCHES: usize = 100;

/// Glob tool
pub struct GlobTool {
    definition: ToolDefinition,
}

impl GlobTool {
    /// Create new glob tool
    pub fn new() -> Self {
        Self {
            definition: ToolDefinition::new(
                "Glob",
                "Find files matching a glob pattern. Fast file discovery with pattern matching."
            )
            .with_schema(json!({
                "type": "object",
                "required": ["pattern"],
                "properties": {
                    "pattern": {
                        "type": "string",
                        "description": "The glob pattern to match (e.g., '*.rs', 'src/**/*.ts')"
                    },
                    "path": {
                        "type": "string",
                        "description": "The directory to search in (default: current working directory)"
                    }
                }
            }))
            .with_alias("glob")
            .with_alias("find")
            .with_alias("search_files"),
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
    
    /// Match path against glob pattern (simplified)
    fn glob_match(&self, pattern: &str, path: &Path) -> bool {
        // Very simplified glob matching - would use glob crate in production
        let pattern = pattern.replace("**", "*");
        
        if let Some(filename) = path.file_name().and_then(|n| n.to_str()) {
            // Simple wildcard matching
            if pattern.contains('*') {
                let parts: Vec<&str> = pattern.split('*').collect();
                if parts.len() == 2 {
                    return filename.starts_with(parts[0]) && filename.ends_with(parts[1]);
                }
            }
            pattern == filename || filename.ends_with(&pattern)
        } else {
            false
        }
    }
}

impl Default for GlobTool {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Tool for GlobTool {
    fn definition(&self) -> &ToolDefinition {
        &self.definition
    }
    
    fn validate(&self, input: &ToolInput) -> ToolValidation {
        match input.get_string("pattern") {
            Some(p) if !p.is_empty() => ToolValidation::Valid,
            _ => ToolValidation::Invalid("pattern is required".to_string()),
        }
    }
    
    fn check_permission(&self, _input: &ToolInput, _ctx: &ToolContext) -> PermissionResult {
        // Read-only, always allowed
        PermissionResult::Allowed
    }
    
    #[instrument(skip(self, input, context))]
    async fn execute(&self, input: ToolInput, context: ToolContext) -> ClaudeResult<ToolOutput> {
        let pattern = input.get_string("pattern")
            .ok_or_else(|| ClaudeError::validation("pattern", "Required parameter missing"))?;
        
        let search_path = self.resolve_path(
            input.get_string("path").as_deref(),
            &context.cwd
        );
        
        info!("Glob searching for '{}' in {}", pattern, search_path.display());
        
        let mut matches = Vec::new();
        let mut files_checked = 0;
        
        for entry in Walk::new(&search_path) {
            if let Ok(entry) = entry {
                let path = entry.path();
                
                if !path.is_file() {
                    continue;
                }
                
                files_checked += 1;
                
                // Check pattern match
                if self.glob_match(&pattern, path) {
                    matches.push(path.display().to_string());
                    
                    if matches.len() >= MAX_MATCHES {
                        break;
                    }
                }
            }
        }
        
        // Sort matches
        matches.sort();
        
        // Format output
        let output = if matches.is_empty() {
            format!(
                "No files matching '{}' found in {} (checked {} files)",
                pattern,
                search_path.display(),
                files_checked
            )
        } else {
            let mut lines = matches.clone();
            
            if matches.len() >= MAX_MATCHES {
                lines.push(format!(
                    "\n[Showing first {} matches]",
                    MAX_MATCHES
                ));
            }
            
            lines.push(format!(
                "\nFound {} files matching '{}'",
                matches.len(),
                pattern
            ));
            
            lines.join("\n")
        };
        
        Ok(ToolOutput {
            content: output,
            is_error: false,
            metadata: Some(json!({
                "pattern": pattern,
                "files_checked": files_checked,
                "matches_found": matches.len(),
            })),
            suggestions: None,
            progress: Vec::new(),
        })
    }
}

