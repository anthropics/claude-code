//! File operation tools
//!
//! This module provides tools for file operations:
//! - ReadTool: Read file contents with optional line ranges
//! - WriteTool: Write file contents
//! - EditTool: Replace text in files

use async_trait::async_trait;
use claude_core::{Result, Tool, ToolInput, ToolResult};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::path::Path;
use tokio::fs;
use tokio::io::{AsyncBufReadExt, BufReader};

// ============================================================================
// ReadTool
// ============================================================================

#[derive(Debug, Deserialize)]
struct ReadInput {
    file_path: String,
    #[serde(default)]
    offset: Option<usize>,
    #[serde(default)]
    limit: Option<usize>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ReadOutput {
    content: String,
    line_count: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    offset: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    limit: Option<usize>,
}

/// Tool for reading file contents
pub struct ReadTool;

impl ReadTool {
    pub fn new() -> Self {
        Self
    }

    async fn read_file_lines(
        &self,
        path: &Path,
        offset: Option<usize>,
        limit: Option<usize>,
    ) -> Result<(String, usize)> {
        let file = fs::File::open(path).await.map_err(|e| {
            anyhow::anyhow!("Failed to open file '{}': {}", path.display(), e)
        })?;

        let reader = BufReader::new(file);
        let mut lines = reader.lines();
        let mut result = Vec::new();
        let mut line_num = 0;
        let offset_val = offset.unwrap_or(0);
        let limit_val = limit.unwrap_or(usize::MAX);

        while let Some(line) = lines.next_line().await.map_err(|e| {
            anyhow::anyhow!("Failed to read line from '{}': {}", path.display(), e)
        })? {
            line_num += 1;

            // Skip lines before offset
            if line_num <= offset_val {
                continue;
            }

            // Stop if we've read enough lines
            if result.len() >= limit_val {
                break;
            }

            // Truncate lines longer than 2000 characters
            let truncated_line = if line.len() > 2000 {
                format!("{}...[truncated]", &line[..2000])
            } else {
                line
            };

            // Format with line number (cat -n style)
            result.push(format!("{:6}→{}", line_num, truncated_line));
        }

        let content = result.join("\n");
        Ok((content, line_num))
    }
}

impl Default for ReadTool {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Tool for ReadTool {
    fn name(&self) -> &str {
        "Read"
    }

    fn description(&self) -> &str {
        "Reads file contents with optional line ranges. Results are formatted with line numbers."
    }

    fn input_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "file_path": {
                    "type": "string",
                    "description": "The absolute path to the file to read"
                },
                "offset": {
                    "type": "number",
                    "description": "The line number to start reading from (optional)"
                },
                "limit": {
                    "type": "number",
                    "description": "The number of lines to read (optional)"
                }
            },
            "required": ["file_path"]
        })
    }

    async fn execute(&self, input: ToolInput) -> Result<ToolResult> {
        let read_input: ReadInput = serde_json::from_value(input.parameters)
            .map_err(|e| anyhow::anyhow!("Invalid input: {}", e))?;

        let path = Path::new(&read_input.file_path);

        if !path.exists() {
            return Ok(ToolResult::error(&format!(
                "File does not exist: {}",
                read_input.file_path
            )));
        }

        if !path.is_file() {
            return Ok(ToolResult::error(&format!(
                "Path is not a file: {}",
                read_input.file_path
            )));
        }

        match self
            .read_file_lines(path, read_input.offset, read_input.limit)
            .await
        {
            Ok((content, line_count)) => {
                let output = ReadOutput {
                    content,
                    line_count,
                    offset: read_input.offset,
                    limit: read_input.limit,
                };
                Ok(ToolResult::success(json!(output)))
            }
            Err(e) => Ok(ToolResult::error(&e.to_string())),
        }
    }
}

// ============================================================================
// WriteTool
// ============================================================================

#[derive(Debug, Deserialize)]
struct WriteInput {
    file_path: String,
    content: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct WriteOutput {
    bytes_written: usize,
    file_path: String,
}

/// Tool for writing file contents
pub struct WriteTool;

impl WriteTool {
    pub fn new() -> Self {
        Self
    }
}

impl Default for WriteTool {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Tool for WriteTool {
    fn name(&self) -> &str {
        "Write"
    }

    fn description(&self) -> &str {
        "Writes content to a file, overwriting if it exists"
    }

    fn input_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "file_path": {
                    "type": "string",
                    "description": "The absolute path to the file to write"
                },
                "content": {
                    "type": "string",
                    "description": "The content to write to the file"
                }
            },
            "required": ["file_path", "content"]
        })
    }

    async fn execute(&self, input: ToolInput) -> Result<ToolResult> {
        let write_input: WriteInput = serde_json::from_value(input.parameters)
            .map_err(|e| anyhow::anyhow!("Invalid input: {}", e))?;

        let path = Path::new(&write_input.file_path);

        // Create parent directories if they don't exist
        if let Some(parent) = path.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent).await.map_err(|e| {
                    anyhow::anyhow!(
                        "Failed to create parent directories for '{}': {}",
                        write_input.file_path,
                        e
                    )
                })?;
            }
        }

        match fs::write(path, &write_input.content).await {
            Ok(_) => {
                let output = WriteOutput {
                    bytes_written: write_input.content.len(),
                    file_path: write_input.file_path,
                };
                Ok(ToolResult::success(json!(output)))
            }
            Err(e) => Ok(ToolResult::error(&format!(
                "Failed to write file: {}",
                e
            ))),
        }
    }
}

// ============================================================================
// EditTool
// ============================================================================

#[derive(Debug, Deserialize)]
struct EditInput {
    file_path: String,
    old_string: String,
    new_string: String,
    #[serde(default)]
    replace_all: bool,
}

#[derive(Debug, Serialize, Deserialize)]
struct EditOutput {
    replacements: usize,
    file_path: String,
}

/// Tool for editing files by replacing text
pub struct EditTool;

impl EditTool {
    pub fn new() -> Self {
        Self
    }
}

impl Default for EditTool {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Tool for EditTool {
    fn name(&self) -> &str {
        "Edit"
    }

    fn description(&self) -> &str {
        "Performs exact string replacements in files"
    }

    fn input_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "file_path": {
                    "type": "string",
                    "description": "The absolute path to the file to edit"
                },
                "old_string": {
                    "type": "string",
                    "description": "The text to replace"
                },
                "new_string": {
                    "type": "string",
                    "description": "The text to replace it with"
                },
                "replace_all": {
                    "type": "boolean",
                    "description": "Replace all occurrences (default: false)"
                }
            },
            "required": ["file_path", "old_string", "new_string"]
        })
    }

    async fn execute(&self, input: ToolInput) -> Result<ToolResult> {
        let edit_input: EditInput = serde_json::from_value(input.parameters)
            .map_err(|e| anyhow::anyhow!("Invalid input: {}", e))?;

        let path = Path::new(&edit_input.file_path);

        if !path.exists() {
            return Ok(ToolResult::error(&format!(
                "File does not exist: {}",
                edit_input.file_path
            )));
        }

        let content = fs::read_to_string(path).await.map_err(|e| {
            anyhow::anyhow!(
                "Failed to read file '{}': {}",
                edit_input.file_path,
                e
            )
        })?;

        // Check if old_string exists
        if !content.contains(&edit_input.old_string) {
            return Ok(ToolResult::error(&format!(
                "String not found in file: '{}'",
                edit_input.old_string
            )));
        }

        let (new_content, replacements) = if edit_input.replace_all {
            let count = content.matches(&edit_input.old_string).count();
            (
                content.replace(&edit_input.old_string, &edit_input.new_string),
                count,
            )
        } else {
            // Replace only first occurrence
            let occurrences = content.matches(&edit_input.old_string).count();
            if occurrences > 1 {
                return Ok(ToolResult::error(&format!(
                    "String '{}' appears {} times in the file. Use replace_all=true to replace all occurrences, or provide more context to make it unique.",
                    edit_input.old_string, occurrences
                )));
            }
            (
                content.replacen(&edit_input.old_string, &edit_input.new_string, 1),
                1,
            )
        };

        fs::write(path, new_content).await.map_err(|e| {
            anyhow::anyhow!(
                "Failed to write file '{}': {}",
                edit_input.file_path,
                e
            )
        })?;

        let output = EditOutput {
            replacements,
            file_path: edit_input.file_path,
        };
        Ok(ToolResult::success(json!(output)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_read_tool() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.txt");
        fs::write(&file_path, "Line 1\nLine 2\nLine 3\n")
            .await
            .unwrap();

        let tool = ReadTool::new();
        let input = ToolInput::new(json!({
            "file_path": file_path.to_str().unwrap()
        }))
        .unwrap();

        let result = tool.execute(input).await.unwrap();
        assert!(result.success);

        let output: ReadOutput = serde_json::from_value(result.output.unwrap()).unwrap();
        assert!(output.content.contains("Line 1"));
        assert!(output.content.contains("Line 2"));
        assert!(output.content.contains("Line 3"));
        assert_eq!(output.line_count, 3);
    }

    #[tokio::test]
    async fn test_write_tool() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.txt");

        let tool = WriteTool::new();
        let input = ToolInput::new(json!({
            "file_path": file_path.to_str().unwrap(),
            "content": "Hello, World!"
        }))
        .unwrap();

        let result = tool.execute(input).await.unwrap();
        assert!(result.success);

        let content = fs::read_to_string(&file_path).await.unwrap();
        assert_eq!(content, "Hello, World!");
    }

    #[tokio::test]
    async fn test_edit_tool() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.txt");
        fs::write(&file_path, "Hello, World!").await.unwrap();

        let tool = EditTool::new();
        let input = ToolInput::new(json!({
            "file_path": file_path.to_str().unwrap(),
            "old_string": "World",
            "new_string": "Rust"
        }))
        .unwrap();

        let result = tool.execute(input).await.unwrap();
        assert!(result.success);

        let content = fs::read_to_string(&file_path).await.unwrap();
        assert_eq!(content, "Hello, Rust!");
    }

    #[tokio::test]
    async fn test_edit_tool_replace_all() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.txt");
        fs::write(&file_path, "foo foo foo").await.unwrap();

        let tool = EditTool::new();
        let input = ToolInput::new(json!({
            "file_path": file_path.to_str().unwrap(),
            "old_string": "foo",
            "new_string": "bar",
            "replace_all": true
        }))
        .unwrap();

        let result = tool.execute(input).await.unwrap();
        assert!(result.success);

        let output: EditOutput = serde_json::from_value(result.output.unwrap()).unwrap();
        assert_eq!(output.replacements, 3);

        let content = fs::read_to_string(&file_path).await.unwrap();
        assert_eq!(content, "bar bar bar");
    }
}
