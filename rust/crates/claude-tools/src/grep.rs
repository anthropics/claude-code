//! Grep tool for searching file contents

use async_trait::async_trait;
use claude_core::{ClaudeError, ClaudeResult, PermissionResult, Tool, ToolContext, ToolDefinition, ToolInput, ToolOutput, ToolProgress, ToolValidation};
use serde_json::json;
use std::path::Path;
use tokio::fs;
use regex::Regex;
use ignore::Walk;
use tracing::{debug, error, info, instrument};

/// Maximum results to return
const MAX_RESULTS: usize = 100;

/// Grep tool
pub struct GrepTool {
    definition: ToolDefinition,
}

impl GrepTool {
    /// Create new grep tool
    pub fn new() -> Self {
        Self {
            definition: ToolDefinition::new(
                "Grep",
                "Search for text patterns in files using regex. Fast file content search with line numbers."
            )
            .with_schema(json!({
                "type": "object",
                "required": ["pattern"],
                "properties": {
                    "pattern": {
                        "type": "string",
                        "description": "The regex pattern to search for"
                    },
                    "path": {
                        "type": "string",
                        "description": "Directory or file to search in (default: current working directory)"
                    },
                    "include": {
                        "type": "string",
                        "description": "File glob pattern to include (e.g., '*.rs')"
                    }
                }
            }))
            .with_alias("grep")
            .with_alias("search")
            .with_alias("find"),
        }
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
        match input.get_string("pattern") {
            Some(p) if !p.is_empty() => {
                // Validate regex
                match Regex::new(&p) {
                    Ok(_) => ToolValidation::Valid,
                    Err(e) => ToolValidation::Invalid(format!("Invalid regex: {}", e)),
                }
            }
            _ => ToolValidation::Invalid("pattern is required".to_string()),
        }
    }
    
    fn check_permission(&self, _input: &ToolInput, _ctx: &ToolContext) -> PermissionResult {
        // Read-only, always allowed
        PermissionResult::Allowed
    }
    
    #[instrument(skip(self, input, context))]
    async fn execute(&self, input: ToolInput, context: ToolContext) -> ClaudeResult<ToolOutput> {
        let pattern_str = input.get_string("pattern")
            .ok_or_else(|| ClaudeError::validation("pattern", "Required parameter missing"))?;
        
        let regex = Regex::new(&pattern_str)
            .map_err(|e| ClaudeError::validation("pattern", &e.to_string()))?;
        
        let search_path = input.get_string("path")
            .map(|p| Path::new(&context.cwd).join(p))
            .unwrap_or_else(|| Path::new(&context.cwd).to_path_buf());
        
        let include_pattern = input.get_string("include");
        
        info!("Grep searching for '{}' in {}", pattern_str, search_path.display());
        
        let mut results = Vec::new();
        let mut files_searched = 0;
        let mut matches_found = 0;
        
        // If searching a specific file
        if search_path.is_file() {
            files_searched = 1;
            match search_file(&search_path, &regex).await {
                Ok(file_results) => {
                    matches_found += file_results.len();
                    results.extend(file_results);
                }
                Err(e) => {
                    debug!("Error searching {}: {}", search_path.display(), e);
                }
            }
        } else {
            // Walk directory
            for entry in Walk::new(&search_path) {
                if let Ok(entry) = entry {
                    let path = entry.path();
                    
                    // Skip directories
                    if !path.is_file() {
                        continue;
                    }
                    
                    // Check include pattern
                    if let Some(ref pattern) = include_pattern {
                        if let Some(filename) = path.file_name().and_then(|n| n.to_str()) {
                            if !glob_match(pattern, filename) {
                                continue;
                            }
                        }
                    }
                    
                    // Skip binary files by extension
                    if is_likely_binary(path) {
                        continue;
                    }
                    
                    files_searched += 1;
                    
                    match search_file(path, &regex).await {
                        Ok(file_results) => {
                            matches_found += file_results.len();
                            results.extend(file_results);
                            
                            if results.len() >= MAX_RESULTS {
                                break;
                            }
                        }
                        Err(e) => {
                            debug!("Error searching {}: {}", path.display(), e);
                        }
                    }
                }
            }
        }
        
        // Format results
        let output = if results.is_empty() {
            format!(
                "No matches found for '{}' in {} (searched {} files)",
                pattern_str,
                search_path.display(),
                files_searched
            )
        } else {
            let formatted: Vec<String> = results.iter()
                .map(|r| format!("{}:{}: {}", r.file, r.line, r.content.trim()))
                .collect();
            
            let mut output = formatted.join("\n");
            
            if matches_found > MAX_RESULTS {
                output.push_str(&format!(
                    "\n\n[Showing first {} of {} matches]",
                    MAX_RESULTS,
                    matches_found
                ));
            }
            
            output.push_str(&format!(
                "\n\nFound {} matches in {} files (searched {} files)",
                matches_found.min(MAX_RESULTS),
                results.iter().map(|r| &r.file).collect::<std::collections::HashSet<_>>().len(),
                files_searched
            ));
            
            output
        };
        
        Ok(ToolOutput {
            content: output,
            is_error: false,
            metadata: Some(json!({
                "pattern": pattern_str,
                "files_searched": files_searched,
                "matches_found": matches_found,
                "matches_shown": results.len(),
            })),
            suggestions: None,
            progress: Vec::new(),
        })
    }
}

/// Grep result
#[derive(Debug)]
struct GrepResult {
    file: String,
    line: usize,
    content: String,
}

/// Search a single file
async fn search_file(path: &Path, regex: &Regex) -> anyhow::Result<Vec<GrepResult>> {
    let content = fs::read_to_string(path).await?;
    let mut results = Vec::new();
    
    for (i, line) in content.lines().enumerate() {
        if regex.is_match(line) {
            results.push(GrepResult {
                file: path.display().to_string(),
                line: i + 1,
                content: line.to_string(),
            });
        }
    }
    
    Ok(results)
}

/// Simple glob matching
fn glob_match(pattern: &str, text: &str) -> bool {
    // Simple wildcard matching - could use glob crate for full support
    if pattern.contains('*') {
        let parts: Vec<&str> = pattern.split('*').collect();
        if parts.len() == 2 {
            text.starts_with(parts[0]) && text.ends_with(parts[1])
        } else {
            true
        }
    } else {
        pattern == text
    }
}

/// Check if file is likely binary
fn is_likely_binary(path: &Path) -> bool {
    let binary_extensions = [
        ".exe", ".dll", ".so", ".dylib", ".bin", ".o", ".a",
        ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".ico",
        ".mp3", ".mp4", ".avi", ".mov", ".mkv",
        ".zip", ".tar", ".gz", ".bz2", ".7z",
        ".pdf", ".doc", ".docx",
    ];
    
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        let ext_lower = format!(".{}", ext.to_lowercase());
        binary_extensions.iter().any(|&be| ext_lower == be)
    } else {
        false
    }
}

