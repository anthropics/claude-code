//! Example Echo tool implementation
//!
//! This module provides a simple Echo tool that demonstrates
//! how to implement the Tool trait. It's useful for testing
//! the tool execution framework.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::json;

use claude_core::{Result, Tool, ToolInput, ToolResult};

/// Parameters for the Echo tool
#[derive(Debug, Serialize, Deserialize)]
pub struct EchoParams {
    /// The message to echo back
    pub message: String,

    /// Optional number of times to repeat the message
    #[serde(default = "default_repeat")]
    pub repeat: usize,

    /// Optional prefix to add to each line
    #[serde(default)]
    pub prefix: Option<String>,
}

fn default_repeat() -> usize {
    1
}

/// A simple tool that echoes back the input message
///
/// This tool is useful for:
/// - Testing the tool execution framework
/// - Demonstrating how to implement the Tool trait
/// - Validating permission checking
/// - Example for documentation
pub struct EchoTool {
    name: String,
}

impl EchoTool {
    /// Create a new Echo tool with the default name "Echo"
    pub fn new() -> Self {
        Self {
            name: "Echo".to_string(),
        }
    }

    /// Create a new Echo tool with a custom name
    pub fn with_name(name: impl Into<String>) -> Self {
        Self { name: name.into() }
    }
}

impl Default for EchoTool {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Tool for EchoTool {
    fn name(&self) -> &str {
        &self.name
    }

    fn description(&self) -> &str {
        "Echoes back the input message, optionally repeating it multiple times"
    }

    fn input_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "message": {
                    "type": "string",
                    "description": "The message to echo back"
                },
                "repeat": {
                    "type": "integer",
                    "description": "Number of times to repeat the message",
                    "default": 1,
                    "minimum": 1,
                    "maximum": 100
                },
                "prefix": {
                    "type": "string",
                    "description": "Optional prefix to add to each line"
                }
            },
            "required": ["message"]
        })
    }

    async fn execute(&self, input: ToolInput) -> Result<ToolResult> {
        // Parse parameters
        let params: EchoParams = match input.as_params() {
            Ok(p) => p,
            Err(e) => {
                return Ok(ToolResult::error(format!(
                    "Invalid input parameters: {}",
                    e
                )));
            }
        };

        // Validate repeat count
        if params.repeat == 0 || params.repeat > 100 {
            return Ok(ToolResult::error(
                "repeat must be between 1 and 100",
            ));
        }

        // Build the output
        let mut lines = Vec::new();
        for i in 0..params.repeat {
            let line = if let Some(ref prefix) = params.prefix {
                format!("{}{}", prefix, params.message)
            } else {
                params.message.clone()
            };
            lines.push(line);

            // Add line number if repeating
            if params.repeat > 1 {
                lines[i] = format!("{}. {}", i + 1, lines[i]);
            }
        }

        let output = lines.join("\n");

        Ok(ToolResult::success(json!({
            "echoed": output,
            "original_message": params.message,
            "repeat_count": params.repeat,
        }))
        .with_metadata("lines", lines.len()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_echo_simple() {
        let tool = EchoTool::new();
        let input = ToolInput::new(json!({
            "message": "Hello, World!"
        }))
        .unwrap();

        let result = tool.execute(input).await.unwrap();
        assert!(result.success);

        let output = result.output.unwrap();
        assert_eq!(output["original_message"], "Hello, World!");
        assert_eq!(output["echoed"], "Hello, World!");
    }

    #[tokio::test]
    async fn test_echo_repeat() {
        let tool = EchoTool::new();
        let input = ToolInput::new(json!({
            "message": "Test",
            "repeat": 3
        }))
        .unwrap();

        let result = tool.execute(input).await.unwrap();
        assert!(result.success);

        let output = result.output.unwrap();
        assert_eq!(output["repeat_count"], 3);

        let echoed = output["echoed"].as_str().unwrap();
        assert!(echoed.contains("1. Test"));
        assert!(echoed.contains("2. Test"));
        assert!(echoed.contains("3. Test"));
    }

    #[tokio::test]
    async fn test_echo_with_prefix() {
        let tool = EchoTool::new();
        let input = ToolInput::new(json!({
            "message": "World",
            "prefix": "Hello, "
        }))
        .unwrap();

        let result = tool.execute(input).await.unwrap();
        assert!(result.success);

        let output = result.output.unwrap();
        let echoed = output["echoed"].as_str().unwrap();
        assert_eq!(echoed, "Hello, World");
    }

    #[tokio::test]
    async fn test_echo_invalid_repeat() {
        let tool = EchoTool::new();
        let input = ToolInput::new(json!({
            "message": "Test",
            "repeat": 0
        }))
        .unwrap();

        let result = tool.execute(input).await.unwrap();
        assert!(!result.success);
        assert!(result.error.unwrap().contains("between 1 and 100"));
    }

    #[tokio::test]
    async fn test_echo_invalid_params() {
        let tool = EchoTool::new();
        let input = ToolInput::new(json!({
            "wrong_field": "value"
        }))
        .unwrap();

        let result = tool.execute(input).await.unwrap();
        assert!(!result.success);
        assert!(result.error.unwrap().contains("Invalid input parameters"));
    }

    #[tokio::test]
    async fn test_echo_metadata() {
        let tool = EchoTool::new();
        let input = ToolInput::new(json!({
            "message": "Test",
            "repeat": 5
        }))
        .unwrap();

        let result = tool.execute(input).await.unwrap();
        assert!(result.success);
        assert_eq!(result.metadata.get("lines").unwrap(), 5);
    }

    #[test]
    fn test_echo_description() {
        let tool = EchoTool::new();
        assert_eq!(tool.name(), "Echo");
        assert!(!tool.description().is_empty());

        let schema = tool.input_schema();
        assert_eq!(schema["type"], "object");
        assert!(schema["properties"]["message"].is_object());
    }

    #[test]
    fn test_echo_custom_name() {
        let tool = EchoTool::with_name("CustomEcho");
        assert_eq!(tool.name(), "CustomEcho");
    }
}
