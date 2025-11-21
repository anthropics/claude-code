//! Demonstration of built-in tools
//!
//! This example shows how to use all the built-in tools provided by claude-tools.
//!
//! Run with: cargo run --example built_in_tools_demo

use claude_core::ToolInput;
use claude_tools::{register_built_in_tools, ToolExecutorBuilder, ToolRegistry};
use serde_json::json;
use std::fs;
use tempfile::TempDir;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("=== Built-in Tools Demonstration ===\n");

    // Create a temporary directory for testing
    let temp_dir = TempDir::new()?;
    let temp_path = temp_dir.path();

    // Create some test files
    fs::write(
        temp_path.join("hello.txt"),
        "Hello, World!\nWelcome to Claude Code",
    )?;
    fs::write(
        temp_path.join("test.rs"),
        "fn main() { println!(\"test\"); }",
    )?;
    fs::write(
        temp_path.join("data.json"),
        r#"{"name": "example", "value": 42}"#,
    )?;

    // Set up the tool executor with all built-in tools
    let mut registry = ToolRegistry::new();
    register_built_in_tools(&mut registry);

    let executor = ToolExecutorBuilder::new()
        .with_registry(registry)
        .build_with_allow_all();

    println!("Registered tools: {:?}\n", executor.list_tools().await);

    // 1. Bash Tool - Execute shell commands
    println!("--- Bash Tool ---");
    let bash_result = executor
        .execute(
            "Bash",
            ToolInput::new(json!({
                "command": "echo 'Running from Bash tool'"
            }))?,
        )
        .await?;
    println!("Bash result: {:?}\n", bash_result.output);

    // 2. Ls Tool - List directory contents
    println!("--- Ls Tool ---");
    let ls_result = executor
        .execute(
            "Ls",
            ToolInput::new(json!({
                "path": temp_path.to_str().unwrap(),
                "long": true
            }))?,
        )
        .await?;
    println!("Directory listing: {:?}\n", ls_result.output);

    // 3. Read Tool - Read file contents
    println!("--- Read Tool ---");
    let read_result = executor
        .execute(
            "Read",
            ToolInput::new(json!({
                "file_path": temp_path.join("hello.txt").to_str().unwrap()
            }))?,
        )
        .await?;
    println!("File contents: {:?}\n", read_result.output);

    // 4. Write Tool - Write to a file
    println!("--- Write Tool ---");
    let write_result = executor
        .execute(
            "Write",
            ToolInput::new(json!({
                "file_path": temp_path.join("new_file.txt").to_str().unwrap(),
                "content": "This is a new file created by Write tool"
            }))?,
        )
        .await?;
    println!("Write result: {:?}\n", write_result.output);

    // 5. Edit Tool - Edit a file
    println!("--- Edit Tool ---");
    let edit_result = executor
        .execute(
            "Edit",
            ToolInput::new(json!({
                "file_path": temp_path.join("hello.txt").to_str().unwrap(),
                "old_string": "World",
                "new_string": "Rust"
            }))?,
        )
        .await?;
    println!("Edit result: {:?}\n", edit_result.output);

    // 6. Glob Tool - Find files by pattern
    println!("--- Glob Tool ---");
    let glob_result = executor
        .execute(
            "Glob",
            ToolInput::new(json!({
                "pattern": "*.txt",
                "path": temp_path.to_str().unwrap()
            }))?,
        )
        .await?;
    println!("Glob results: {:?}\n", glob_result.output);

    // 7. Grep Tool - Search file contents
    println!("--- Grep Tool ---");
    let grep_result = executor
        .execute(
            "Grep",
            ToolInput::new(json!({
                "pattern": "Hello",
                "path": temp_path.to_str().unwrap(),
                "output_mode": "content"
            }))?,
        )
        .await?;
    println!("Grep results: {:?}\n", grep_result.output);

    println!("=== All tools demonstrated successfully! ===");

    Ok(())
}
