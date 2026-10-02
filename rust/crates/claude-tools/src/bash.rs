//! Bash tool for executing shell commands

use async_trait::async_trait;
use claude_core::{ClaudeError, ClaudeResult, PermissionResult, Tool, ToolContext, ToolDefinition, ToolInput, ToolOutput, ToolProgress, ToolValidation};
use serde_json::json;
use std::process::Stdio;
use tokio::process::Command;
use tokio::time::{timeout, Duration};
use tracing::{debug, error, info, instrument, warn};

/// Bash tool for command execution
pub struct BashTool {
    definition: ToolDefinition,
    /// Default timeout
    default_timeout_secs: u64,
    /// Whether to allow interactive commands
    allow_interactive: bool,
    /// Blocked commands
    blocked_commands: Vec<String>,
    /// Dangerous commands that need confirmation
    dangerous_commands: Vec<String>,
}

impl BashTool {
    /// Commands that require confirmation
    const DANGEROUS_COMMANDS: &'static [&'static str] = &[
        "rm", "rm -rf", "dd", "mkfs", "fdisk", "parted", 
        "chmod -R", "chown -R", "sudo -S -p ''", "su", "passwd"
    ];
    
    /// Blocked commands
    const BLOCKED_COMMANDS: &'static [&'static str] = &[
        "reboot", "shutdown", "halt", "poweroff", "init 0"
    ];
    
    /// Create new bash tool
    pub fn new() -> Self {
        let dangerous = Self::DANGEROUS_COMMANDS.iter().map(|s| s.to_string()).collect();
        let blocked = Self::BLOCKED_COMMANDS.iter().map(|s| s.to_string()).collect();
        
        Self {
            definition: ToolDefinition::new(
                "Bash",
                "Execute bash commands in a shell. Use for file operations, git commands, running scripts, etc."
            )
            .with_schema(json!({
                "type": "object",
                "required": ["command"],
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "The bash command to execute"
                    },
                    "timeout": {
                        "type": "number",
                        "description": "Timeout in seconds (default: 300)"
                    },
                    "description": {
                        "type": "string",
                        "description": "Brief description of what the command does"
                    }
                }
            }))
            .with_alias("bash")
            .with_alias("shell")
            .with_alias("exec"),
            default_timeout_secs: 300,
            allow_interactive: false,
            blocked_commands: blocked,
            dangerous_commands: dangerous,
        }
    }
    
    /// Check if command is blocked
    fn is_blocked(&self, command: &str) -> bool {
        let cmd_lower = command.to_lowercase();
        self.blocked_commands.iter().any(|blocked| cmd_lower.contains(blocked))
    }
    
    /// Check if command is dangerous
    fn is_dangerous(&self, command: &str) -> bool {
        let cmd_lower = command.to_lowercase();
        self.dangerous_commands.iter().any(|dangerous| {
            cmd_lower.starts_with(dangerous) || cmd_lower.contains(&format!(" {}", dangerous))
        })
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
        let command = input.get_string("command").unwrap_or_default();
        
        if command.is_empty() {
            return ToolValidation::Invalid("Command cannot be empty".to_string());
        }
        
        if self.is_blocked(&command) {
            return ToolValidation::Invalid(format!(
                "Command '{}' is blocked for safety reasons", 
                command
            ));
        }
        
        if self.is_dangerous(&command) {
            return ToolValidation::NeedsConfirmation(format!(
                "Command '{}' may be destructive", 
                command
            ));
        }
        
        ToolValidation::Valid
    }
    
    fn check_permission(&self, input: &ToolInput, ctx: &ToolContext) -> PermissionResult {
        let command = input.get_string("command").unwrap_or_default();
        
        // Check blocked
        if self.is_blocked(&command) {
            return PermissionResult::Denied {
                reason: "Command is blocked for safety".to_string(),
            };
        }
        
        // Check permission mode
        match ctx.permission.mode {
            claude_core::PermissionMode::AutoYes => {
                return PermissionResult::Allowed;
            }
            claude_core::PermissionMode::AutoNo => {
                if self.is_dangerous(&command) {
                    return PermissionResult::Denied {
                        reason: "Dangerous command in auto-no mode".to_string(),
                    };
                }
            }
            claude_core::PermissionMode::ReadOnly => {
                if self.is_dangerous(&command) {
                    return PermissionResult::Denied {
                        reason: "Write command in read-only mode".to_string(),
                    };
                }
            }
            _ => {}
        }
        
        // Check auto-allow patterns
        if ctx.permission.is_auto_allowed(&command, None) {
            return PermissionResult::Allowed;
        }
        
        // Check dangerous
        if self.is_dangerous(&command) {
            return PermissionResult::NeedsConfirmation {
                action: format!("Execute dangerous command: {}", command),
            };
        }
        
        PermissionResult::Allowed
    }
    
    #[instrument(skip(self, input, context))]
    async fn execute(&self, input: ToolInput, context: ToolContext) -> ClaudeResult<ToolOutput> {
        let command = input.get_string("command")
            .ok_or_else(|| ClaudeError::validation("command", "Required parameter missing"))?;
        
        let timeout_secs = input.input.get("timeout")
            .and_then(|v| v.as_u64())
            .unwrap_or(self.default_timeout_secs);
        
        let description = input.input.get("description")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        
        info!("Executing bash command: {}", command);
        if let Some(ref desc) = description {
            debug!("Description: {}", desc);
        }
        
        // Execute the command
        let start = std::time::Instant::now();
        
        let output = timeout(
            Duration::from_secs(timeout_secs),
            execute_shell_command(&command, &context.cwd)
        ).await.map_err(|_| ClaudeError::Timeout {
            operation: format!("bash: {}", command),
            duration_ms: timeout_secs * 1000,
        })?;
        
        let elapsed = start.elapsed();
        
        match output {
            Ok(result) => {
                let mut output_str = String::new();
                
                // stdout
                if !result.stdout.is_empty() {
                    output_str.push_str(&result.stdout);
                }
                
                // stderr (only if stdout is empty or if there's an error)
                if !result.stderr.is_empty() && result.stdout.is_empty() {
                    if !output_str.is_empty() {
                        output_str.push('\n');
                    }
                    output_str.push_str("[stderr]: ");
                    output_str.push_str(&result.stderr);
                }
                
                // Exit code info
                if result.exit_code != 0 {
                    if !output_str.is_empty() {
                        output_str.push('\n');
                    }
                    output_str.push_str(&format!(
                        "[exit code: {}]", 
                        result.exit_code
                    ));
                    
                    return Ok(ToolOutput {
                        content: output_str,
                        is_error: true,
                        metadata: Some(json!({
                            "command": command,
                            "exit_code": result.exit_code,
                            "duration_ms": elapsed.as_millis(),
                        })),
                        suggestions: Some(vec![
                            "Check the command syntax".to_string(),
                            "Verify the working directory".to_string(),
                        ]),
                        progress: Vec::new(),
                    });
                }
                
                // Truncate if too long
                const MAX_OUTPUT: usize = 100_000;
                let truncated = if output_str.len() > MAX_OUTPUT {
                    format!(
                        "{}\n\n[Output truncated - {} total characters]", 
                        &output_str[..MAX_OUTPUT],
                        output_str.len()
                    )
                } else {
                    output_str
                };
                
                Ok(ToolOutput {
                    content: truncated,
                    is_error: false,
                    metadata: Some(json!({
                        "command": command,
                        "exit_code": result.exit_code,
                        "duration_ms": elapsed.as_millis(),
                        "stdout_bytes": result.stdout.len(),
                        "stderr_bytes": result.stderr.len(),
                    })),
                    suggestions: None,
                    progress: Vec::new(),
                })
            }
            Err(e) => {
                error!("Command execution failed: {}", e);
                Err(ClaudeError::tool("Bash", e.to_string()))
            }
        }
    }
}

/// Command execution result
struct CommandResult {
    stdout: String,
    stderr: String,
    exit_code: i32,
}

/// Execute a shell command
async fn execute_shell_command(command: &str, cwd: &str) -> anyhow::Result<CommandResult> {
    // Use bash -c for proper shell interpretation
    let mut cmd = Command::new("bash");
    cmd.arg("-c")
        .arg(command)
        .current_dir(cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::null());
    
    // Set environment to be non-interactive
    cmd.env("DEBIAN_FRONTEND", "noninteractive");
    cmd.env("CI", "true");
    
    let mut child = cmd.spawn()?;
    
    let stdout = child.stdout.take().expect("stdout pipe");
    let stderr = child.stderr.take().expect("stderr pipe");
    
    // Read stdout and stderr concurrently
    let stdout_handle = tokio::io::AsyncReadExt::read_to_end(stdout, Vec::new());
    let stderr_handle = tokio::io::AsyncReadExt::read_to_end(stderr, Vec::new());
    
    let (stdout_bytes, stderr_bytes) = tokio::join!(stdout_handle, stderr_handle);
    
    let stdout_str = String::from_utf8_lossy(&stdout_bytes?).to_string();
    let stderr_str = String::from_utf8_lossy(&stderr_bytes?).to_string();
    
    let status = child.wait().await?;
    let exit_code = status.code().unwrap_or(-1);
    
    Ok(CommandResult {
        stdout: stdout_str,
        stderr: stderr_str,
        exit_code,
    })
}

