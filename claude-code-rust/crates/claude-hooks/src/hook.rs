//! Hook type definitions and configurations.
//!
//! This module defines the different types of hooks and their configurations.

use regex::Regex;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use thiserror::Error;

/// Errors that can occur during hook configuration.
#[derive(Error, Debug)]
pub enum HookError {
    #[error("Invalid regex pattern: {0}")]
    InvalidRegex(#[from] regex::Error),

    #[error("Hook configuration error: {0}")]
    ConfigError(String),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    JsonError(#[from] serde_json::Error),
}

/// Types of hooks supported by Claude Code.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Hook {
    /// Runs at session initialization, can add context to the prompt.
    SessionStart,

    /// Runs before tool execution, can block or allow the tool.
    PreToolUse,

    /// Runs after tool execution, for logging and validation.
    PostToolUse,
}

impl Hook {
    /// Returns the string representation of this hook type.
    pub fn as_str(&self) -> &'static str {
        match self {
            Hook::SessionStart => "SessionStart",
            Hook::PreToolUse => "PreToolUse",
            Hook::PostToolUse => "PostToolUse",
        }
    }

    /// Parses a hook type from a string.
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "SessionStart" => Some(Hook::SessionStart),
            "PreToolUse" => Some(Hook::PreToolUse),
            "PostToolUse" => Some(Hook::PostToolUse),
            _ => None,
        }
    }
}

impl std::fmt::Display for Hook {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// Definition of a single hook.
///
/// A hook definition specifies:
/// - The type of hook (SessionStart, PreToolUse, PostToolUse)
/// - The command to execute
/// - An optional regex matcher for filtering tool names (PreToolUse/PostToolUse only)
/// - An optional working directory for command execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookDefinition {
    /// Type of hook
    #[serde(rename = "hook")]
    pub hook_type: Hook,

    /// Command to execute (can include arguments)
    pub command: String,

    /// Optional regex pattern to match tool names
    /// Only applies to PreToolUse and PostToolUse hooks
    #[serde(skip_serializing_if = "Option::is_none")]
    pub matcher: Option<String>,

    /// Optional working directory for command execution
    #[serde(skip_serializing_if = "Option::is_none")]
    pub working_dir: Option<PathBuf>,

    /// Compiled regex matcher (not serialized, built at runtime)
    #[serde(skip)]
    compiled_matcher: Option<Regex>,
}

impl HookDefinition {
    /// Creates a new hook definition.
    pub fn new(
        hook_type: Hook,
        command: String,
        matcher: Option<String>,
        working_dir: Option<PathBuf>,
    ) -> Result<Self, HookError> {
        let compiled_matcher = if let Some(pattern) = &matcher {
            Some(Regex::new(pattern)?)
        } else {
            None
        };

        Ok(Self {
            hook_type,
            command,
            matcher,
            working_dir,
            compiled_matcher,
        })
    }

    /// Compiles the regex matcher if not already compiled.
    pub fn compile_matcher(&mut self) -> Result<(), HookError> {
        if self.compiled_matcher.is_none() {
            if let Some(pattern) = &self.matcher {
                self.compiled_matcher = Some(Regex::new(pattern)?);
            }
        }
        Ok(())
    }

    /// Checks if this hook should run for the given tool name.
    ///
    /// Returns true if:
    /// - There is no matcher (hook runs for all tools), or
    /// - The matcher pattern matches the tool name
    pub fn matches_tool(&self, tool_name: &str) -> bool {
        match &self.compiled_matcher {
            None => true, // No matcher means match all
            Some(regex) => regex.is_match(tool_name),
        }
    }

    /// Returns true if this is a SessionStart hook.
    pub fn is_session_start(&self) -> bool {
        self.hook_type == Hook::SessionStart
    }

    /// Returns true if this is a PreToolUse hook.
    pub fn is_pre_tool_use(&self) -> bool {
        self.hook_type == Hook::PreToolUse
    }

    /// Returns true if this is a PostToolUse hook.
    pub fn is_post_tool_use(&self) -> bool {
        self.hook_type == Hook::PostToolUse
    }
}

/// Configuration for a set of hooks loaded from a hooks.json file.
///
/// # Example hooks.json
/// ```json
/// {
///   "hooks": [
///     {
///       "hook": "SessionStart",
///       "command": "node setup.js"
///     },
///     {
///       "hook": "PreToolUse",
///       "command": "python validate.py",
///       "matcher": "^(Write|Edit)$"
///     },
///     {
///       "hook": "PostToolUse",
///       "command": "bash log.sh",
///       "working_dir": "/tmp/logs"
///     }
///   ]
/// }
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookConfig {
    /// List of hook definitions
    pub hooks: Vec<HookDefinition>,
}

impl HookConfig {
    /// Creates a new empty hook configuration.
    pub fn new() -> Self {
        Self { hooks: Vec::new() }
    }

    /// Loads hook configuration from a JSON file.
    pub fn from_file(path: &PathBuf) -> Result<Self, HookError> {
        let content = std::fs::read_to_string(path)?;
        let mut config: HookConfig = serde_json::from_str(&content)?;

        // Compile all matchers
        for hook in &mut config.hooks {
            hook.compile_matcher()?;
        }

        Ok(config)
    }

    /// Loads hook configuration from a JSON string.
    pub fn from_json(json: &str) -> Result<Self, HookError> {
        let mut config: HookConfig = serde_json::from_str(json)?;

        // Compile all matchers
        for hook in &mut config.hooks {
            hook.compile_matcher()?;
        }

        Ok(config)
    }

    /// Adds a hook definition to this configuration.
    pub fn add_hook(&mut self, hook: HookDefinition) {
        self.hooks.push(hook);
    }

    /// Returns all hooks of a specific type.
    pub fn hooks_of_type(&self, hook_type: Hook) -> Vec<&HookDefinition> {
        self.hooks
            .iter()
            .filter(|h| h.hook_type == hook_type)
            .collect()
    }

    /// Returns all SessionStart hooks.
    pub fn session_start_hooks(&self) -> Vec<&HookDefinition> {
        self.hooks_of_type(Hook::SessionStart)
    }

    /// Returns all PreToolUse hooks that match the given tool name.
    pub fn pre_tool_hooks(&self, tool_name: &str) -> Vec<&HookDefinition> {
        self.hooks
            .iter()
            .filter(|h| h.is_pre_tool_use() && h.matches_tool(tool_name))
            .collect()
    }

    /// Returns all PostToolUse hooks that match the given tool name.
    pub fn post_tool_hooks(&self, tool_name: &str) -> Vec<&HookDefinition> {
        self.hooks
            .iter()
            .filter(|h| h.is_post_tool_use() && h.matches_tool(tool_name))
            .collect()
    }
}

impl Default for HookConfig {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hook_from_str() {
        assert_eq!(Hook::from_str("SessionStart"), Some(Hook::SessionStart));
        assert_eq!(Hook::from_str("PreToolUse"), Some(Hook::PreToolUse));
        assert_eq!(Hook::from_str("PostToolUse"), Some(Hook::PostToolUse));
        assert_eq!(Hook::from_str("Unknown"), None);
    }

    #[test]
    fn test_hook_definition_matcher() {
        let hook = HookDefinition::new(
            Hook::PreToolUse,
            "test.sh".to_string(),
            Some("^(Write|Edit)$".to_string()),
            None,
        )
        .unwrap();

        assert!(hook.matches_tool("Write"));
        assert!(hook.matches_tool("Edit"));
        assert!(!hook.matches_tool("Read"));
        assert!(!hook.matches_tool("Bash"));
    }

    #[test]
    fn test_hook_definition_no_matcher() {
        let hook =
            HookDefinition::new(Hook::PreToolUse, "test.sh".to_string(), None, None).unwrap();

        // Without matcher, should match all tools
        assert!(hook.matches_tool("Write"));
        assert!(hook.matches_tool("Read"));
        assert!(hook.matches_tool("Bash"));
    }

    #[test]
    fn test_hook_config_from_json() {
        let json = r#"{
            "hooks": [
                {
                    "hook": "SessionStart",
                    "command": "echo 'start'"
                },
                {
                    "hook": "PreToolUse",
                    "command": "validate.sh",
                    "matcher": "^Write$"
                }
            ]
        }"#;

        let config = HookConfig::from_json(json).unwrap();
        assert_eq!(config.hooks.len(), 2);
        assert!(config.hooks[0].is_session_start());
        assert!(config.hooks[1].is_pre_tool_use());
    }

    #[test]
    fn test_hook_config_filtering() {
        let mut config = HookConfig::new();

        config.add_hook(
            HookDefinition::new(Hook::SessionStart, "start.sh".to_string(), None, None).unwrap(),
        );

        config.add_hook(
            HookDefinition::new(
                Hook::PreToolUse,
                "pre.sh".to_string(),
                Some("^Write$".to_string()),
                None,
            )
            .unwrap(),
        );

        config.add_hook(
            HookDefinition::new(Hook::PostToolUse, "post.sh".to_string(), None, None).unwrap(),
        );

        assert_eq!(config.session_start_hooks().len(), 1);
        assert_eq!(config.pre_tool_hooks("Write").len(), 1);
        assert_eq!(config.pre_tool_hooks("Read").len(), 0);
        assert_eq!(config.post_tool_hooks("Write").len(), 1);
    }
}
