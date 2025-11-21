//! Basic usage example for the claude-tools framework
//!
//! This example demonstrates:
//! - Creating a custom tool
//! - Registering tools with the executor
//! - Setting up permissions
//! - Executing tools

use async_trait::async_trait;
use claude_core::{Result, Tool, ToolInput, ToolResult};
use claude_tools::{
    DefaultPermissionChecker, EchoTool, PermissionRule, ToolExecutorBuilder, ToolPermission,
};
use serde_json::json;
use std::sync::Arc;

// Example custom tool: Calculator
struct CalculatorTool;

#[async_trait]
impl Tool for CalculatorTool {
    fn name(&self) -> &str {
        "Calculator"
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
                    "enum": ["add", "subtract", "multiply", "divide"],
                    "description": "The operation to perform"
                },
                "a": {
                    "type": "number",
                    "description": "First operand"
                },
                "b": {
                    "type": "number",
                    "description": "Second operand"
                }
            },
            "required": ["operation", "a", "b"]
        })
    }

    async fn execute(&self, input: ToolInput) -> Result<ToolResult> {
        let operation = input
            .get("operation")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let a = input.get("a").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let b = input.get("b").and_then(|v| v.as_f64()).unwrap_or(0.0);

        let result = match operation {
            "add" => a + b,
            "subtract" => a - b,
            "multiply" => a * b,
            "divide" => {
                if b == 0.0 {
                    return Ok(ToolResult::error("Division by zero"));
                }
                a / b
            }
            _ => return Ok(ToolResult::error("Invalid operation")),
        };

        Ok(ToolResult::success(json!({
            "operation": operation,
            "a": a,
            "b": b,
            "result": result
        })))
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    println!("=== Claude Tools Framework Demo ===\n");

    // Create a permission checker with custom rules
    let mut permission_checker = DefaultPermissionChecker::prompt_all();

    // Allow Echo tool without prompting
    permission_checker.add_rule(PermissionRule::new("Echo", ToolPermission::Allow));

    // Allow Calculator for basic operations
    permission_checker.add_rule(PermissionRule::new("Calculator", ToolPermission::Allow));

    // Create the executor with multiple tools
    let executor = ToolExecutorBuilder::new()
        .register_tool(EchoTool::new())
        .register_tool(CalculatorTool)
        .with_permission_checker(Arc::new(permission_checker))
        .build();

    // List registered tools
    println!("Registered tools:");
    for tool in executor.list_tools().await {
        println!("  - {}", tool);
    }
    println!();

    // Get tool descriptions
    println!("Tool descriptions:");
    for desc in executor.get_tool_descriptions().await {
        println!("  {}: {}", desc.name, desc.description);
    }
    println!();

    // Example 1: Echo tool
    println!("Example 1: Echo tool");
    let echo_input = ToolInput::new(json!({
        "message": "Hello from the tool framework!",
        "repeat": 3
    }))?;

    match executor.execute("Echo", echo_input).await {
        Ok(result) => {
            if result.success {
                println!("✓ Success: {}", result.output.unwrap()["echoed"]);
            } else {
                println!("✗ Failed: {}", result.error.unwrap());
            }
        }
        Err(e) => println!("✗ Error: {}", e),
    }
    println!();

    // Example 2: Calculator tool - Addition
    println!("Example 2: Calculator (add)");
    let calc_input = ToolInput::new(json!({
        "operation": "add",
        "a": 42,
        "b": 8
    }))?;

    match executor.execute("Calculator", calc_input).await {
        Ok(result) => {
            if result.success {
                let output = result.output.unwrap();
                println!(
                    "✓ {} {} {} = {}",
                    output["a"], output["operation"], output["b"], output["result"]
                );
            } else {
                println!("✗ Failed: {}", result.error.unwrap());
            }
        }
        Err(e) => println!("✗ Error: {}", e),
    }
    println!();

    // Example 3: Calculator tool - Division
    println!("Example 3: Calculator (divide)");
    let calc_input = ToolInput::new(json!({
        "operation": "divide",
        "a": 100,
        "b": 4
    }))?;

    match executor.execute("Calculator", calc_input).await {
        Ok(result) => {
            if result.success {
                let output = result.output.unwrap();
                println!(
                    "✓ {} {} {} = {}",
                    output["a"], output["operation"], output["b"], output["result"]
                );
            } else {
                println!("✗ Failed: {}", result.error.unwrap());
            }
        }
        Err(e) => println!("✗ Error: {}", e),
    }
    println!();

    // Example 4: Error handling - Division by zero
    println!("Example 4: Error handling (divide by zero)");
    let calc_input = ToolInput::new(json!({
        "operation": "divide",
        "a": 10,
        "b": 0
    }))?;

    match executor.execute("Calculator", calc_input).await {
        Ok(result) => {
            if result.success {
                println!("✓ Success: {:?}", result.output);
            } else {
                println!("✓ Correctly handled error: {}", result.error.unwrap());
            }
        }
        Err(e) => println!("✗ Error: {}", e),
    }
    println!();

    // Example 5: Tool not found
    println!("Example 5: Tool not found");
    let input = ToolInput::new(json!({}))?;
    match executor.execute("NonExistent", input).await {
        Ok(_) => println!("✗ Should have failed"),
        Err(e) => println!("✓ Correctly caught error: {}", e),
    }

    println!("\n=== Demo Complete ===");
    Ok(())
}
