//! Hook execution engine.
//!
//! This module handles the execution of hooks as external processes,
//! managing stdin/stdout communication and exit code handling.

use crate::hook::{Hook, HookConfig, HookDefinition, HookError};
use crate::protocol::{HookInput, HookOutput, HookResult};
use serde_json::Value;
use std::path::PathBuf;
use std::process::Stdio;
use tokio::io::AsyncWriteExt;
use tokio::process::Command;

/// Executes hooks as external processes.
///
/// The HookExecutor is responsible for:
/// - Running hook commands as separate processes
/// - Sending JSON input via stdin
/// - Reading JSON output from stdout
/// - Interpreting exit codes
/// - Aggregating results from multiple hooks
pub struct HookExecutor {
    /// Hook configuration with all registered hooks
    config: HookConfig,

    /// Session ID for tracking hook executions
    session_id: String,
}

impl HookExecutor {
    /// Creates a new hook executor with the given configuration.
    pub fn new(config: HookConfig, session_id: String) -> Self {
        Self {
            config,
            session_id,
        }
    }

    /// Executes all SessionStart hooks.
    ///
    /// Returns a vector of context strings to add to the conversation.
    /// Each hook can contribute additional context that will be shown to Claude.
    pub async fn execute_session_start_hooks(&self) -> Result<Vec<String>, HookError> {
        let hooks = self.config.session_start_hooks();
        let mut contexts = Vec::new();

        for hook in hooks {
            match self.execute_hook(hook, "SessionStart", &Value::Null).await {
                Ok(result) => {
                    if let Some(context) = result.context() {
                        contexts.push(context.to_string());
                    }
                }
                Err(e) => {
                    eprintln!("Warning: SessionStart hook failed: {}", e);
                }
            }
        }

        Ok(contexts)
    }

    /// Executes all PreToolUse hooks for a specific tool.
    ///
    /// Returns:
    /// - HookResult::Allow if all hooks allow the tool execution
    /// - HookResult::Deny if any hook denies the tool execution
    /// - HookResult::Warn if any hook returns a warning
    ///
    /// The first hook that denies will stop execution of subsequent hooks.
    pub async fn execute_pre_tool_hooks(
        &self,
        tool_name: &str,
        tool_input: &Value,
    ) -> Result<HookResult, HookError> {
        let hooks = self.config.pre_tool_hooks(tool_name);

        let mut combined_context = Vec::new();

        for hook in hooks {
            match self.execute_hook(hook, tool_name, tool_input).await {
                Ok(result) => {
                    match result {
                        HookResult::Deny(_) => {
                            // First deny stops execution and returns immediately
                            return Ok(result);
                        }
                        HookResult::Warn(msg) => {
                            eprintln!("Warning from PreToolUse hook: {}", msg);
                        }
                        HookResult::Allow(Some(context)) => {
                            combined_context.push(context);
                        }
                        HookResult::Allow(None) => {}
                    }
                }
                Err(e) => {
                    eprintln!("Warning: PreToolUse hook failed: {}", e);
                }
            }
        }

        // If we got here, all hooks allowed (or warned)
        if combined_context.is_empty() {
            Ok(HookResult::Allow(None))
        } else {
            Ok(HookResult::Allow(Some(combined_context.join("\n"))))
        }
    }

    /// Executes all PostToolUse hooks for a specific tool.
    ///
    /// PostToolUse hooks are informational only and cannot block execution.
    /// They are typically used for logging, metrics, or validation.
    pub async fn execute_post_tool_hooks(
        &self,
        tool_name: &str,
        tool_result: &Value,
    ) -> Result<(), HookError> {
        let hooks = self.config.post_tool_hooks(tool_name);

        for hook in hooks {
            match self.execute_hook(hook, tool_name, tool_result).await {
                Ok(_) => {
                    // PostToolUse hooks don't affect execution flow
                }
                Err(e) => {
                    eprintln!("Warning: PostToolUse hook failed: {}", e);
                }
            }
        }

        Ok(())
    }

    /// Executes a single hook process.
    ///
    /// This method:
    /// 1. Spawns the hook command as a child process
    /// 2. Sends HookInput as JSON to stdin
    /// 3. Reads HookOutput as JSON from stdout
    /// 4. Interprets the exit code
    /// 5. Returns a HookResult
    async fn execute_hook(
        &self,
        hook: &HookDefinition,
        tool_name: &str,
        tool_input: &Value,
    ) -> Result<HookResult, HookError> {
        // Parse the command and arguments
        let parts: Vec<&str> = hook.command.split_whitespace().collect();
        if parts.is_empty() {
            return Err(HookError::ConfigError("Empty command".to_string()));
        }

        let command_name = parts[0];
        let args = &parts[1..];

        // Prepare the input
        let input = HookInput {
            session_id: self.session_id.clone(),
            tool_name: tool_name.to_string(),
            tool_input: tool_input.clone(),
        };

        let input_json = serde_json::to_string(&input)
            .map_err(|e| HookError::JsonError(e))?;

        // Spawn the process
        let mut child = Command::new(command_name)
            .args(args)
            .current_dir(hook.working_dir.as_ref().unwrap_or(&PathBuf::from(".")))
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()?;

        // Write input to stdin
        if let Some(mut stdin) = child.stdin.take() {
            stdin.write_all(input_json.as_bytes()).await?;
            stdin.flush().await?;
            drop(stdin); // Close stdin
        }

        // Wait for the process to complete
        let output = child.wait_with_output().await?;

        // Parse stdout as JSON (if present)
        let hook_output = if !output.stdout.is_empty() {
            match serde_json::from_slice::<HookOutput>(&output.stdout) {
                Ok(out) => Some(out),
                Err(e) => {
                    eprintln!(
                        "Warning: Failed to parse hook output as JSON: {}",
                        e
                    );
                    eprintln!("Raw output: {}", String::from_utf8_lossy(&output.stdout));
                    None
                }
            }
        } else {
            None
        };

        // Log stderr if present
        if !output.stderr.is_empty() {
            eprintln!(
                "Hook stderr: {}",
                String::from_utf8_lossy(&output.stderr)
            );
        }

        // Interpret the exit code
        let exit_code = output.status.code().unwrap_or(-1);
        Ok(HookResult::from_exit_code(exit_code, hook_output))
    }

    /// Returns the session ID.
    pub fn session_id(&self) -> &str {
        &self.session_id
    }

    /// Returns a reference to the hook configuration.
    pub fn config(&self) -> &HookConfig {
        &self.config
    }

    /// Updates the hook configuration.
    pub fn set_config(&mut self, config: HookConfig) {
        self.config = config;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::hook::HookDefinition;
    use std::fs;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_execute_session_start_hooks_empty() {
        let config = HookConfig::new();
        let executor = HookExecutor::new(config, "test-session".to_string());

        let contexts = executor.execute_session_start_hooks().await.unwrap();
        assert_eq!(contexts.len(), 0);
    }

    #[tokio::test]
    async fn test_execute_pre_tool_hooks_no_match() {
        let config = HookConfig::new();
        let executor = HookExecutor::new(config, "test-session".to_string());

        let result = executor
            .execute_pre_tool_hooks("Write", &Value::Null)
            .await
            .unwrap();

        assert!(result.is_allowed());
    }

    #[tokio::test]
    async fn test_hook_executor_session_id() {
        let config = HookConfig::new();
        let executor = HookExecutor::new(config, "my-session-123".to_string());

        assert_eq!(executor.session_id(), "my-session-123");
    }

    #[tokio::test]
    async fn test_execute_hook_with_echo_command() {
        // Create a simple hook that uses echo (exit code 0)
        let hook = HookDefinition::new(
            Hook::SessionStart,
            "echo test".to_string(),
            None,
            None,
        )
        .unwrap();

        let config = HookConfig::new();
        let executor = HookExecutor::new(config, "test".to_string());

        let result = executor
            .execute_hook(&hook, "SessionStart", &Value::Null)
            .await
            .unwrap();

        // Echo returns 0, so should be allowed
        assert!(result.is_allowed());
    }

    #[tokio::test]
    async fn test_execute_hook_with_script() {
        let temp_dir = TempDir::new().unwrap();
        let script_path = temp_dir.path().join("test_hook.sh");

        // Create a simple script that exits with code 0
        let script_content = r#"#!/bin/bash
exit 0
"#;
        fs::write(&script_path, script_content).unwrap();

        // Make script executable on Unix
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = fs::metadata(&script_path).unwrap().permissions();
            perms.set_mode(0o755);
            fs::set_permissions(&script_path, perms).unwrap();
        }

        let hook = HookDefinition::new(
            Hook::SessionStart,
            script_path.to_string_lossy().to_string(),
            None,
            None,
        )
        .unwrap();

        let config = HookConfig::new();
        let executor = HookExecutor::new(config, "test".to_string());

        let result = executor
            .execute_hook(&hook, "SessionStart", &Value::Null)
            .await
            .unwrap();

        assert!(result.is_allowed());
    }
}
