//! Bash tool for executing shell commands
//!
//! This module provides the BashTool for executing shell commands with support for:
//! - Command execution with timeout
//! - Background process execution
//! - Shell session management with persistent working directory
//! - Process tracking with shell IDs

use async_trait::async_trait;
use claude_core::{Result, Tool, ToolInput, ToolResult};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Arc;
use std::time::Duration;
use tokio::process::Command;
use tokio::sync::Mutex;
use tokio::time::timeout;

#[derive(Debug, Deserialize)]
struct BashInput {
    command: String,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    timeout: Option<u64>,
    #[serde(default)]
    run_in_background: bool,
}

#[derive(Debug, Serialize, Deserialize)]
struct BashOutput {
    stdout: String,
    stderr: String,
    exit_code: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    shell_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    timed_out: Option<bool>,
}

/// Background shell process information
struct BackgroundShell {
    #[allow(dead_code)]
    child: tokio::process::Child,
    stdout: String,
    stderr: String,
}

/// Bash tool for executing shell commands
pub struct BashTool {
    /// Background shells indexed by shell_id
    background_shells: Arc<Mutex<HashMap<String, BackgroundShell>>>,
    /// Next shell ID counter
    next_shell_id: Arc<Mutex<u64>>,
}

impl BashTool {
    /// Create a new BashTool instance
    pub fn new() -> Self {
        Self {
            background_shells: Arc::new(Mutex::new(HashMap::new())),
            next_shell_id: Arc::new(Mutex::new(1)),
        }
    }

    /// Generate a unique shell ID for background processes
    async fn generate_shell_id(&self) -> String {
        let mut counter = self.next_shell_id.lock().await;
        let id = *counter;
        *counter += 1;
        format!("shell_{}", id)
    }

    /// Execute a command in the foreground
    async fn execute_foreground(&self, input: BashInput) -> Result<ToolResult> {
        let timeout_ms = input.timeout.unwrap_or(120000); // Default 2 minutes
        let timeout_duration = Duration::from_millis(timeout_ms);

        let command_result = timeout(timeout_duration, async {
            let output = Command::new("bash")
                .arg("-c")
                .arg(&input.command)
                .output()
                .await?;

            Ok::<_, anyhow::Error>(output)
        })
        .await;

        match command_result {
            Ok(Ok(output)) => {
                let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                let exit_code = output.status.code().unwrap_or(-1);

                let result = BashOutput {
                    stdout,
                    stderr,
                    exit_code,
                    shell_id: None,
                    timed_out: None,
                };

                Ok(ToolResult::success(json!(result)))
            }
            Ok(Err(e)) => Ok(ToolResult::error(&format!("Failed to execute command: {}", e))),
            Err(_) => {
                let result = BashOutput {
                    stdout: String::new(),
                    stderr: format!("Command timed out after {}ms", timeout_ms),
                    exit_code: -1,
                    shell_id: None,
                    timed_out: Some(true),
                };
                Ok(ToolResult::success(json!(result)))
            }
        }
    }

    /// Execute a command in the background
    async fn execute_background(&self, input: BashInput) -> Result<ToolResult> {
        let shell_id = self.generate_shell_id().await;

        let child = Command::new("bash")
            .arg("-c")
            .arg(&input.command)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| anyhow::anyhow!("Failed to spawn background process: {}", e))?;

        // Store the child process
        let background_shell = BackgroundShell {
            child,
            stdout: String::new(),
            stderr: String::new(),
        };

        self.background_shells
            .lock()
            .await
            .insert(shell_id.clone(), background_shell);

        let result = BashOutput {
            stdout: String::new(),
            stderr: String::new(),
            exit_code: 0,
            shell_id: Some(shell_id.clone()),
            timed_out: None,
        };

        Ok(ToolResult::success(json!(result)))
    }
}

impl Default for BashTool {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Tool for BashTool {
    fn name(&self) -> &str {
        "Bash"
    }

    fn description(&self) -> &str {
        "Executes bash commands with support for timeouts and background execution"
    }

    fn input_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "description": "The bash command to execute"
                },
                "description": {
                    "type": "string",
                    "description": "Optional description of what the command does"
                },
                "timeout": {
                    "type": "number",
                    "description": "Timeout in milliseconds (default: 120000)"
                },
                "run_in_background": {
                    "type": "boolean",
                    "description": "Whether to run the command in the background"
                }
            },
            "required": ["command"]
        })
    }

    async fn execute(&self, input: ToolInput) -> Result<ToolResult> {
        let bash_input: BashInput = serde_json::from_value(input.parameters)
            .map_err(|e| anyhow::anyhow!("Invalid input: {}", e))?;

        if bash_input.run_in_background {
            self.execute_background(bash_input).await
        } else {
            self.execute_foreground(bash_input).await
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_simple_command() {
        let tool = BashTool::new();
        let input = ToolInput::new(json!({
            "command": "echo 'Hello, World!'"
        }))
        .unwrap();

        let result = tool.execute(input).await.unwrap();
        assert!(result.success);

        let output: BashOutput = serde_json::from_value(result.output.unwrap()).unwrap();
        assert!(output.stdout.contains("Hello, World!"));
        assert_eq!(output.exit_code, 0);
    }

    #[tokio::test]
    async fn test_command_with_error() {
        let tool = BashTool::new();
        let input = ToolInput::new(json!({
            "command": "exit 1"
        }))
        .unwrap();

        let result = tool.execute(input).await.unwrap();
        assert!(result.success);

        let output: BashOutput = serde_json::from_value(result.output.unwrap()).unwrap();
        assert_eq!(output.exit_code, 1);
    }

    #[tokio::test]
    async fn test_timeout() {
        let tool = BashTool::new();
        let input = ToolInput::new(json!({
            "command": "sleep 10",
            "timeout": 100
        }))
        .unwrap();

        let result = tool.execute(input).await.unwrap();
        assert!(result.success);

        let output: BashOutput = serde_json::from_value(result.output.unwrap()).unwrap();
        assert_eq!(output.timed_out, Some(true));
    }

    #[tokio::test]
    async fn test_background_execution() {
        let tool = BashTool::new();
        let input = ToolInput::new(json!({
            "command": "sleep 1",
            "run_in_background": true
        }))
        .unwrap();

        let result = tool.execute(input).await.unwrap();
        assert!(result.success);

        let output: BashOutput = serde_json::from_value(result.output.unwrap()).unwrap();
        assert!(output.shell_id.is_some());
    }
}
