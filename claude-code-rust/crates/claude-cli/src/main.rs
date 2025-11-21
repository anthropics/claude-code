//! Claude Code - Rust CLI
#![forbid(unsafe_code)]

mod app;
mod auth;
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
    let log_level = if cli.debug.is_some() {
        tracing::Level::TRACE
    } else if cli.verbose {
        tracing::Level::DEBUG
    } else {
        tracing::Level::WARN
    };

    tracing_subscriber::fmt().with_max_level(log_level).init();

    // Handle working directory
    if let Some(working_dir) = &cli.working_dir {
        std::env::set_current_dir(working_dir).context("Failed to set working directory")?;
    }

    // Get API key from CLI or environment
    let api_key = cli
        .api_key
        .clone()
        .or_else(|| std::env::var("ANTHROPIC_API_KEY").ok())
        .or_else(|| std::env::var("CLAUDE_API_KEY").ok());

    // Handle print mode (one-shot execution)
    if cli.print {
        let prompt = cli
            .prompt
            .clone()
            .context("Prompt required for print mode")?;
        let api_key = match api_key {
            Some(key) => key,
            None => auth::get_or_authenticate().await?,
        };
        let model = cli.model.clone();
        let app = app::App::new(api_key, model).await?;
        return run_print_mode(app, &prompt, &cli).await;
    }

    // Handle commands
    match cli.command {
        Some(cli::Commands::Mcp { command }) => match command {
            cli::McpCommands::Serve => {
                let api_key = api_key.unwrap_or_else(|| "dummy-key-for-mcp".to_string());
                let app = app::App::new(api_key, cli.model).await?;
                mcp_server::run_mcp_server(app).await
            }
        },
        Some(cli::Commands::Plugin { command }) => {
            run_plugin_command(command);
            Ok(())
        }
        Some(cli::Commands::MigrateInstaller) => {
            run_migrate_installer();
            Ok(())
        }
        Some(cli::Commands::SetupToken) => run_setup_token().await,
        Some(cli::Commands::Doctor) => {
            run_doctor();
            Ok(())
        }
        Some(cli::Commands::AutoUpdater { command }) => {
            run_auto_updater(command);
            Ok(())
        }
        Some(cli::Commands::Install { target }) => {
            run_install(target);
            Ok(())
        }
        None => {
            // Interactive mode (or print mode with prompt argument)
            if let Some(prompt) = cli.prompt.clone() {
                // Non-interactive mode with prompt argument
                let api_key = match api_key {
                    Some(key) => key,
                    None => auth::get_or_authenticate().await?,
                };
                let model = cli.model.clone();
                let app = app::App::new(api_key, model).await?;
                return run_print_mode(app, &prompt, &cli).await;
            } else {
                // Interactive mode - get or authenticate for API key
                let api_key = match api_key {
                    Some(key) => key,
                    None => auth::get_or_authenticate().await?,
                };

                let app = app::App::new(api_key, cli.model).await?;
                let mut repl = repl::Repl::new(app, 100);
                repl.run().await
            }
        }
    }
}

/// Run print mode - one-shot prompt execution
async fn run_print_mode(_app: app::App, prompt: &str, _cli: &cli::Cli) -> Result<()> {
    // For now, just print the prompt since full implementation requires more API work
    println!("Print mode requested: {}", prompt);
    println!("\nNote: Full print mode implementation pending");
    println!(
        "Note: Output format, input format, and other options will be supported in future updates"
    );
    Ok(())
}

/// Run plugin command
fn run_plugin_command(command: cli::PluginCommands) {
    match command {
        cli::PluginCommands::List => {
            println!("Listing installed plugins...");
            println!("\nNote: Plugin management will be implemented in future updates");
        }
        cli::PluginCommands::Install { name } => {
            println!("Installing plugin: {}", name);
            println!("\nNote: Plugin management will be implemented in future updates");
        }
        cli::PluginCommands::Uninstall { name } => {
            println!("Uninstalling plugin: {}", name);
            println!("\nNote: Plugin management will be implemented in future updates");
        }
    }
}

/// Migrate from global npm installation to local installation
fn run_migrate_installer() {
    println!("Migrating installer...");
    println!("\nNote: This command is not applicable to the Rust implementation");
    println!("The Rust version is already a native build and doesn't require migration");
}

/// Set up a long-lived authentication token
async fn run_setup_token() -> Result<()> {
    println!("Setting up authentication token...");
    println!();

    // Run the authentication flow
    let _token = auth::authenticate().await?;

    println!();
    println!("✓ Token setup complete!");
    println!();
    println!("You can now use Claude Code without specifying an API key.");

    Ok(())
}

/// Check for updates and install if available
fn run_auto_updater(command: cli::AutoUpdaterCommands) {
    match command {
        cli::AutoUpdaterCommands::Update => {
            println!("Checking for updates...");
            println!("\nNote: Auto-updater will be implemented in future updates");
            println!("Current version: {}", env!("CARGO_PKG_VERSION"));
        }
    }
}

/// Install Claude Code native build
fn run_install(target: Option<String>) {
    let target_version = target.unwrap_or_else(|| "stable".to_string());
    println!("Installing Claude Code native build: {}", target_version);
    println!("\nNote: Install command will be implemented in future updates");
    println!("The current binary is already a native Rust build");
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
