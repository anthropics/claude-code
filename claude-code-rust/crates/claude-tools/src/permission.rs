//! Permission system for tool execution
//!
//! This module provides a flexible permission system that allows
//! fine-grained control over which tools can be executed and with
//! what parameters. It supports wildcard pattern matching for
//! tool names and parameters.

use claude_core::{ClaudeError, Result, ToolInput};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Permission level for a tool
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum ToolPermission {
    /// Always allow execution without prompting
    Allow,

    /// Always deny execution
    Deny,

    /// Prompt the user before execution
    #[default]
    Prompt,
}

/// A permission rule with optional pattern matching
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionRule {
    /// Tool name or pattern (e.g., "Bash", "Bash:git *")
    pub pattern: String,

    /// Permission level for this rule
    pub permission: ToolPermission,

    /// Optional description of why this rule exists
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

impl PermissionRule {
    /// Create a new permission rule
    pub fn new(pattern: impl Into<String>, permission: ToolPermission) -> Self {
        Self {
            pattern: pattern.into(),
            permission,
            description: None,
        }
    }

    /// Add a description to the rule
    pub fn with_description(mut self, desc: impl Into<String>) -> Self {
        self.description = Some(desc.into());
        self
    }

    /// Check if this rule matches the given tool name and input
    ///
    /// Supports patterns like:
    /// - "Bash" - matches any Bash tool execution
    /// - "Bash:git *" - matches Bash with any git command
    /// - "Bash:*" - matches Bash with any command
    /// - "Read:/path/*" - matches Read tool for paths starting with /path/
    pub fn matches(&self, tool_name: &str, input: &ToolInput) -> bool {
        // Simple tool name match
        if self.pattern == tool_name {
            return true;
        }

        // Pattern with parameters (e.g., "Bash:git *")
        if let Some(colon_pos) = self.pattern.find(':') {
            let pattern_tool = &self.pattern[..colon_pos];
            let pattern_params = &self.pattern[colon_pos + 1..];

            // Check if tool name matches
            if pattern_tool != tool_name {
                return false;
            }

            // Check if parameters match the pattern
            return self.matches_params(pattern_params, input);
        }

        false
    }

    /// Match parameters against a pattern
    fn matches_params(&self, pattern: &str, input: &ToolInput) -> bool {
        // "*" matches anything
        if pattern == "*" {
            return true;
        }

        // Extract command from input for Bash tool
        if let Some(command) = input.get("command") {
            if let Some(cmd_str) = command.as_str() {
                return self.matches_wildcard(pattern, cmd_str);
            }
        }

        // Extract file_path for file tools
        if let Some(file_path) = input.get("file_path") {
            if let Some(path_str) = file_path.as_str() {
                return self.matches_wildcard(pattern, path_str);
            }
        }

        false
    }

    /// Simple wildcard matching (supports * as wildcard)
    fn matches_wildcard(&self, pattern: &str, text: &str) -> bool {
        // Split pattern by '*'
        let parts: Vec<&str> = pattern.split('*').collect();

        if parts.len() == 1 {
            // No wildcards, exact match
            return pattern == text;
        }

        let mut pos = 0;
        for (i, part) in parts.iter().enumerate() {
            if i == 0 {
                // First part must match the beginning
                if !text.starts_with(part) {
                    return false;
                }
                pos = part.len();
            } else if i == parts.len() - 1 {
                // Last part must match the end
                if !text.ends_with(part) {
                    return false;
                }
            } else {
                // Middle parts must appear in order
                if let Some(found_pos) = text[pos..].find(part) {
                    pos += found_pos + part.len();
                } else {
                    return false;
                }
            }
        }

        true
    }
}

/// Trait for checking tool permissions
pub trait PermissionChecker: Send + Sync {
    /// Check if a tool execution is allowed
    ///
    /// # Arguments
    /// * `tool_name` - Name of the tool to check
    /// * `input` - Input parameters for the tool
    ///
    /// # Returns
    /// The permission level for this tool execution
    fn check_permission(&self, tool_name: &str, input: &ToolInput) -> ToolPermission;

    /// Prompt the user for permission (if needed)
    ///
    /// This should be implemented by the UI layer to show a permission
    /// dialog to the user.
    fn prompt_user(&self, tool_name: &str, input: &ToolInput) -> bool {
        // Default implementation: deny
        let _ = (tool_name, input);
        false
    }
}

/// Default permission checker that uses a set of rules
pub struct DefaultPermissionChecker {
    rules: Vec<PermissionRule>,
    default_permission: ToolPermission,
}

impl DefaultPermissionChecker {
    /// Create a new permission checker with default permission
    pub fn new(default_permission: ToolPermission) -> Self {
        Self {
            rules: Vec::new(),
            default_permission,
        }
    }

    /// Create a permission checker that allows all tools
    pub fn allow_all() -> Self {
        Self::new(ToolPermission::Allow)
    }

    /// Create a permission checker that denies all tools
    pub fn deny_all() -> Self {
        Self::new(ToolPermission::Deny)
    }

    /// Create a permission checker that prompts for all tools
    pub fn prompt_all() -> Self {
        Self::new(ToolPermission::Prompt)
    }

    /// Add a permission rule
    pub fn add_rule(&mut self, rule: PermissionRule) {
        self.rules.push(rule);
    }

    /// Add multiple rules
    pub fn add_rules(&mut self, rules: Vec<PermissionRule>) {
        self.rules.extend(rules);
    }

    /// Parse rules from plugin frontmatter format
    ///
    /// Example format:
    /// ```yaml
    /// permissions:
    ///   - pattern: "Bash:git *"
    ///     permission: Allow
    ///   - pattern: "Read:/safe/*"
    ///     permission: Allow
    ///   - pattern: "Write"
    ///     permission: Deny
    /// ```
    pub fn from_config(config: &HashMap<String, serde_json::Value>) -> Result<Self> {
        let default_perm = if let Some(default) = config.get("default_permission") {
            serde_json::from_value(default.clone()).unwrap_or(ToolPermission::Prompt)
        } else {
            ToolPermission::Prompt
        };

        let mut checker = Self::new(default_perm);

        if let Some(rules_value) = config.get("permissions") {
            if let Ok(rules) = serde_json::from_value::<Vec<PermissionRule>>(rules_value.clone()) {
                checker.add_rules(rules);
            } else {
                return Err(ClaudeError::config("Invalid permissions configuration"));
            }
        }

        Ok(checker)
    }
}

impl PermissionChecker for DefaultPermissionChecker {
    fn check_permission(&self, tool_name: &str, input: &ToolInput) -> ToolPermission {
        // Check rules in order (first match wins)
        for rule in &self.rules {
            if rule.matches(tool_name, input) {
                return rule.permission.clone();
            }
        }

        // No matching rule, use default
        self.default_permission.clone()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_permission_rule_simple_match() {
        let rule = PermissionRule::new("Bash", ToolPermission::Allow);
        let input = ToolInput::new(json!({"command": "ls"})).unwrap();

        assert!(rule.matches("Bash", &input));
        assert!(!rule.matches("Read", &input));
    }

    #[test]
    fn test_permission_rule_wildcard_params() {
        let rule = PermissionRule::new("Bash:*", ToolPermission::Allow);
        let input = ToolInput::new(json!({"command": "git status"})).unwrap();

        assert!(rule.matches("Bash", &input));
    }

    #[test]
    fn test_permission_rule_specific_command() {
        let rule = PermissionRule::new("Bash:git *", ToolPermission::Allow);

        let git_input = ToolInput::new(json!({"command": "git status"})).unwrap();
        assert!(rule.matches("Bash", &git_input));

        let ls_input = ToolInput::new(json!({"command": "ls -la"})).unwrap();
        assert!(!rule.matches("Bash", &ls_input));
    }

    #[test]
    fn test_permission_rule_path_pattern() {
        let rule = PermissionRule::new("Read:/safe/*", ToolPermission::Allow);

        let safe_input = ToolInput::new(json!({"file_path": "/safe/file.txt"})).unwrap();
        assert!(rule.matches("Read", &safe_input));

        let unsafe_input = ToolInput::new(json!({"file_path": "/etc/passwd"})).unwrap();
        assert!(!rule.matches("Read", &unsafe_input));
    }

    #[test]
    fn test_wildcard_matching() {
        let rule = PermissionRule::new("test", ToolPermission::Allow);

        assert!(rule.matches_wildcard("git *", "git status"));
        assert!(rule.matches_wildcard("git *", "git commit -m 'test'"));
        assert!(!rule.matches_wildcard("git *", "npm install"));

        assert!(rule.matches_wildcard("*/test/*", "/path/test/file.txt"));
        assert!(!rule.matches_wildcard("*/test/*", "/path/other/file.txt"));

        assert!(rule.matches_wildcard("*", "anything"));
        assert!(rule.matches_wildcard("exact", "exact"));
        assert!(!rule.matches_wildcard("exact", "not exact"));
    }

    #[test]
    fn test_default_permission_checker() {
        let mut checker = DefaultPermissionChecker::allow_all();
        let input = ToolInput::new(json!({"command": "test"})).unwrap();

        assert_eq!(
            checker.check_permission("Bash", &input),
            ToolPermission::Allow
        );

        // Add a deny rule for specific command
        checker.add_rule(PermissionRule::new("Bash:rm *", ToolPermission::Deny));

        let rm_input = ToolInput::new(json!({"command": "rm -rf /"})).unwrap();
        assert_eq!(
            checker.check_permission("Bash", &rm_input),
            ToolPermission::Deny
        );

        let ls_input = ToolInput::new(json!({"command": "ls"})).unwrap();
        assert_eq!(
            checker.check_permission("Bash", &ls_input),
            ToolPermission::Allow
        );
    }

    #[test]
    fn test_permission_from_config() {
        let config = serde_json::json!({
            "default_permission": "Prompt",
            "permissions": [
                {
                    "pattern": "Bash:git *",
                    "permission": "Allow"
                },
                {
                    "pattern": "Write",
                    "permission": "Deny"
                }
            ]
        });

        let config_map: HashMap<String, serde_json::Value> =
            serde_json::from_value(config).unwrap();
        let checker = DefaultPermissionChecker::from_config(&config_map).unwrap();

        let git_input = ToolInput::new(json!({"command": "git status"})).unwrap();
        assert_eq!(
            checker.check_permission("Bash", &git_input),
            ToolPermission::Allow
        );

        let write_input = ToolInput::new(json!({"file_path": "/test.txt"})).unwrap();
        assert_eq!(
            checker.check_permission("Write", &write_input),
            ToolPermission::Deny
        );

        let read_input = ToolInput::new(json!({"file_path": "/test.txt"})).unwrap();
        assert_eq!(
            checker.check_permission("Read", &read_input),
            ToolPermission::Prompt
        );
    }

    #[test]
    fn test_permission_rule_with_description() {
        let rule = PermissionRule::new("Bash:git *", ToolPermission::Allow)
            .with_description("Allow all git commands");

        assert_eq!(rule.description, Some("Allow all git commands".to_string()));
    }
}
