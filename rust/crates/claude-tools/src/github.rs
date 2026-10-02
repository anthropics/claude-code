//! GitHub tool for PR and issue operations

use async_trait::async_trait;
use claude_core::{ClaudeError, ClaudeResult, PermissionResult, Tool, ToolContext, ToolDefinition, ToolInput, ToolOutput, ToolProgress, ToolValidation};
use serde_json::json;
use std::process::Stdio;
use tokio::process::Command;
use tracing::{info, instrument};

/// GitHub tool
pub struct GitHubTool {
    definition: ToolDefinition,
}

impl GitHubTool {
    /// Create new github tool
    pub fn new() -> Self {
        Self {
            definition: ToolDefinition::new(
                "GitHub",
                "Interact with GitHub repositories via the gh CLI. View PRs, issues, create comments, etc."
            )
            .with_schema(json!({
                "type": "object",
                "required": ["command"],
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "The gh command to execute (e.g., 'pr list', 'issue view 123')"
                    },
                    "description": {
                        "type": "string",
                        "description": "Description of what this command does"
                    }
                }
            }))
            .with_alias("github")
            .with_alias("gh"),
        }
    }
}

impl Default for GitHubTool {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Tool for GitHubTool {
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
            "pr list", "pr view", "pr diff", "pr checks",
            "issue list", "issue view", "repo view", "run list"
        ];
        
        for safe in &read_only {
            if cmd_lower.starts_with(safe) || cmd_lower.contains(&safe.replace(" ", "")) {
                return PermissionResult::Allowed;
            }
        }
        
        // Write commands need confirmation
        if ctx.permission.mode == claude_core::PermissionMode::AutoYes {
            return PermissionResult::Allowed;
        }
        
        if ctx.permission.mode == claude_core::PermissionMode::ReadOnly {
            return PermissionResult::Denied {
                reason: "GitHub write operations disabled in read-only mode".to_string(),
            };
        }
        
        // Check for write operations
        let write_ops = ["pr create", "pr merge", "pr close", "issue create", "comment"];
        for op in &write_ops {
            if cmd_lower.contains(op) {
                return PermissionResult::NeedsConfirmation {
                    action: format!("Execute gh {} (write operation)", command),
                };
            }
        }
        
        PermissionResult::Allowed
    }
    
    #[instrument(skip(self, input, context))]
    async fn execute(&self, input: ToolInput, context: ToolContext) -> ClaudeResult<ToolOutput> {
        let command = input.get_string("command")
            .ok_or_else(|| ClaudeError::validation("command", "Required parameter missing"))?;
        
        info!("Executing gh command: {}", command);
        
        // Check if gh is available
        let gh_check = Command::new("gh")
            .arg("--version")
            .output()
            .await;
        
        if gh_check.is_err() {
            return Ok(ToolOutput {
                content: "gh CLI not found. Install from https://cli.github.com/".to_string(),
                is_error: true,
                metadata: None,
                suggestions: Some(vec![
                    "Install gh CLI: curl -fsSL https://cli.github.com/install.sh | sh".to_string(),
                ]),
                progress: Vec::new(),
            });
        }
        
        // Split command into parts
        let parts: Vec<&str> = command.split_whitespace().collect();
        
        let mut cmd = Command::new("gh");
        cmd.current_dir(&context.cwd);
        
        // Add all parts
        for part in parts {
            cmd.arg(part);
        }
        
        cmd.env("GH_PAGER", "cat");
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());
        
        let output = cmd.output().await
            .map_err(|e| ClaudeError::tool("GitHub", format!(
                "Failed to execute gh: {}",
                e
            )))?;
        
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        
        let result = if !stderr.is_empty() && stdout.is_empty() {
            stderr
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
                "command": format!("gh {}", command),
                "exit_code": output.status.code(),
            })),
            suggestions: if is_error {
                Some(vec![
                    "Check if you're authenticated: gh auth status".to_string(),
                    "Check if you're in a git repository with a remote".to_string(),
                ])
            } else {
                None
            },
            progress: Vec::new(),
        })
    }
}

