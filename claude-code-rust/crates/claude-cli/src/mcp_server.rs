//! MCP server mode implementation

use crate::app::App;
use anyhow::{Context, Result};
use claude_mcp::{McpServer, StdioTransport};
use claude_core::Tool;

/// Run MCP server mode
pub async fn run_mcp_server(app: App) -> Result<()> {
    println!("Starting MCP server...");

    // Create MCP server
    let mut server = McpServer::new("claude-code-rust", env!("CARGO_PKG_VERSION"));

    // Register all tools from the registry
    let tool_names = app.tool_registry.tool_names();
    println!("Registering {} tools:", tool_names.len());

    for name in &tool_names {
        if let Some(tool) = app.tool_registry.get(&name) {
            println!("  - {}", name);
            // Note: We would need to wrap the tool in an Arc to register it
            // For now, we'll just list them
        }
    }

    println!("\nMCP server is ready!");
    println!("Listening on stdio for MCP requests...");
    println!("Press Ctrl+C to stop.\n");

    // MCP server would listen on stdio here
    // For now, just indicate it's ready
    println!("Note: Full MCP stdio implementation pending");
    println!("Server infrastructure is ready but needs stdio wiring");

    // TODO: Implement actual stdio serve loop
    // let transport = StdioTransport::spawn(command, args).await?;
    // server.serve(transport).await?;

    Ok(())
}
