//! Search tools for finding files and content
//!
//! This module provides:
//! - GlobTool: Pattern-based file finding
//! - GrepTool: Content search with regex

use async_trait::async_trait;
use claude_core::{Result, Tool, ToolInput, ToolResult};
use globset::GlobBuilder;
use grep_regex::RegexMatcherBuilder;
use grep_searcher::sinks::UTF8;
use grep_searcher::SearcherBuilder;
use regex::RegexBuilder;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

// ============================================================================
// GlobTool
// ============================================================================

#[derive(Debug, Deserialize)]
struct GlobInput {
    pattern: String,
    #[serde(default)]
    path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct GlobOutput {
    files: Vec<String>,
    count: usize,
}

/// Tool for finding files using glob patterns
pub struct GlobTool;

impl GlobTool {
    pub fn new() -> Self {
        Self
    }

    async fn find_files(&self, pattern: &str, base_path: Option<&str>) -> Result<Vec<String>> {
        let glob = GlobBuilder::new(pattern)
            .literal_separator(true)
            .build()
            .map_err(|e| anyhow::anyhow!("Invalid glob pattern: {}", e))?
            .compile_matcher();

        let search_path = base_path.unwrap_or(".");
        let base = Path::new(search_path);

        if !base.exists() {
            return Err(anyhow::anyhow!("Path does not exist: {}", search_path).into());
        }

        let mut files: Vec<PathBuf> = Vec::new();

        for entry in WalkDir::new(base)
            .follow_links(false)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            if path.is_file() {
                // Try matching both absolute and relative paths
                if glob.is_match(path) {
                    files.push(path.to_path_buf());
                } else if let Ok(relative) = path.strip_prefix(base) {
                    if glob.is_match(relative) {
                        files.push(path.to_path_buf());
                    }
                }
            }
        }

        // Sort by modification time (most recent first)
        files.sort_by(|a, b| {
            let a_time = a.metadata().and_then(|m| m.modified()).ok();
            let b_time = b.metadata().and_then(|m| m.modified()).ok();
            b_time.cmp(&a_time)
        });

        Ok(files
            .into_iter()
            .map(|p| p.to_string_lossy().to_string())
            .collect())
    }
}

impl Default for GlobTool {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Tool for GlobTool {
    fn name(&self) -> &str {
        "Glob"
    }

    fn description(&self) -> &str {
        "Fast file pattern matching using glob patterns (e.g., **/*.rs, src/**/*.txt)"
    }

    fn input_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "pattern": {
                    "type": "string",
                    "description": "The glob pattern to match files against (e.g., **/*.rs)"
                },
                "path": {
                    "type": "string",
                    "description": "The directory to search in (default: current directory)"
                }
            },
            "required": ["pattern"]
        })
    }

    async fn execute(&self, input: ToolInput) -> Result<ToolResult> {
        let glob_input: GlobInput = serde_json::from_value(input.parameters)
            .map_err(|e| anyhow::anyhow!("Invalid input: {}", e))?;

        match self
            .find_files(&glob_input.pattern, glob_input.path.as_deref())
            .await
        {
            Ok(files) => {
                let count = files.len();
                let output = GlobOutput { files, count };
                Ok(ToolResult::success(json!(output)))
            }
            Err(e) => Ok(ToolResult::error(e.to_string())),
        }
    }
}

// ============================================================================
// GrepTool
// ============================================================================

#[derive(Debug, Deserialize)]
struct GrepInput {
    pattern: String,
    #[serde(default)]
    path: Option<String>,
    #[serde(default)]
    glob: Option<String>,
    #[serde(default)]
    output_mode: Option<String>,
    #[serde(default, rename = "-i")]
    case_insensitive: bool,
    #[serde(default, rename = "-A")]
    after_context: Option<usize>,
    #[serde(default, rename = "-B")]
    before_context: Option<usize>,
    #[serde(default, rename = "-C")]
    context: Option<usize>,
    #[serde(default)]
    multiline: bool,
    #[serde(default)]
    head_limit: Option<usize>,
}

#[derive(Debug, Serialize, Deserialize)]
struct GrepOutput {
    #[serde(skip_serializing_if = "Option::is_none")]
    matches: Option<Vec<GrepMatch>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    files: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    counts: Option<Vec<FileCount>>,
}

#[derive(Debug, Serialize, Deserialize)]
struct GrepMatch {
    file: String,
    line_number: usize,
    content: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct FileCount {
    file: String,
    count: usize,
}

/// Tool for searching file contents using regex
pub struct GrepTool;

impl GrepTool {
    pub fn new() -> Self {
        Self
    }

    async fn search_files(&self, input: GrepInput) -> Result<GrepOutput> {
        let search_path = input.path.as_deref().unwrap_or(".");
        let base = Path::new(search_path);

        if !base.exists() {
            return Err(anyhow::anyhow!("Path does not exist: {}", search_path).into());
        }

        // Build regex matcher
        let regex = RegexBuilder::new(&input.pattern)
            .case_insensitive(input.case_insensitive)
            .multi_line(input.multiline)
            .dot_matches_new_line(input.multiline)
            .build()
            .map_err(|e| anyhow::anyhow!("Invalid regex pattern: {}", e))?;

        // Build glob matcher if specified
        let glob_matcher = if let Some(glob_pattern) = &input.glob {
            Some(
                GlobBuilder::new(glob_pattern)
                    .literal_separator(true)
                    .build()
                    .map_err(|e| anyhow::anyhow!("Invalid glob pattern: {}", e))?
                    .compile_matcher(),
            )
        } else {
            None
        };

        let output_mode = input.output_mode.as_deref().unwrap_or("files_with_matches");

        match output_mode {
            "content" => {
                let matches = self
                    .search_content(&regex, base, glob_matcher.as_ref(), &input)
                    .await?;
                Ok(GrepOutput {
                    matches: Some(matches),
                    files: None,
                    counts: None,
                })
            }
            "files_with_matches" => {
                let files = self
                    .search_files_only(&regex, base, glob_matcher.as_ref())
                    .await?;
                Ok(GrepOutput {
                    matches: None,
                    files: Some(files),
                    counts: None,
                })
            }
            "count" => {
                let counts = self
                    .search_count(&regex, base, glob_matcher.as_ref())
                    .await?;
                Ok(GrepOutput {
                    matches: None,
                    files: None,
                    counts: Some(counts),
                })
            }
            _ => Err(anyhow::anyhow!("Invalid output_mode: {}", output_mode).into()),
        }
    }

    async fn search_content(
        &self,
        regex: &regex::Regex,
        base: &Path,
        glob_matcher: Option<&globset::GlobMatcher>,
        input: &GrepInput,
    ) -> Result<Vec<GrepMatch>> {
        let mut all_matches = Vec::new();

        // Determine context lines
        let before = input.before_context.or(input.context).unwrap_or(0);
        let after = input.after_context.or(input.context).unwrap_or(0);

        for entry in WalkDir::new(base)
            .follow_links(false)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }

            // Check glob filter
            if let Some(matcher) = glob_matcher {
                if !matcher.is_match(path) {
                    if let Ok(relative) = path.strip_prefix(base) {
                        if !matcher.is_match(relative) {
                            continue;
                        }
                    } else {
                        continue;
                    }
                }
            }

            // Search in file using grep-searcher's regex support
            let matcher = RegexMatcherBuilder::new()
                .case_insensitive(input.case_insensitive)
                .multi_line(input.multiline)
                .build(regex.as_str())
                .map_err(|e| anyhow::anyhow!("Failed to create matcher: {}", e))?;

            let mut searcher = SearcherBuilder::new()
                .before_context(before)
                .after_context(after)
                .line_number(true)
                .build();

            let mut file_matches = Vec::new();
            let path_str = path.to_string_lossy().to_string();

            searcher
                .search_path(
                    &matcher,
                    path,
                    UTF8(|lnum, line| {
                        file_matches.push(GrepMatch {
                            file: path_str.clone(),
                            line_number: lnum as usize,
                            content: line.trim_end().to_string(),
                        });
                        Ok(true)
                    }),
                )
                .ok();

            all_matches.extend(file_matches);
        }

        // Apply head_limit if specified
        if let Some(limit) = input.head_limit {
            all_matches.truncate(limit);
        }

        Ok(all_matches)
    }

    async fn search_files_only(
        &self,
        regex: &regex::Regex,
        base: &Path,
        glob_matcher: Option<&globset::GlobMatcher>,
    ) -> Result<Vec<String>> {
        let mut files = Vec::new();

        for entry in WalkDir::new(base)
            .follow_links(false)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }

            // Check glob filter
            if let Some(matcher) = glob_matcher {
                if !matcher.is_match(path) {
                    if let Ok(relative) = path.strip_prefix(base) {
                        if !matcher.is_match(relative) {
                            continue;
                        }
                    } else {
                        continue;
                    }
                }
            }

            // Check if file contains pattern
            if let Ok(content) = std::fs::read_to_string(path) {
                if regex.is_match(&content) {
                    files.push(path.to_string_lossy().to_string());
                }
            }
        }

        Ok(files)
    }

    async fn search_count(
        &self,
        regex: &regex::Regex,
        base: &Path,
        glob_matcher: Option<&globset::GlobMatcher>,
    ) -> Result<Vec<FileCount>> {
        let mut counts = Vec::new();

        for entry in WalkDir::new(base)
            .follow_links(false)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }

            // Check glob filter
            if let Some(matcher) = glob_matcher {
                if !matcher.is_match(path) {
                    if let Ok(relative) = path.strip_prefix(base) {
                        if !matcher.is_match(relative) {
                            continue;
                        }
                    } else {
                        continue;
                    }
                }
            }

            // Count matches in file
            if let Ok(content) = std::fs::read_to_string(path) {
                let count = regex.find_iter(&content).count();
                if count > 0 {
                    counts.push(FileCount {
                        file: path.to_string_lossy().to_string(),
                        count,
                    });
                }
            }
        }

        Ok(counts)
    }
}

impl Default for GrepTool {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Tool for GrepTool {
    fn name(&self) -> &str {
        "Grep"
    }

    fn description(&self) -> &str {
        "Powerful search tool for finding content in files using regex patterns"
    }

    fn input_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "pattern": {
                    "type": "string",
                    "description": "The regular expression pattern to search for"
                },
                "path": {
                    "type": "string",
                    "description": "File or directory to search in (default: current directory)"
                },
                "glob": {
                    "type": "string",
                    "description": "Glob pattern to filter files (e.g., *.js, **/*.tsx)"
                },
                "output_mode": {
                    "type": "string",
                    "enum": ["content", "files_with_matches", "count"],
                    "description": "Output mode: content (matching lines), files_with_matches (file paths), count (match counts)"
                },
                "-i": {
                    "type": "boolean",
                    "description": "Case insensitive search"
                },
                "-A": {
                    "type": "number",
                    "description": "Number of lines to show after each match"
                },
                "-B": {
                    "type": "number",
                    "description": "Number of lines to show before each match"
                },
                "-C": {
                    "type": "number",
                    "description": "Number of lines to show before and after each match"
                },
                "multiline": {
                    "type": "boolean",
                    "description": "Enable multiline mode where . matches newlines"
                },
                "head_limit": {
                    "type": "number",
                    "description": "Limit output to first N results"
                }
            },
            "required": ["pattern"]
        })
    }

    async fn execute(&self, input: ToolInput) -> Result<ToolResult> {
        let grep_input: GrepInput = serde_json::from_value(input.parameters)
            .map_err(|e| anyhow::anyhow!("Invalid input: {}", e))?;

        match self.search_files(grep_input).await {
            Ok(output) => Ok(ToolResult::success(json!(output))),
            Err(e) => Ok(ToolResult::error(e.to_string())),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_glob_tool() {
        let temp_dir = TempDir::new().unwrap();
        let base = temp_dir.path();

        // Create test files
        fs::write(base.join("test1.rs"), "fn main() {}").unwrap();
        fs::write(base.join("test2.rs"), "fn test() {}").unwrap();
        fs::write(base.join("readme.md"), "# README").unwrap();

        let tool = GlobTool::new();
        let input = ToolInput::new(json!({
            "pattern": "**/*.rs",
            "path": base.to_str().unwrap()
        }))
        .unwrap();

        let result = tool.execute(input).await.unwrap();
        assert!(result.success);

        let output: GlobOutput = serde_json::from_value(result.output.unwrap()).unwrap();
        assert_eq!(output.count, 2);
    }

    #[tokio::test]
    async fn test_grep_tool_files_mode() {
        let temp_dir = TempDir::new().unwrap();
        let base = temp_dir.path();

        // Create test files
        fs::write(base.join("test1.txt"), "Hello World").unwrap();
        fs::write(base.join("test2.txt"), "Goodbye World").unwrap();
        fs::write(base.join("test3.txt"), "No match here").unwrap();

        let tool = GrepTool::new();
        let input = ToolInput::new(json!({
            "pattern": "World",
            "path": base.to_str().unwrap(),
            "output_mode": "files_with_matches"
        }))
        .unwrap();

        let result = tool.execute(input).await.unwrap();
        assert!(result.success);

        let output: GrepOutput = serde_json::from_value(result.output.unwrap()).unwrap();
        assert_eq!(output.files.unwrap().len(), 2);
    }

    #[tokio::test]
    async fn test_grep_tool_content_mode() {
        let temp_dir = TempDir::new().unwrap();
        let base = temp_dir.path();

        fs::write(
            base.join("test.txt"),
            "Line 1: Hello\nLine 2: World\nLine 3: Hello",
        )
        .unwrap();

        let tool = GrepTool::new();
        let input = ToolInput::new(json!({
            "pattern": "Hello",
            "path": base.to_str().unwrap(),
            "output_mode": "content"
        }))
        .unwrap();

        let result = tool.execute(input).await.unwrap();
        assert!(result.success);

        let output: GrepOutput = serde_json::from_value(result.output.unwrap()).unwrap();
        assert_eq!(output.matches.unwrap().len(), 2);
    }
}
