//! Claude Code - Rust CLI
#![forbid(unsafe_code)]

mod app;
mod cli;
mod conversation;
mod mcp_server;
mod repl;

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
            Ok(())
        }
        Some(cli::Commands::Mcp { command }) => {
            match command {
                cli::McpCommands::Serve => {
                    // MCP server doesn't need API key (just serves tools)
                    let api_key = cli.api_key
                        .or_else(|| std::env::var("ANTHROPIC_API_KEY").ok())
                        .unwrap_or_else(|| "dummy-key-for-mcp".to_string());

                    // Create app
                    let app = app::App::new(api_key, cli.model).await?;

                    // Run MCP server
                    mcp_server::run_mcp_server(app).await
                }
            }
        }
        None => {
            // Interactive mode

            // Get API key
            let api_key = cli.api_key
                .or_else(|| std::env::var("ANTHROPIC_API_KEY").ok());

            if api_key.is_none() {
                println!("Error: API key required for interactive mode");
                println!("Set ANTHROPIC_API_KEY environment variable or use --api-key option");
                std::process::exit(1);
            }

            // Create app
            let mut app = app::App::new(api_key.unwrap(), cli.model).await?;
            app.initialize().await?;

            // Create and run REPL
            let mut repl = repl::Repl::new(app, 100);
            let result = repl.run().await;

            // Shutdown
            if let Err(ref e) = result {
                eprintln!("Error: {}", e);
            }

            result
        }
    }
}
