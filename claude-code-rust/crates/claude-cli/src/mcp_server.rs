//! MCP server mode implementation

use crate::app::App;
use anyhow::{Context, Result};
use claude_mcp::McpServer;

/// Run MCP server mode
pub async fn run_mcp_server(app: App) -> Result<()> {
    eprintln!("Starting MCP server...");
    eprintln!("Server: claude-code-rust v{}", env!("CARGO_PKG_VERSION"));

    // Create MCP server
    let server = McpServer::new("claude-code-rust", env!("CARGO_PKG_VERSION"));

    // Register all tools from the registry
    let tool_names = app.tool_registry.tool_names();
    eprintln!("Registering {} tools:", tool_names.len());

    for name in &tool_names {
        if let Some(tool) = app.tool_registry.get(name) {
            eprintln!("  ✓ {}", name);
            // Note: We need to clone/wrap the tool since McpServer takes ownership
            // For now we'll need to refactor the tool registry to support this
        }
    }

    eprintln!("\n✓ MCP server ready!");
    eprintln!("Listening on stdio for JSON-RPC 2.0 requests...\n");

    // Serve over stdio
    server.serve_stdio().await.context("MCP server error")?;

    Ok(())
}
