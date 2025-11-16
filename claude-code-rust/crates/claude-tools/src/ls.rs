//! Ls tool for directory listing
//!
//! This module provides a tool for listing directory contents

use async_trait::async_trait;
use claude_core::{Result, Tool, ToolInput, ToolResult};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::path::Path;
use tokio::fs;

#[derive(Debug, Deserialize)]
struct LsInput {
    #[serde(default)]
    path: Option<String>,
    #[serde(default)]
    all: bool,
    #[serde(default)]
    long: bool,
}

#[derive(Debug, Serialize, Deserialize)]
struct LsOutput {
    entries: Vec<LsEntry>,
    total: usize,
}

#[derive(Debug, Serialize, Deserialize)]
struct LsEntry {
    name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    size: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    is_dir: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    is_symlink: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    modified: Option<String>,
}

/// Tool for listing directory contents
pub struct LsTool;

impl LsTool {
    pub fn new() -> Self {
        Self
    }

    async fn list_directory(&self, path: &Path, all: bool, long: bool) -> Result<LsOutput> {
        if !path.exists() {
            return Err(anyhow::anyhow!("Path does not exist: {}", path.display()).into());
        }

        if !path.is_dir() {
            return Err(anyhow::anyhow!("Path is not a directory: {}", path.display()).into());
        }

        let mut entries = Vec::new();
        let mut read_dir = fs::read_dir(path)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to read directory: {}", e))?;

        while let Some(entry) = read_dir
            .next_entry()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to read directory entry: {}", e))?
        {
            let file_name = entry.file_name();
            let name = file_name.to_string_lossy().to_string();

            // Skip hidden files unless -a flag is set
            if !all && name.starts_with('.') {
                continue;
            }

            let metadata = entry.metadata().await.ok();

            let ls_entry = if long {
                LsEntry {
                    name: name.clone(),
                    size: metadata.as_ref().map(|m| m.len()),
                    is_dir: metadata.as_ref().map(|m| m.is_dir()),
                    is_symlink: metadata.as_ref().map(|m| m.is_symlink()),
                    modified: metadata.and_then(|m| m.modified().ok().map(|t| format!("{:?}", t))),
                }
            } else {
                LsEntry {
                    name: name.clone(),
                    size: None,
                    is_dir: None,
                    is_symlink: None,
                    modified: None,
                }
            };

            entries.push(ls_entry);
        }

        // Sort entries: directories first, then alphabetically
        entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
            (Some(true), Some(false)) => std::cmp::Ordering::Less,
            (Some(false), Some(true)) => std::cmp::Ordering::Greater,
            _ => a.name.cmp(&b.name),
        });

        let total = entries.len();

        Ok(LsOutput { entries, total })
    }
}

impl Default for LsTool {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Tool for LsTool {
    fn name(&self) -> &str {
        "Ls"
    }

    fn description(&self) -> &str {
        "Lists directory contents similar to the ls command"
    }

    fn input_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "The directory path to list (default: current directory)"
                },
                "all": {
                    "type": "boolean",
                    "description": "Show hidden files (default: false)"
                },
                "long": {
                    "type": "boolean",
                    "description": "Use long listing format with details (default: false)"
                }
            }
        })
    }

    async fn execute(&self, input: ToolInput) -> Result<ToolResult> {
        let ls_input: LsInput = serde_json::from_value(input.parameters)
            .map_err(|e| anyhow::anyhow!("Invalid input: {}", e))?;

        let path = Path::new(ls_input.path.as_deref().unwrap_or("."));

        match self.list_directory(path, ls_input.all, ls_input.long).await {
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
    async fn test_ls_tool() {
        let temp_dir = TempDir::new().unwrap();
        let base = temp_dir.path();

        // Create test files and directories
        fs::write(base.join("file1.txt"), "content").unwrap();
        fs::write(base.join("file2.txt"), "content").unwrap();
        fs::create_dir(base.join("subdir")).unwrap();
        fs::write(base.join(".hidden"), "hidden content").unwrap();

        let tool = LsTool::new();
        let input = ToolInput::new(json!({
            "path": base.to_str().unwrap()
        }))
        .unwrap();

        let result = tool.execute(input).await.unwrap();
        assert!(result.success);

        let output: LsOutput = serde_json::from_value(result.output.unwrap()).unwrap();
        // Should not include hidden file
        assert_eq!(output.total, 3);
    }

    #[tokio::test]
    async fn test_ls_tool_with_all() {
        let temp_dir = TempDir::new().unwrap();
        let base = temp_dir.path();

        fs::write(base.join("file.txt"), "content").unwrap();
        fs::write(base.join(".hidden"), "hidden content").unwrap();

        let tool = LsTool::new();
        let input = ToolInput::new(json!({
            "path": base.to_str().unwrap(),
            "all": true
        }))
        .unwrap();

        let result = tool.execute(input).await.unwrap();
        assert!(result.success);

        let output: LsOutput = serde_json::from_value(result.output.unwrap()).unwrap();
        // Should include hidden file
        assert_eq!(output.total, 2);
    }

    #[tokio::test]
    async fn test_ls_tool_long_format() {
        let temp_dir = TempDir::new().unwrap();
        let base = temp_dir.path();

        fs::write(base.join("file.txt"), "content").unwrap();
        fs::create_dir(base.join("subdir")).unwrap();

        let tool = LsTool::new();
        let input = ToolInput::new(json!({
            "path": base.to_str().unwrap(),
            "long": true
        }))
        .unwrap();

        let result = tool.execute(input).await.unwrap();
        assert!(result.success);

        let output: LsOutput = serde_json::from_value(result.output.unwrap()).unwrap();
        assert_eq!(output.total, 2);

        // Check that long format includes metadata
        for entry in &output.entries {
            assert!(entry.is_dir.is_some());
        }
    }
}
