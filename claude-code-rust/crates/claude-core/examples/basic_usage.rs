//! Basic usage examples for claude-core
//!
//! Run with: cargo run --example basic_usage

use claude_core::{
    async_trait::async_trait, ClaudeError, ContentBlock, Message, ModelConfig, Result, Role,
    SessionId, Tool, ToolInput, ToolRegistry, ToolResult,
};
use serde_json::json;

// Example tool implementation
struct GreeterTool;

#[async_trait]
impl Tool for GreeterTool {
    fn name(&self) -> &str {
        "greeter"
    }

    fn description(&self) -> &str {
        "A simple greeting tool that says hello"
    }

    fn input_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "The name to greet"
                }
            },
            "required": ["name"]
        })
    }

    async fn execute(&self, input: ToolInput) -> Result<ToolResult> {
        let name = input
            .get("name")
            .and_then(|v| v.as_str())
            .ok_or_else(|| ClaudeError::tool("Missing 'name' parameter"))?;

        Ok(ToolResult::success(json!({
            "greeting": format!("Hello, {}!", name)
        })))
    }
}

// Another example tool
struct CalculatorTool;

#[async_trait]
impl Tool for CalculatorTool {
    fn name(&self) -> &str {
        "calculator"
    }

    fn description(&self) -> &str {
        "Performs basic arithmetic operations"
    }

    fn input_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "operation": {
                    "type": "string",
                    "enum": ["add", "subtract", "multiply", "divide"]
                },
                "a": {
                    "type": "number"
                },
                "b": {
                    "type": "number"
                }
            },
            "required": ["operation", "a", "b"]
        })
    }

    async fn execute(&self, input: ToolInput) -> Result<ToolResult> {
        let op = input
            .get("operation")
            .and_then(|v| v.as_str())
            .ok_or_else(|| ClaudeError::tool("Missing 'operation' parameter"))?;

        let a = input
            .get("a")
            .and_then(|v| v.as_f64())
            .ok_or_else(|| ClaudeError::tool("Missing or invalid 'a' parameter"))?;

        let b = input
            .get("b")
            .and_then(|v| v.as_f64())
            .ok_or_else(|| ClaudeError::tool("Missing or invalid 'b' parameter"))?;

        let result = match op {
            "add" => a + b,
            "subtract" => a - b,
            "multiply" => a * b,
            "divide" => {
                if b == 0.0 {
                    return Ok(ToolResult::error("Division by zero"));
                }
                a / b
            }
            _ => return Err(ClaudeError::tool(format!("Unknown operation: {}", op))),
        };

        Ok(ToolResult::success(json!({ "result": result })))
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    println!("=== Claude Core Examples ===\n");

    // 1. Session Management
    println!("1. Session Management:");
    let session_id = SessionId::generate();
    println!("   Generated session ID: {}", session_id);

    let custom_session = SessionId::new("my-session-123");
    println!("   Custom session ID: {}\n", custom_session);

    // 2. Message Creation
    println!("2. Message Creation:");
    let user_msg = Message::user("Hello, Claude!");
    println!("   User message: {:?}", user_msg.role);

    let assistant_msg = Message::assistant("Hi! How can I help you?");
    println!("   Assistant message: {:?}", assistant_msg.role);

    let multi_content_msg = Message::new(
        Role::User,
        vec![
            ContentBlock::text("Please analyze this:"),
            ContentBlock::tool_use("tool-1", "analyze", json!({"type": "text"})),
        ],
    );
    println!(
        "   Multi-content message with {} blocks\n",
        multi_content_msg.content.len()
    );

    // 3. Model Configuration
    println!("3. Model Configuration:");
    let config = ModelConfig::new("claude-3-5-sonnet-20241022")
        .with_max_tokens(4096)
        .with_temperature(0.7)
        .with_system("You are a helpful assistant");
    println!("   Model: {}", config.model);
    println!("   Max tokens: {:?}", config.max_tokens);
    println!("   Temperature: {:?}\n", config.temperature);

    // 4. Tool Registry
    println!("4. Tool Registry:");
    let mut registry = ToolRegistry::new();

    registry.register(GreeterTool);
    registry.register(CalculatorTool);

    println!("   Registered tools: {:?}", registry.tool_names());

    // 5. Tool Execution
    println!("\n5. Tool Execution:");

    // Execute greeter tool
    let greeter_input = ToolInput::new(json!({"name": "Alice"})).unwrap();
    let result = registry.execute("greeter", greeter_input).await?;
    println!("   Greeter result: {:?}", result.output);

    // Execute calculator tool
    let calc_input = ToolInput::new(json!({
        "operation": "multiply",
        "a": 6,
        "b": 7
    }))
    .unwrap();
    let result = registry.execute("calculator", calc_input).await?;
    println!("   Calculator result: {:?}", result.output);

    // 6. Tool Descriptions
    println!("\n6. Tool Descriptions:");
    let descriptions = registry.tool_descriptions();
    for desc in descriptions {
        println!("   Tool: {}", desc.name);
        println!("   Description: {}", desc.description);
        println!("   Schema: {}\n", desc.input_schema);
    }

    // 7. Error Handling
    println!("7. Error Handling:");
    let result: Result<()> = Err(ClaudeError::api("Connection timeout"));
    match result {
        Ok(_) => println!("   Success"),
        Err(e) => println!("   Error: {}", e),
    }

    let result: Result<()> = Err(ClaudeError::tool("Tool not found"));
    match result {
        Ok(_) => println!("   Success"),
        Err(e) => println!("   Error: {}", e),
    }

    // 8. Serialization
    println!("\n8. Serialization:");
    let msg = Message::user("Test message");
    let json = serde_json::to_string_pretty(&msg)?;
    println!("   Serialized message:\n{}", json);

    println!("\n=== Examples Complete ===");
    Ok(())
}
