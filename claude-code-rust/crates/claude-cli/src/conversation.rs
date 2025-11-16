//! Conversation management for interactive sessions

use claude_api::{ContentBlock, Message};
use claude_core::ToolResult;
use serde_json::Value;

/// Manages conversation history
pub struct ConversationManager {
    messages: Vec<Message>,
    system_prompt: Option<String>,
}

impl ConversationManager {
    /// Create a new conversation manager
    pub fn new() -> Self {
        Self {
            messages: Vec::new(),
            system_prompt: Some(DEFAULT_SYSTEM_PROMPT.to_string()),
        }
    }

    /// Set system prompt
    pub fn set_system_prompt(&mut self, prompt: String) {
        self.system_prompt = Some(prompt);
    }

    /// Get system prompt
    pub fn system_prompt(&self) -> Option<&str> {
        self.system_prompt.as_deref()
    }

    /// Add a user message
    pub fn add_user_message(&mut self, content: impl Into<String>) {
        self.messages.push(Message::user(content));
    }

    /// Add an assistant message
    pub fn add_assistant_message(&mut self, content: impl Into<String>) {
        self.messages.push(Message::assistant(content));
    }

    /// Add a tool result
    pub fn add_tool_result(&mut self, tool_use_id: String, result: &ToolResult) {
        let content = if result.success {
            result
                .output
                .clone()
                .unwrap_or(Value::String("Success".to_string()))
        } else {
            Value::String(
                result
                    .error
                    .clone()
                    .unwrap_or_else(|| "Unknown error".to_string()),
            )
        };

        // Create a tool result message
        let mut message = Message::user("");
        message.content = vec![ContentBlock::ToolResult {
            tool_use_id,
            content: content.to_string(),
            is_error: Some(!result.success),
        }];
        self.messages.push(message);
    }

    /// Get all messages
    pub fn messages(&self) -> &[Message] {
        &self.messages
    }

    /// Clear conversation history
    pub fn clear(&mut self) {
        self.messages.clear();
    }
}

impl Default for ConversationManager {
    fn default() -> Self {
        Self::new()
    }
}

const DEFAULT_SYSTEM_PROMPT: &str = r#"You are Claude Code, an AI-powered coding assistant. You help users with:
- Writing and editing code
- Running shell commands
- Searching and analyzing codebases
- Implementing features and fixing bugs

You have access to various tools for file operations, shell execution, and code analysis.
Be helpful, concise, and focus on solving the user's coding tasks efficiently."#;
