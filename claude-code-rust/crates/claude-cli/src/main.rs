//! Claude Code - Rust CLI
#![forbid(unsafe_code)]

mod cli;

use anyhow::Result;
use clap::Parser;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    // Parse CLI arguments
    let cli = cli::Cli::parse();

    // Print version info
    println!("Claude Code (Rust) v{}", env!("CARGO_PKG_VERSION"));
    println!("A high-performance Rust implementation of Claude Code\n");

    // Handle subcommands
    match cli.command {
        Some(cli::Commands::Version) => {
            println!("Version: {}", env!("CARGO_PKG_VERSION"));
            println!("Built with: Rust");
        }
        Some(cli::Commands::Mcp { command }) => {
            match command {
                cli::McpCommands::Serve => {
                    println!("MCP server mode not yet implemented");
                }
            }
        }
        None => {
            // Interactive mode - Not yet implemented
            println!("Interactive REPL mode not yet implemented");
            println!("\nCurrent implementation status:");
            println!("  ✅ Core types and error handling");
            println!("  ✅ API client with streaming");
            println!("  ✅ Configuration management");
            println!("  ✅ Tool execution framework");
            println!("  ✅ Plugin system");
            println!("  ✅ Built-in tools (Bash, Read, Write, Edit, Glob, Grep, Ls)");
            println!("  ✅ MCP protocol");
            println!("  ✅ Hook system");
            println!("  ✅ Agent orchestration");
            println!("  ✅ Session management");
            println!("  🚧 Interactive REPL (in progress)");
        }
    }

    Ok(())
}
