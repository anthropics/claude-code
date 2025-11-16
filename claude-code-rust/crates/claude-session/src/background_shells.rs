//! Background shell registry for tracking running shell processes
//!
//! This module provides functionality to register, track, and manage
//! background shell processes that are started during a session.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;

/// Errors that can occur during background shell operations
#[derive(Debug, Error)]
pub enum ShellError {
    #[error("Shell not found: {0}")]
    NotFound(String),

    #[error("Failed to kill shell: {0}")]
    KillFailed(String),

    #[error("Invalid shell ID: {0}")]
    InvalidId(String),

    #[error("Process error: {0}")]
    ProcessError(String),
}

/// Information about a running background shell
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ShellInfo {
    /// Unique identifier for the shell
    pub shell_id: String,

    /// Process ID of the shell
    pub pid: u32,

    /// When the shell was started
    pub started_at: DateTime<Utc>,

    /// The command that was executed
    pub command: String,

    /// Working directory where the shell was started
    #[serde(skip_serializing_if = "Option::is_none")]
    pub working_dir: Option<String>,
}

impl ShellInfo {
    /// Create a new shell info instance
    pub fn new(shell_id: impl Into<String>, pid: u32, command: impl Into<String>) -> Self {
        ShellInfo {
            shell_id: shell_id.into(),
            pid,
            started_at: Utc::now(),
            command: command.into(),
            working_dir: None,
        }
    }

    /// Set the working directory
    pub fn with_working_dir(mut self, dir: impl Into<String>) -> Self {
        self.working_dir = Some(dir.into());
        self
    }

    /// Check if the process is still running
    pub fn is_running(&self) -> bool {
        check_process_running(self.pid)
    }

    /// Get the age of this shell in seconds
    pub fn age_seconds(&self) -> i64 {
        let now = Utc::now();
        (now - self.started_at).num_seconds()
    }
}

/// Registry for managing background shells
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct BackgroundShellRegistry {
    /// Map of shell ID to shell information
    shells: HashMap<String, ShellInfo>,
}

impl BackgroundShellRegistry {
    /// Create a new empty registry
    pub fn new() -> Self {
        BackgroundShellRegistry {
            shells: HashMap::new(),
        }
    }

    /// Register a new background shell
    pub fn register_shell(&mut self, shell_info: ShellInfo) -> Result<(), ShellError> {
        let shell_id = shell_info.shell_id.clone();

        if shell_id.is_empty() {
            return Err(ShellError::InvalidId(
                "Shell ID cannot be empty".to_string(),
            ));
        }

        self.shells.insert(shell_id, shell_info);
        Ok(())
    }

    /// Get information about a specific shell
    pub fn get_shell(&self, shell_id: &str) -> Option<&ShellInfo> {
        self.shells.get(shell_id)
    }

    /// Get mutable reference to a shell
    pub fn get_shell_mut(&mut self, shell_id: &str) -> Option<&mut ShellInfo> {
        self.shells.get_mut(shell_id)
    }

    /// List all registered shells
    pub fn list_shells(&self) -> Vec<&ShellInfo> {
        self.shells.values().collect()
    }

    /// List all shell IDs
    pub fn list_shell_ids(&self) -> Vec<String> {
        self.shells.keys().cloned().collect()
    }

    /// Remove a shell from the registry (does not kill the process)
    pub fn unregister_shell(&mut self, shell_id: &str) -> Option<ShellInfo> {
        self.shells.remove(shell_id)
    }

    /// Kill a specific shell process and remove it from the registry
    pub fn kill_shell(&mut self, shell_id: &str) -> Result<(), ShellError> {
        let shell_info = self
            .shells
            .get(shell_id)
            .ok_or_else(|| ShellError::NotFound(shell_id.to_string()))?;

        let pid = shell_info.pid;

        // Attempt to kill the process
        kill_process(pid).map_err(|e| ShellError::KillFailed(format!("PID {}: {}", pid, e)))?;

        // Remove from registry
        self.shells.remove(shell_id);

        Ok(())
    }

    /// Clean up all registered shells (kill and remove)
    pub fn cleanup(&mut self) -> Vec<Result<String, ShellError>> {
        let shell_ids: Vec<String> = self.shells.keys().cloned().collect();
        let mut results = Vec::new();

        for shell_id in shell_ids {
            match self.kill_shell(&shell_id) {
                Ok(()) => results.push(Ok(shell_id)),
                Err(e) => results.push(Err(e)),
            }
        }

        results
    }

    /// Remove shells that are no longer running
    pub fn cleanup_dead_shells(&mut self) -> Vec<String> {
        let dead_shells: Vec<String> = self
            .shells
            .iter()
            .filter(|(_, info)| !info.is_running())
            .map(|(id, _)| id.clone())
            .collect();

        for shell_id in &dead_shells {
            self.shells.remove(shell_id);
        }

        dead_shells
    }

    /// Get the number of registered shells
    pub fn count(&self) -> usize {
        self.shells.len()
    }

    /// Check if a shell is registered
    pub fn contains(&self, shell_id: &str) -> bool {
        self.shells.contains_key(shell_id)
    }

    /// Get all running shells (filters out dead processes)
    pub fn get_running_shells(&self) -> Vec<&ShellInfo> {
        self.shells
            .values()
            .filter(|info| info.is_running())
            .collect()
    }
}

/// Check if a process with the given PID is running
fn check_process_running(pid: u32) -> bool {
    #[cfg(unix)]
    {
        use std::fs;
        // On Unix, check if /proc/{pid} exists
        fs::metadata(format!("/proc/{}", pid)).is_ok()
    }

    #[cfg(windows)]
    {
        // On Windows, try to open the process handle
        use std::process::Command;
        Command::new("tasklist")
            .args(&["/FI", &format!("PID eq {}", pid)])
            .output()
            .map(|output| {
                let stdout = String::from_utf8_lossy(&output.stdout);
                stdout.contains(&pid.to_string())
            })
            .unwrap_or(false)
    }

    #[cfg(not(any(unix, windows)))]
    {
        // For other platforms, assume it's running
        true
    }
}

/// Kill a process with the given PID
fn kill_process(pid: u32) -> Result<(), String> {
    #[cfg(unix)]
    {
        use std::process::Command;
        let output = Command::new("kill")
            .arg(pid.to_string())
            .output()
            .map_err(|e| format!("Failed to execute kill command: {}", e))?;

        if output.status.success() {
            Ok(())
        } else {
            Err(format!(
                "Kill command failed: {}",
                String::from_utf8_lossy(&output.stderr)
            ))
        }
    }

    #[cfg(windows)]
    {
        use std::process::Command;
        let output = Command::new("taskkill")
            .args(&["/PID", &pid.to_string(), "/F"])
            .output()
            .map_err(|e| format!("Failed to execute taskkill command: {}", e))?;

        if output.status.success() {
            Ok(())
        } else {
            Err(format!(
                "Taskkill command failed: {}",
                String::from_utf8_lossy(&output.stderr)
            ))
        }
    }

    #[cfg(not(any(unix, windows)))]
    {
        Err("Process killing not supported on this platform".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_shell_info_creation() {
        let info = ShellInfo::new("shell-1", 12345, "echo hello");

        assert_eq!(info.shell_id, "shell-1");
        assert_eq!(info.pid, 12345);
        assert_eq!(info.command, "echo hello");
        assert!(info.working_dir.is_none());
    }

    #[test]
    fn test_shell_info_with_working_dir() {
        let info = ShellInfo::new("shell-1", 12345, "echo hello").with_working_dir("/home/user");

        assert_eq!(info.working_dir, Some("/home/user".to_string()));
    }

    #[test]
    fn test_shell_info_age() {
        let info = ShellInfo::new("shell-1", 12345, "echo hello");
        // Age should be close to 0 seconds
        assert!(info.age_seconds() >= 0);
        assert!(info.age_seconds() < 2); // Should be less than 2 seconds
    }

    #[test]
    fn test_registry_creation() {
        let registry = BackgroundShellRegistry::new();
        assert_eq!(registry.count(), 0);
    }

    #[test]
    fn test_register_shell() {
        let mut registry = BackgroundShellRegistry::new();
        let info = ShellInfo::new("shell-1", 12345, "echo hello");

        registry.register_shell(info.clone()).unwrap();

        assert_eq!(registry.count(), 1);
        assert!(registry.contains("shell-1"));

        let retrieved = registry.get_shell("shell-1").unwrap();
        assert_eq!(retrieved.shell_id, "shell-1");
        assert_eq!(retrieved.pid, 12345);
    }

    #[test]
    fn test_register_empty_id() {
        let mut registry = BackgroundShellRegistry::new();
        let info = ShellInfo::new("", 12345, "echo hello");

        let result = registry.register_shell(info);
        assert!(result.is_err());
    }

    #[test]
    fn test_list_shells() {
        let mut registry = BackgroundShellRegistry::new();

        registry
            .register_shell(ShellInfo::new("shell-1", 12345, "cmd1"))
            .unwrap();
        registry
            .register_shell(ShellInfo::new("shell-2", 67890, "cmd2"))
            .unwrap();

        let shells = registry.list_shells();
        assert_eq!(shells.len(), 2);

        let ids = registry.list_shell_ids();
        assert!(ids.contains(&"shell-1".to_string()));
        assert!(ids.contains(&"shell-2".to_string()));
    }

    #[test]
    fn test_unregister_shell() {
        let mut registry = BackgroundShellRegistry::new();
        registry
            .register_shell(ShellInfo::new("shell-1", 12345, "cmd"))
            .unwrap();

        assert_eq!(registry.count(), 1);

        let removed = registry.unregister_shell("shell-1");
        assert!(removed.is_some());
        assert_eq!(registry.count(), 0);
    }

    #[test]
    fn test_get_nonexistent_shell() {
        let registry = BackgroundShellRegistry::new();
        assert!(registry.get_shell("nonexistent").is_none());
    }

    #[test]
    fn test_serialization() {
        let mut registry = BackgroundShellRegistry::new();
        registry
            .register_shell(ShellInfo::new("shell-1", 12345, "echo test"))
            .unwrap();

        let json = serde_json::to_string(&registry).unwrap();
        let deserialized: BackgroundShellRegistry = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.count(), 1);
        assert!(deserialized.contains("shell-1"));
    }
}
