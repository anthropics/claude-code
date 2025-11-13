//! Hook protocol definitions for input/output formats.
//!
//! This module defines the JSON protocol for communicating with hook processes.
//! Hooks receive input via stdin and send output via stdout.

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Input sent to a hook process via stdin (JSON format).
///
/// # Example
/// ```json
/// {
///   "session_id": "abc-123",
///   "tool_name": "Write",
///   "tool_input": {
///     "file_path": "/path/to/file",
///     "content": "..."
///   }
/// }
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookInput {
    /// Unique session identifier
    pub session_id: String,

    /// Name of the tool being executed (e.g., "Write", "Read", "Bash")
    pub tool_name: String,

    /// Tool-specific input parameters
    pub tool_input: Value,
}

/// Output received from a hook process via stdout (JSON format).
///
/// # Example
/// ```json
/// {
///   "hookSpecificOutput": {
///     "hookEventName": "SessionStart",
///     "additionalContext": "Development environment initialized..."
///   }
/// }
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookOutput {
    /// Hook-specific output data
    #[serde(rename = "hookSpecificOutput")]
    pub hook_specific_output: HookSpecificOutput,
}

/// Hook-specific output data.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookSpecificOutput {
    /// Name of the hook event that generated this output
    #[serde(rename = "hookEventName")]
    pub hook_event_name: String,

    /// Additional context to add to the conversation
    #[serde(rename = "additionalContext", skip_serializing_if = "Option::is_none")]
    pub additional_context: Option<String>,

    /// Optional message for deny/block results
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

/// Result of a hook execution.
///
/// Determines what action should be taken based on the hook's exit code and output.
#[derive(Debug, Clone)]
pub enum HookResult {
    /// Hook allows the action to proceed (exit code 0).
    /// May include additional context to add to the conversation.
    Allow(Option<String>),

    /// Hook denies the action and shows message to user only (exit code 1).
    /// Does not block execution, just logs a warning.
    Warn(String),

    /// Hook denies the action and shows message to Claude (exit code 2).
    /// Blocks tool execution and provides explanation to the model.
    Deny(String),
}

impl HookResult {
    /// Creates a HookResult from an exit code and optional output.
    pub fn from_exit_code(code: i32, output: Option<HookOutput>) -> Self {
        match code {
            0 => {
                let context = output
                    .and_then(|o| o.hook_specific_output.additional_context);
                HookResult::Allow(context)
            }
            1 => {
                let message = output
                    .and_then(|o| o.hook_specific_output.message)
                    .unwrap_or_else(|| "Hook returned warning status".to_string());
                HookResult::Warn(message)
            }
            2 => {
                let message = output
                    .and_then(|o| o.hook_specific_output.message)
                    .unwrap_or_else(|| "Hook denied the operation".to_string());
                HookResult::Deny(message)
            }
            _ => HookResult::Warn(format!("Hook returned unexpected exit code: {}", code)),
        }
    }

    /// Returns true if this result allows the action to proceed.
    pub fn is_allowed(&self) -> bool {
        matches!(self, HookResult::Allow(_) | HookResult::Warn(_))
    }

    /// Returns true if this result blocks the action.
    pub fn is_blocked(&self) -> bool {
        matches!(self, HookResult::Deny(_))
    }

    /// Returns the additional context, if any.
    pub fn context(&self) -> Option<&str> {
        match self {
            HookResult::Allow(Some(ctx)) => Some(ctx.as_str()),
            _ => None,
        }
    }

    /// Returns the message, if any.
    pub fn message(&self) -> Option<&str> {
        match self {
            HookResult::Warn(msg) | HookResult::Deny(msg) => Some(msg.as_str()),
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hook_input_serialization() {
        let input = HookInput {
            session_id: "test-123".to_string(),
            tool_name: "Write".to_string(),
            tool_input: serde_json::json!({
                "file_path": "/test/file.txt",
                "content": "test content"
            }),
        };

        let json = serde_json::to_string(&input).unwrap();
        assert!(json.contains("test-123"));
        assert!(json.contains("Write"));
    }

    #[test]
    fn test_hook_output_deserialization() {
        let json = r#"{
            "hookSpecificOutput": {
                "hookEventName": "SessionStart",
                "additionalContext": "Test context"
            }
        }"#;

        let output: HookOutput = serde_json::from_str(json).unwrap();
        assert_eq!(output.hook_specific_output.hook_event_name, "SessionStart");
        assert_eq!(
            output.hook_specific_output.additional_context,
            Some("Test context".to_string())
        );
    }

    #[test]
    fn test_hook_result_from_exit_code() {
        // Exit code 0 - Allow
        let result = HookResult::from_exit_code(0, None);
        assert!(result.is_allowed());
        assert!(!result.is_blocked());

        // Exit code 1 - Warn
        let result = HookResult::from_exit_code(1, None);
        assert!(result.is_allowed());
        assert!(!result.is_blocked());

        // Exit code 2 - Deny
        let result = HookResult::from_exit_code(2, None);
        assert!(!result.is_allowed());
        assert!(result.is_blocked());
    }
}
