//! Sandbox system - network restrictions, bash sandboxing

use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::PathBuf;
use tracing::{debug, error, info, warn};

/// Sandbox configuration
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SandboxConfig {
    pub enabled: bool,
    pub bash_sandbox: BashSandboxConfig,
    pub network: NetworkSandboxConfig,
    pub filesystem: FilesystemSandboxConfig,
    pub allow_weaker_nested_sandbox: bool,
}

impl Default for SandboxConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            bash_sandbox: BashSandboxConfig::default(),
            network: NetworkSandboxConfig::default(),
            filesystem: FilesystemSandboxConfig::default(),
            allow_weaker_nested_sandbox: false,
        }
    }
}

/// Bash command sandboxing
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct BashSandboxConfig {
    pub auto_allow_sandboxed: bool,
    pub excluded_commands: Vec<String>,
    pub allowed_commands: Vec<String>,
    pub blocked_commands: Vec<String>,
    pub require_confirmation_for: Vec<String>,
}

impl Default for BashSandboxConfig {
    fn default() -> Self {
        Self {
            auto_allow_sandboxed: false,
            excluded_commands: vec![],
            allowed_commands: vec![],
            blocked_commands: vec![
                "rm -rf /".to_string(),
                "mkfs".to_string(),
                "dd if=/dev/zero".to_string(),
                ":(){ :|:& };:".to_string(), // Fork bomb
            ],
            require_confirmation_for: vec![
                "rm -rf".to_string(),
                "sudo -S -p ''".to_string(),
                "chmod 777".to_string(),
            ],
        }
    }
}

/// Network sandboxing configuration
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct NetworkSandboxConfig {
    pub allow_all: bool,
    pub allowed_domains: Vec<String>,
    pub blocked_domains: Vec<String>,
    pub allow_unix_sockets: Vec<String>,
    pub allow_all_unix_sockets: bool,
    pub allow_local_binding: bool,
    pub http_proxy_port: Option<u16>,
    pub socks_proxy_port: Option<u16>,
}

impl Default for NetworkSandboxConfig {
    fn default() -> Self {
        Self {
            allow_all: false,
            allowed_domains: vec![
                "api.github.com".to_string(),
                "github.com".to_string(),
                "crates.io".to_string(),
                "docs.rs".to_string(),
            ],
            blocked_domains: vec![],
            allow_unix_sockets: vec![],
            allow_all_unix_sockets: false,
            allow_local_binding: false,
            http_proxy_port: None,
            socks_proxy_port: None,
        }
    }
}

/// Filesystem sandboxing
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct FilesystemSandboxConfig {
    pub read_paths: Vec<PathBuf>,
    pub write_paths: Vec<PathBuf>,
    pub deny_paths: Vec<PathBuf>,
    pub allow_git_dirs: bool,
}

impl Default for FilesystemSandboxConfig {
    fn default() -> Self {
        Self {
            read_paths: vec![],
            write_paths: vec![],
            deny_paths: vec![],
            allow_git_dirs: true,
        }
    }
}

/// Sandbox enforcer
pub struct Sandbox {
    config: SandboxConfig,
    blocked_patterns: Vec<regex::Regex>,
}

impl Sandbox {
    pub fn new(config: SandboxConfig) -> Self {
        let blocked_patterns = config.bash_sandbox.blocked_commands.iter()
            .filter_map(|cmd| {
                regex::Regex::new(&regex::escape(cmd)).ok()
            })
            .collect();

        Self {
            config,
            blocked_patterns,
        }
    }

    /// Check if a bash command is allowed
    pub fn check_bash(&self, command: &str) -> SandboxDecision {
        if !self.config.enabled {
            return SandboxDecision::Allow;
        }

        // Check blocked commands
        for pattern in &self.blocked_patterns {
            if pattern.is_match(command) {
                return SandboxDecision::Block(format!(
                    "Command '{}' matches blocked pattern",
                    command
                ));
            }
        }

        // Check require confirmation
        for pattern in &self.config.bash_sandbox.require_confirmation_for {
            if command.contains(pattern) {
                return SandboxDecision::Ask(format!(
                    "Command '{}' contains '{}' which requires confirmation",
                    command, pattern
                ));
            }
        }

        SandboxDecision::Allow
    }

    /// Check network access
    pub fn check_network(&self, domain: &str) -> SandboxDecision {
        if !self.config.enabled || self.config.network.allow_all {
            return SandboxDecision::Allow;
        }

        // Check blocked domains
        for blocked in &self.config.network.blocked_domains {
            if domain == blocked || domain.ends_with(&format!(".{}", blocked)) {
                return SandboxDecision::Block(format!(
                    "Domain '{}' is blocked",
                    domain
                ));
            }
        }

        // Check allowed domains
        for allowed in &self.config.network.allowed_domains {
            if domain == allowed || domain.ends_with(&format!(".{}", allowed)) {
                return SandboxDecision::Allow;
            }
        }

        SandboxDecision::Ask(format!(
            "Domain '{}' is not in the allowlist",
            domain
        ))
    }

    /// Check filesystem access
    pub fn check_filesystem(&self, path: &PathBuf, write: bool) -> SandboxDecision {
        if !self.config.enabled {
            return SandboxDecision::Allow;
        }

        // Check deny paths
        for deny in &self.config.filesystem.deny_paths {
            if path.starts_with(deny) {
                return SandboxDecision::Block(format!(
                    "Access to '{}' is denied",
                    path.display()
                ));
            }
        }

        // For writes, check write paths
        if write {
            if self.config.filesystem.write_paths.is_empty() {
                // If no specific write paths, allow writes in project
                return SandboxDecision::Allow;
            }
            for allowed in &self.config.filesystem.write_paths {
                if path.starts_with(allowed) {
                    return SandboxDecision::Allow;
                }
            }
            return SandboxDecision::Ask(format!(
                "Write to '{}' is outside allowed paths",
                path.display()
            ));
        }

        SandboxDecision::Allow
    }

    /// Check if command looks like a sandbox escape attempt
    pub fn detect_escape_attempt(&self, command: &str) -> Option<String> {
        let suspicious_patterns = [
            "sudo -S -p ''",
            "su -",
            "docker run --privileged",
            "docker.sock",
            "/proc/self",
            "chroot",
            "mount",
            "mknod",
        ];

        for pattern in &suspicious_patterns {
            if command.contains(pattern) {
                return Some(format!(
                    "Command '{}' may be attempting to escape sandbox",
                    command
                ));
            }
        }

        None
    }
}

/// Sandbox decision
#[derive(Clone, Debug)]
pub enum SandboxDecision {
    Allow,
    Ask(String),
    Block(String),
}

impl SandboxDecision {
    pub fn is_allowed(&self) -> bool {
        matches!(self, SandboxDecision::Allow)
    }

    pub fn is_blocked(&self) -> bool {
        matches!(self, SandboxDecision::Block(_))
    }

    pub fn is_ask(&self) -> bool {
        matches!(self, SandboxDecision::Ask(_))
    }

    pub fn message(&self) -> Option<&str> {
        match self {
            SandboxDecision::Block(msg) | SandboxDecision::Ask(msg) => Some(msg),
            SandboxDecision::Allow => None,
        }
    }
}

/// Sandboxed command executor
pub struct SandboxedExecutor {
    sandbox: Sandbox,
}

impl SandboxedExecutor {
    pub fn new(sandbox: Sandbox) -> Self {
        Self { sandbox }
    }

    /// Execute a command with sandbox checks
    pub async fn execute(&self, command: &str) -> anyhow::Result<SandboxedOutput> {
        // Check command
        let decision = self.sandbox.check_bash(command);

        match decision {
            SandboxDecision::Block(msg) => {
                return Ok(SandboxedOutput {
                    success: false,
                    stdout: String::new(),
                    stderr: msg,
                    exit_code: 1,
                    sandboxed: true,
                });
            }
            SandboxDecision::Ask(msg) => {
                // In real implementation, would prompt user
                info!("Sandbox asking: {}", msg);
            }
            SandboxDecision::Allow => {}
        }

        // Execute the command
        use tokio::process::Command;

        let output = Command::new("sh")
            .arg("-c")
            .arg(command)
            .output()
            .await?;

        Ok(SandboxedOutput {
            success: output.status.success(),
            stdout: String::from_utf8_lossy(&output.stdout).to_string(),
            stderr: String::from_utf8_lossy(&output.stderr).to_string(),
            exit_code: output.status.code().unwrap_or(-1),
            sandboxed: true,
        })
    }
}

/// Output from sandboxed execution
pub struct SandboxedOutput {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    pub sandboxed: bool,
}

