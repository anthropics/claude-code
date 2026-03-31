//! Bash tool implementation

use async_trait::async_trait;
use claude_core::{ClaudeError, ClaudeResult, PermissionResult, ToolContext, ToolDefinition, ToolInput, ToolOutput, ToolValidation};
use claude_core::tool::Tool;
use serde_json::Value;
use tokio::process::Command;
use tokio::time::{timeout, Duration};

/// Bash tool for command execution
pub struct BashTool {
    definition: ToolDefinition,
    allowed_commands: Vec<String>,
    blocked_patterns: Vec<String>,
}

impl BashTool {
    /// Create a new bash tool
    pub fn new() -> Self {
        let definition = ToolDefinition::new(
            "Bash",
            "Execute bash commands in a shell",
        )
        .with_schema(serde_json::json!({
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "description": "The bash command to execute"
                },
                "description": {
                    "type": "string",
                    "description": "Description of what the command does"
                },
                "timeout": {
                    "type": "integer",
                    "description": "Timeout in seconds (default: 30)",
                    "default": 30
                }
            },
            "required": ["command", "description"]
        }));
        
        Self {
            definition,
            allowed_commands: vec![],
            blocked_patterns: vec![
                "rm -rf /".to_string(),
                "rm -rf /*".to_string(),
                "dd if=/dev/zero".to_string(),
                ":(){ :|:& };:".to_string(),
            ],
        }
    }
    
    /// Validate command for security
    fn validate_command(&self, command: &str) -> ToolValidation {
        for pattern in &self.blocked_patterns {
            if command.contains(pattern) {
                return ToolValidation::Invalid(format!(
                    "Command contains blocked pattern: {}", pattern
                ));
            }
        }
        ToolValidation::Valid
    }
}

impl Default for BashTool {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Tool for BashTool {
    fn definition(&self) -> &ToolDefinition {
        &self.definition
    }
    
    fn validate(&self, input: &ToolInput) -> ToolValidation {
        let command = input.input.get("command").and_then(Value::as_str);
        match command {
            Some(cmd) => self.validate_command(cmd),
            None => ToolValidation::Invalid("Missing 'command' field".to_string()),
        }
    }
    
    fn check_permission(&self, input: &ToolInput, ctx: &ToolContext) -> PermissionResult {
        let command = input.input.get("command").and_then(Value::as_str);
        let description = input.input.get("description").and_then(Value::as_str);
        
        match (command, description) {
            (Some(_cmd), Some(_desc)) => {
                PermissionResult::Allowed
            }
            _ => PermissionResult::Denied { reason: "Missing command or description".to_string() },
        }
    }
    
    async fn execute(&self, input: ToolInput, context: ToolContext) -> ClaudeResult<ToolOutput> {
        let command = input.input.get("command").and_then(Value::as_str);
        let _description = input.input.get("description").and_then(Value::as_str);
        let timeout_secs = input.input.get("timeout").and_then(Value::as_u64).unwrap_or(30);
        
        let cmd_str = command.ok_or_else(|| ClaudeError::Validation {
            field: "command".to_string(),
            message: "Required field".to_string(),
        })?;
        
        let output = timeout(
            Duration::from_secs(timeout_secs),
            Command::new("bash")
                .arg("-c")
                .arg(cmd_str)
                .current_dir(&context.cwd)
                .output()
        ).await.map_err(|_| ClaudeError::Timeout {
            operation: cmd_str.to_string(),
            duration_ms: timeout_secs * 1000,
        })?;
        
        match output {
            Ok(result) => {
                let stdout = String::from_utf8_lossy(&result.stdout);
                let stderr = String::from_utf8_lossy(&result.stderr);
                
                if result.status.success() {
                    if stderr.is_empty() {
                        Ok(ToolOutput::success(stdout.to_string()))
                    } else {
                        Ok(ToolOutput::success(format!("{}\n{}\n[stderr] {}",
                            stdout, if stdout.is_empty() { "" } else { "\n" }, stderr)))
                    }
                } else {
                    let exit_code = result.status.code().unwrap_or(-1);
                    Ok(ToolOutput::error(format!(
                        "Command failed with exit code {}:\nstdout: {}\nstderr: {}",
                        exit_code, stdout, stderr
                    )))
                }
            }
            Err(e) => Err(ClaudeError::ExternalProcess {
                command: cmd_str.to_string(),
                message: e.to_string(),
                exit_code: None,
            }),
        }
    }
}

