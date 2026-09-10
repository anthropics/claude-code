//! Process sandboxing

use std::process::Stdio;
use tokio::process::Command;

/// Process sandbox
pub struct ProcessSandbox {
    /// Working directory
    cwd: String,
    /// Environment variables
    env: Vec<(String, String)>,
    /// Resource limits
    memory_limit_mb: Option<usize>,
    /// Timeout seconds
    timeout_secs: u64,
}

impl ProcessSandbox {
    /// Create new sandbox
    pub fn new(cwd: impl Into<String>) -> Self {
        Self {
            cwd: cwd.into(),
            env: Vec::new(),
            memory_limit_mb: None,
            timeout_secs: 30,
        }
    }
    
    /// Set memory limit
    pub fn with_memory_limit(mut self, mb: usize) -> Self {
        self.memory_limit_mb = Some(mb);
        self
    }
    
    /// Set timeout
    pub fn with_timeout(mut self, secs: u64) -> Self {
        self.timeout_secs = secs;
        self
    }
    
    /// Add environment variable
    pub fn with_env(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.env.push((key.into(), value.into()));
        self
    }
    
    /// Execute command in sandbox
    pub async fn execute(&self, command: &str, args: &[&str]) -> std::io::Result<std::process::Output> {
        let mut cmd = Command::new(command);
        cmd.args(args)
            .current_dir(&self.cwd)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        
        for (key, value) in &self.env {
            cmd.env(key, value);
        }
        
        cmd.output().await
    }
    
    /// Check if command is allowed
    pub fn is_allowed(&self, _command: &str) -> bool {
        true
    }
}

