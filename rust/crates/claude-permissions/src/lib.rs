//! Advanced permission system with auto-allow patterns
//!
//! Features:
//! - Auto-allow patterns with regex matching
//! - Auto-deny patterns for dangerous operations
//! - Per-tool permission configuration
//! - Session-based permission history
//! - Persistent user preferences

use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::sync::Arc;
use thiserror::Error;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

/// Errors in the permission system
#[derive(Debug, Error, Clone)]
pub enum PermissionError {
    #[error("Invalid pattern: {0}")]
    InvalidPattern(String),
    
    #[error("Permission denied: {0}")]
    Denied(String),
}

/// Permission decision result
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PermissionDecision {
    /// Allow without prompting
    Allow,
    /// Deny without prompting
    Deny,
    /// Ask the user for confirmation
    Ask,
}

/// Permission mode with extended options
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PermissionMode {
    /// Always prompt for permission
    Ask,
    /// Auto-allow all safe operations, prompt for dangerous ones
    Auto,
    /// Auto-allow everything (dangerous!)
    AutoYes,
    /// Deny all write operations
    ReadOnly,
    /// Use learned patterns from session history
    Learned,
}

impl Default for PermissionMode {
    fn default() -> Self {
        PermissionMode::Auto
    }
}

/// A permission pattern rule
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionPattern {
    /// Pattern name
    pub name: String,
    /// Regex pattern to match
    pub pattern: String,
    /// Action to take when matched
    pub action: PatternAction,
    /// Optional tool name restriction
    pub tool: Option<String>,
    /// Priority (higher = checked first)
    pub priority: i32,
}

/// Action to take when pattern matches
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PatternAction {
    Allow,
    Deny,
    Ask,
}

/// Permission configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionConfig {
    /// Current permission mode
    pub mode: PermissionMode,
    /// Auto-allow patterns
    pub allow_patterns: Vec<PermissionPattern>,
    /// Auto-deny patterns
    pub deny_patterns: Vec<PermissionPattern>,
    /// Per-tool overrides
    pub tool_overrides: HashMap<String, ToolPermission>,
    /// Always deny these command patterns
    pub dangerous_patterns: Vec<String>,
    /// Always allow these command patterns in safe mode
    pub safe_patterns: Vec<String>,
}

impl Default for PermissionConfig {
    fn default() -> Self {
        Self::new()
    }
}

impl PermissionConfig {
    /// Create default configuration
    pub fn new() -> Self {
        Self {
            mode: PermissionMode::Auto,
            allow_patterns: Self::default_allow_patterns(),
            deny_patterns: Self::default_deny_patterns(),
            tool_overrides: HashMap::new(),
            dangerous_patterns: Self::default_dangerous_patterns(),
            safe_patterns: Self::default_safe_patterns(),
        }
    }
    
    /// Default allow patterns
    fn default_allow_patterns() -> Vec<PermissionPattern> {
        vec![
            PermissionPattern {
                name: "read-operations".to_string(),
                pattern: r"^(ls|cat|head|tail|grep|find|echo|pwd|which|type|file)".to_string(),
                action: PatternAction::Allow,
                tool: Some("Bash".to_string()),
                priority: 100,
            },
            PermissionPattern {
                name: "git-read".to_string(),
                pattern: r"^git\s+(status|log|show|diff|ls-files|branch\s+-a|remote\s+-v)".to_string(),
                action: PatternAction::Allow,
                tool: Some("Git".to_string()),
                priority: 90,
            },
            PermissionPattern {
                name: "read-files".to_string(),
                pattern: r".*".to_string(),
                action: PatternAction::Allow,
                tool: Some("Read".to_string()),
                priority: 100,
            },
            PermissionPattern {
                name: "glob-search".to_string(),
                pattern: r".*".to_string(),
                action: PatternAction::Allow,
                tool: Some("Glob".to_string()),
                priority: 100,
            },
            PermissionPattern {
                name: "grep-search".to_string(),
                pattern: r".*".to_string(),
                action: PatternAction::Allow,
                tool: Some("Grep".to_string()),
                priority: 100,
            },
            PermissionPattern {
                name: "list-dir".to_string(),
                pattern: r".*".to_string(),
                action: PatternAction::Allow,
                tool: Some("LS".to_string()),
                priority: 100,
            },
        ]
    }
    
    /// Default deny patterns (dangerous operations)
    fn default_deny_patterns() -> Vec<PermissionPattern> {
        vec![
            PermissionPattern {
                name: "rm-root".to_string(),
                pattern: r"rm\s+.*(/|\\)\s*$".to_string(),
                action: PatternAction::Deny,
                tool: Some("Bash".to_string()),
                priority: 1000,
            },
            PermissionPattern {
                name: "rm-rf".to_string(),
                pattern: r"rm\s+-[a-zA-Z]*r[a-zA-Z]*\s+.*(/|\\)(\s|$)".to_string(),
                action: PatternAction::Deny,
                tool: Some("Bash".to_string()),
                priority: 999,
            },
            PermissionPattern {
                name: "dd-device".to_string(),
                pattern: r"dd\s+.*of=/dev/".to_string(),
                action: PatternAction::Deny,
                tool: Some("Bash".to_string()),
                priority: 998,
            },
            PermissionPattern {
                name: "format-disk".to_string(),
                pattern: r"(mkfs|newfs|format)".to_string(),
                action: PatternAction::Deny,
                tool: Some("Bash".to_string()),
                priority: 997,
            },
            PermissionPattern {
                name: "fork-bomb".to_string(),
                pattern: r":\(\)|while\s+true\s*;\s*do.*done".to_string(),
                action: PatternAction::Deny,
                tool: Some("Bash".to_string()),
                priority: 996,
            },
        ]
    }
    
    /// Default dangerous command patterns
    fn default_dangerous_patterns() -> Vec<String> {
        vec![
            r"^\s*rm\s+.*\s+[/\\]\s*$".to_string(),  // rm on root
            r"^\s*rm\s+-[a-zA-Z]*f[a-zA-Z]*.*".to_string(),  // rm -f
            r"^\s*dd\s+.*of=/dev/".to_string(),  // dd to device
            r"^\s*mkfs\s+".to_string(),  // format
            r"^\s*>\s*/dev/".to_string(),  // redirect to device
            r"^\s*sudo -S -p ''\s+rm".to_string(),  // sudo -S -p '' rm
            r"^\s*:\(\)|while\s+true\s*;\s*do\s*:;\s*done".to_string(),  // fork bomb
            r"^\s*chmod\s+-R\s+777\s+/".to_string(),  // chmod 777 /
            r"^\s*chown\s+-R\s+.*\s+/".to_string(),  // chown /
        ]
    }
    
    /// Default safe command patterns
    fn default_safe_patterns() -> Vec<String> {
        vec![
            r"^\s*(ls|ll|la|dir)\s*".to_string(),
            r"^\s*(cat|head|tail|less|more)\s+".to_string(),
            r"^\s*(grep|egrep|fgrep|rg)\s+".to_string(),
            r"^\s*(find|locate|which|type|file|stat)\s+".to_string(),
            r"^\s*(echo|printf|pwd|whoami|date|cal)\s*".to_string(),
            r"^\s*git\s+(status|log|diff|show|ls-files|branch\s+-a|remote\s+-v)\s*".to_string(),
            r"^\s*git\s+(stash\s+list|config\s+--list)\s*".to_string(),
            r"^\s*cd\s+".to_string(),
            r"^\s*tree\s*".to_string(),
            r"^\s*(wc|sort|uniq)\s*".to_string(),
        ]
    }
    
    /// Add a custom allow pattern
    pub fn add_allow_pattern(&mut self, name: impl Into<String>, pattern: impl Into<String>) -> Result<(), PermissionError> {
        let name = name.into();
        let pattern_str = pattern.into();
        
        // Validate regex
        Regex::new(&pattern_str)
            .map_err(|e| PermissionError::InvalidPattern(e.to_string()))?;
        
        self.allow_patterns.push(PermissionPattern {
            name,
            pattern: pattern_str,
            action: PatternAction::Allow,
            tool: None,
            priority: 50,
        });
        
        Ok(())
    }
    
    /// Add a custom deny pattern
    pub fn add_deny_pattern(&mut self, name: impl Into<String>, pattern: impl Into<String>) -> Result<(), PermissionError> {
        let name = name.into();
        let pattern_str = pattern.into();
        
        // Validate regex
        Regex::new(&pattern_str)
            .map_err(|e| PermissionError::InvalidPattern(e.to_string()))?;
        
        self.deny_patterns.push(PermissionPattern {
            name,
            pattern: pattern_str,
            action: PatternAction::Deny,
            tool: None,
            priority: 500,
        });
        
        Ok(())
    }
    
    /// Set permission mode
    pub fn with_mode(mut self, mode: PermissionMode) -> Self {
        self.mode = mode;
        self
    }
}

/// Per-tool permission settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolPermission {
    /// Default action for this tool
    pub default_action: PatternAction,
    /// Tool-specific patterns
    pub patterns: Vec<PermissionPattern>,
    /// Whether to require confirmation for all operations
    pub always_confirm: bool,
    /// Read-only mode for this tool
    pub read_only: bool,
}

impl Default for ToolPermission {
    fn default() -> Self {
        Self {
            default_action: PatternAction::Ask,
            patterns: Vec::new(),
            always_confirm: false,
            read_only: false,
        }
    }
}

/// Advanced permission checker
pub struct AdvancedPermissionChecker {
    /// Configuration
    config: Arc<RwLock<PermissionConfig>>,
    /// Session permission history
    history: Arc<RwLock<Vec<PermissionHistoryEntry>>>,
    /// Compiled allow patterns
    compiled_allow: Arc<RwLock<Vec<(PermissionPattern, Regex)>>>,
    /// Compiled deny patterns
    compiled_deny: Arc<RwLock<Vec<(PermissionPattern, Regex)>>>,
    /// Learned patterns (user's past decisions)
    learned_patterns: Arc<RwLock<Vec<PermissionPattern>>>,
}

/// Permission history entry
#[derive(Debug, Clone)]
pub struct PermissionHistoryEntry {
    pub timestamp: std::time::SystemTime,
    pub tool: String,
    pub command: String,
    pub decision: PermissionDecision,
    pub user_confirmed: bool,
}

impl AdvancedPermissionChecker {
    /// Create a new permission checker with default config
    pub fn new() -> Self {
        let config = PermissionConfig::new();
        Self::with_config(config)
    }
    
    /// Create with specific config
    pub fn with_config(config: PermissionConfig) -> Self {
        let compiled_allow = Self::compile_patterns(&config.allow_patterns);
        let compiled_deny = Self::compile_patterns(&config.deny_patterns);
        
        Self {
            config: Arc::new(RwLock::new(config)),
            history: Arc::new(RwLock::new(Vec::new())),
            compiled_allow: Arc::new(RwLock::new(compiled_allow)),
            compiled_deny: Arc::new(RwLock::new(compiled_deny)),
            learned_patterns: Arc::new(RwLock::new(Vec::new())),
        }
    }
    
    /// Compile patterns to regexes
    fn compile_patterns(patterns: &[PermissionPattern]) -> Vec<(PermissionPattern, Regex)> {
        patterns
            .iter()
            .filter_map(|p| {
                Regex::new(&p.pattern)
                    .ok()
                    .map(|r| (p.clone(), r))
            })
            .collect()
    }
    
    /// Check if an operation is allowed
    pub async fn check(&self, tool: &str, command: &str) -> PermissionDecision {
        let config = self.config.read().await;
        
        // Check mode-based override
        match config.mode {
            PermissionMode::AutoYes => return PermissionDecision::Allow,
            PermissionMode::ReadOnly => {
                if is_write_operation(tool, command) {
                    return PermissionDecision::Deny;
                }
            }
            PermissionMode::Ask => return PermissionDecision::Ask,
            _ => {}
        }
        
        // Check deny patterns first (higher priority)
        let deny_guard = self.compiled_deny.read().await;
        for (pattern, regex) in deny_guard.iter() {
            if pattern.tool.as_ref().map(|t| t == tool).unwrap_or(true) {
                if regex.is_match(command) {
                    warn!("Deny pattern '{}' matched: {}", pattern.name, command);
                    return PermissionDecision::Deny;
                }
            }
        }
        drop(deny_guard);
        
        // Check allow patterns
        let allow_guard = self.compiled_allow.read().await;
        for (pattern, regex) in allow_guard.iter() {
            if pattern.tool.as_ref().map(|t| t == tool).unwrap_or(true) {
                if regex.is_match(command) {
                    debug!("Allow pattern '{}' matched: {}", pattern.name, command);
                    return PermissionDecision::Allow;
                }
            }
        }
        drop(allow_guard);
        
        // Check learned patterns in Learned mode
        if config.mode == PermissionMode::Learned {
            let learned = self.learned_patterns.read().await;
            for pattern in learned.iter() {
                if let Ok(regex) = Regex::new(&pattern.pattern) {
                    if regex.is_match(command) {
                        match pattern.action {
                            PatternAction::Allow => return PermissionDecision::Allow,
                            PatternAction::Deny => return PermissionDecision::Deny,
                            PatternAction::Ask => return PermissionDecision::Ask,
                        }
                    }
                }
            }
        }
        
        // Check tool-specific override
        if let Some(tool_perm) = config.tool_overrides.get(tool) {
            if tool_perm.read_only && is_write_operation(tool, command) {
                return PermissionDecision::Deny;
            }
            if tool_perm.always_confirm {
                return PermissionDecision::Ask;
            }
        }
        
        // Default based on mode
        match config.mode {
            PermissionMode::Auto => {
                // In auto mode, safe operations are allowed, others ask
                if is_dangerous(command) {
                    PermissionDecision::Ask
                } else if is_safe(tool, command, &config) {
                    PermissionDecision::Allow
                } else {
                    PermissionDecision::Ask
                }
            }
            _ => PermissionDecision::Ask,
        }
    }
    
    /// Record a permission decision for learning
    pub async fn record_decision(&self, tool: String, command: String, decision: PermissionDecision, user_confirmed: bool) {
        let entry = PermissionHistoryEntry {
            timestamp: std::time::SystemTime::now(),
            tool,
            command: command.clone(),
            decision,
            user_confirmed,
        };
        
        let mut history = self.history.write().await;
        history.push(entry);
        
        // In learned mode, add pattern if user consistently allows similar commands
        if user_confirmed && decision == PermissionDecision::Allow {
            self.add_learned_pattern(&command).await;
        }
    }
    
    /// Add a learned pattern from user behavior
    async fn add_learned_pattern(&self, command: &str) {
        // Simple pattern extraction - in production, could be more sophisticated
        let pattern = regex::escape(command);
        
        let learned = PermissionPattern {
            name: format!("learned-{}", command.chars().take(20).collect::<String>()),
            pattern: format!("^{}$", pattern),
            action: PatternAction::Allow,
            tool: None,
            priority: 25,
        };
        
        let mut learned_guard = self.learned_patterns.write().await;
        learned_guard.push(learned);
        
        info!("Learned new permission pattern for: {}", command);
    }
    
    /// Update configuration
    pub async fn update_config(&self, new_config: PermissionConfig) {
        let compiled_allow = Self::compile_patterns(&new_config.allow_patterns);
        let compiled_deny = Self::compile_patterns(&new_config.deny_patterns);
        
        let mut config_guard = self.config.write().await;
        *config_guard = new_config;
        drop(config_guard);
        
        let mut allow_guard = self.compiled_allow.write().await;
        *allow_guard = compiled_allow;
        drop(allow_guard);
        
        let mut deny_guard = self.compiled_deny.write().await;
        *deny_guard = compiled_deny;
    }
    
    /// Get current configuration
    pub async fn config(&self) -> PermissionConfig {
        self.config.read().await.clone()
    }
    
    /// Get permission history
    pub async fn history(&self) -> Vec<PermissionHistoryEntry> {
        self.history.read().await.clone()
    }
    
    /// Export learned patterns
    pub async fn export_learned_patterns(&self) -> Vec<PermissionPattern> {
        self.learned_patterns.read().await.clone()
    }
}

impl Default for AdvancedPermissionChecker {
    fn default() -> Self {
        Self::new()
    }
}

/// Check if a command is considered dangerous
fn is_dangerous(command: &str) -> bool {
    let dangerous = [
        r"\brm\b",
        r"\bdd\b",
        r"\bmkfs\b",
        r"\bformat\b",
        r"\bsudo\b",
        r"\bchmod\s+.*777\b",
        r"\bchown\s+-R\b",
        r"\bwget\b.*\|\s*sh",
        r"\bcurl\b.*\|\s*sh",
        r"\b>\s*/\b",
    ];
    
    for pattern in &dangerous {
        if let Ok(regex) = Regex::new(pattern) {
            if regex.is_match(command) {
                return true;
            }
        }
    }
    
    false
}

/// Check if an operation is a write operation
fn is_write_operation(tool: &str, command: &str) -> bool {
    let write_tools = ["Write", "Edit", "FileWrite", "FileEdit"];
    if write_tools.contains(&tool) {
        return true;
    }
    
    let write_patterns = [
        r"\b(git\s+(push|merge|rebase|reset|revert|cherry-pick))\b",
        r"\b(write|edit|create|delete|remove|modify|update)\b",
        r"\b(touch|mkdir|rmdir|rm|mv|cp)\b",
    ];
    
    for pattern in &write_patterns {
        if let Ok(regex) = Regex::new(pattern) {
            if regex.is_match(command) {
                return true;
            }
        }
    }
    
    false
}

/// Check if an operation is considered safe
fn is_safe(tool: &str, command: &str, config: &PermissionConfig) -> bool {
    for pattern in &config.safe_patterns {
        if let Ok(regex) = Regex::new(pattern) {
            if regex.is_match(command) {
                return true;
            }
        }
    }
    
    // Read tools are always safe
    let read_tools = ["Read", "Grep", "Glob", "LS", "View"];
    if read_tools.contains(&tool) {
        return true;
    }
    
    false
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_default_allow_patterns() {
        let checker = AdvancedPermissionChecker::new();
        
        // Read operations should be allowed
        assert_eq!(
            checker.check("Bash", "ls -la").await,
            PermissionDecision::Allow
        );
        
        assert_eq!(
            checker.check("Bash", "cat file.txt").await,
            PermissionDecision::Allow
        );
    }
    
    #[tokio::test]
    async fn test_dangerous_patterns() {
        let checker = AdvancedPermissionChecker::new();
        
        // Dangerous operations should ask
        let decision = checker.check("Bash", "rm -rf /").await;
        assert!(matches!(decision, PermissionDecision::Deny | PermissionDecision::Ask));
    }
    
    #[tokio::test]
    async fn test_read_only_mode() {
        let config = PermissionConfig::new().with_mode(PermissionMode::ReadOnly);
        let checker = AdvancedPermissionChecker::with_config(config);
        
        // Read operations allowed
        assert_eq!(
            checker.check("Read", "/path/to/file").await,
            PermissionDecision::Allow
        );
        
        // Write operations denied
        assert_eq!(
            checker.check("Write", "/path/to/file").await,
            PermissionDecision::Deny
        );
    }
    
    #[tokio::test]
    async fn test_custom_pattern() {
        let mut config = PermissionConfig::new();
        config.add_allow_pattern("custom-test", r"my-custom-command").unwrap();
        
        let checker = AdvancedPermissionChecker::with_config(config);
        
        assert_eq!(
            checker.check("Bash", "my-custom-command arg1").await,
            PermissionDecision::Allow
        );
    }
}

