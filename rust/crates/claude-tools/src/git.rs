//! Git tool for repository operations

use async_trait::async_trait;
use claude_core::{ClaudeError, ClaudeResult, PermissionResult, Tool, ToolContext, ToolDefinition, ToolInput, ToolOutput, ToolProgress, ToolValidation};
use serde_json::json;
use std::process::Stdio;
use tokio::process::Command;
use tracing::{info, instrument};

/// Git tool
pub struct GitTool {
    definition: ToolDefinition,
}

impl GitTool {
    /// Create new git tool
    pub fn new() -> Self {
        Self {
            definition: ToolDefinition::new(
                "Git",
                "Execute git commands for repository management. Supports status, log, diff, branch, commit, etc."
            )
            .with_schema(json!({
                "type": "object",
                "required": ["command"],
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "The git command to execute (e.g., 'status', 'log --oneline', 'diff')"
                    },
                    "description": {
                        "type": "string",
                        "description": "Description of what this git command does"
                    }
                }
            }))
            .with_alias("git"),
        }
    }
}

impl Default for GitTool {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Tool for GitTool {
    fn definition(&self) -> &ToolDefinition {
        &self.definition
    }
    
    fn validate(&self, input: &ToolInput) -> ToolValidation {
        match input.get_string("command") {
            Some(c) if !c.is_empty() => ToolValidation::Valid,
            _ => ToolValidation::Invalid("command is required".to_string()),
        }
    }
    
    fn check_permission(&self, input: &ToolInput, ctx: &ToolContext) -> PermissionResult {
        let command = input.get_string("command").unwrap_or_default();
        let cmd_lower = command.to_lowercase();
        
        // Read-only commands are always safe
        let read_only = [
            "status", "log", "show", "diff", "blame", "ls-files",
            "branch -a", "remote -v", "tag -l"
        ];
        
        for safe in &read_only {
            if cmd_lower.starts_with(safe) || cmd_lower.contains(safe) {
                return PermissionResult::Allowed;
            }
        }
        
        // Write commands need confirmation in normal mode
        if ctx.permission.mode == claude_core::PermissionMode::AutoYes {
            return PermissionResult::Allowed;
        }
        
        if ctx.permission.mode == claude_core::PermissionMode::ReadOnly {
            return PermissionResult::Denied {
                reason: "Git write operations disabled in read-only mode".to_string(),
            };
        }
        
        // Check for destructive operations
        let dangerous = ["push", "reset", "revert", "merge", "rebase", "cherry-pick"];
        for d in &dangerous {
            if cmd_lower.contains(d) {
                return PermissionResult::NeedsConfirmation {
                    action: format!("Execute git {} (destructive operation)", command),
                };
            }
        }
        
        PermissionResult::Allowed
    }
    
    #[instrument(skip(self, input, context))]
    async fn execute(&self, input: ToolInput, context: ToolContext) -> ClaudeResult<ToolOutput> {
        let command = input.get_string("command")
            .ok_or_else(|| ClaudeError::validation("command", "Required parameter missing"))?;
        
        info!("Executing git command: {}", command);
        
        // Split command into parts
        let parts: Vec<&str> = command.split_whitespace().collect();
        if parts.is_empty() {
            return Err(ClaudeError::validation("command", "Empty command"));
        }
        
        let mut cmd = Command::new("git");
        cmd.current_dir(&context.cwd);
        
        // Add all parts
        for part in parts {
            cmd.arg(part);
        }
        
        // Set environment
        cmd.env("GIT_PAGER", "cat");
        cmd.env("GIT_TERMINAL_PROMPT", "0");
        
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());
        
        let output = cmd.output().await
            .map_err(|e| ClaudeError::tool("Git", format!(
                "Failed to execute git: {}",
                e
            )))?;
        
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        
        let result = if !stderr.is_empty() {
            format!("{}", stderr)
        } else if stdout.is_empty() {
            "(no output)".to_string()
        } else {
            stdout
        };
        
        let is_error = !output.status.success();
        
        Ok(ToolOutput {
            content: result,
            is_error,
            metadata: Some(json!({
                "command": format!("git {}", command),
                "exit_code": output.status.code(),
            })),
            suggestions: if is_error {
                Some(vec![
                    "Check if you're in a git repository".to_string(),
                    "Verify the command syntax".to_string(),
                ])
            } else {
                None
            },
            progress: Vec::new(),
        })
    }
}

