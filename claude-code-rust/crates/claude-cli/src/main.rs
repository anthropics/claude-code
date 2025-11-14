//! Claude Code - Rust CLI
#![forbid(unsafe_code)]

mod app;
mod cli;
mod conversation;
mod mcp_server;
mod repl;

use anyhow::{Context, Result};
use clap::Parser;

#[tokio::main]
async fn main() -> Result<()> {
    // Parse CLI arguments
    let cli = cli::Cli::parse();

    // Initialize tracing
    let log_level = if cli.debug {
        tracing::Level::TRACE
    } else if cli.verbose {
        tracing::Level::DEBUG
    } else {
        tracing::Level::WARN
    };

    tracing_subscriber::fmt()
        .with_max_level(log_level)
        .init();

    // Handle working directory
    if let Some(working_dir) = &cli.working_dir {
        std::env::set_current_dir(working_dir)
            .context("Failed to set working directory")?;
    }

    // Get API key from CLI or environment
    let api_key = cli.api_key
        .or_else(|| std::env::var("ANTHROPIC_API_KEY").ok())
        .or_else(|| std::env::var("CLAUDE_API_KEY").ok());

    // Handle print mode (one-shot execution)
    if let Some(prompt) = cli.print {
        let api_key = api_key.context("API key required for print mode")?;
        let app = app::App::new(api_key, cli.model).await?;
        return run_print_mode(app, &prompt).await;
    }

    // Handle commands
    match cli.command {
        Some(cli::Commands::Mcp { command }) => {
            match command {
                cli::McpCommands::Serve => {
                    let api_key = api_key.unwrap_or_else(|| "dummy-key-for-mcp".to_string());
                    let app = app::App::new(api_key, cli.model).await?;
                    mcp_server::run_mcp_server(app).await
                }
            }
        }
        Some(cli::Commands::Doctor) => {
            run_doctor();
            Ok(())
        }
        None => {
            // Interactive mode
            let api_key = api_key.context(
                "API key required. Set ANTHROPIC_API_KEY environment variable or use --api-key",
            )?;

            let app = app::App::new(api_key, cli.model).await?;
            let mut repl = repl::Repl::new(app, 100);
            repl.run().await
        }
    }
}

/// Run print mode - one-shot prompt execution
async fn run_print_mode(_app: app::App, prompt: &str) -> Result<()> {
    // For now, just print the prompt since full implementation requires more API work
    println!("Print mode requested: {}", prompt);
    println!("\nNote: Full print mode implementation pending");
    Ok(())
}

/// Run diagnostics
fn run_doctor() {
    println!("Claude Code Diagnostics");
    println!("=======================\n");

    // Version
    println!("Version: {}", env!("CARGO_PKG_VERSION"));

    // Environment
    println!("\nEnvironment:");
    println!("  OS: {}", std::env::consts::OS);
    println!("  Arch: {}", std::env::consts::ARCH);
    println!("  Family: {}", std::env::consts::FAMILY);

    // Working directory
    if let Ok(cwd) = std::env::current_dir() {
        println!("  Working Dir: {}", cwd.display());
    }

    // API Key
    println!("\nConfiguration:");
    if std::env::var("ANTHROPIC_API_KEY").is_ok() {
        println!("  ✓ ANTHROPIC_API_KEY is set");
    } else if std::env::var("CLAUDE_API_KEY").is_ok() {
        println!("  ✓ CLAUDE_API_KEY is set");
    } else {
        println!("  ✗ No API key found in environment");
    }

    // Config directory
    if let Some(config_dir) = std::env::var_os("CLAUDE_CONFIG_DIR") {
        println!("  Config Dir: {:?}", config_dir);
    } else if let Some(home) = std::env::var_os("HOME") {
        println!("  Config Dir (default): {}/.claude", home.to_string_lossy());
    }

    println!("\n✓ Diagnostics complete!");
}
