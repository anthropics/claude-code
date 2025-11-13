//! CLI argument parsing

use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "claude-cli")]
#[command(about = "Claude Code - Rust implementation", long_about = None)]
pub struct Cli {
    /// Model to use (default: claude-sonnet-4-5-20250929)
    #[arg(long)]
    pub model: Option<String>,

    /// API key (can also use ANTHROPIC_API_KEY env var)
    #[arg(long)]
    pub api_key: Option<String>,

    /// Config directory (default: ~/.claude)
    #[arg(long)]
    pub config_dir: Option<String>,

    /// Working directory
    #[arg(long)]
    pub working_dir: Option<String>,

    /// Enable debug logging
    #[arg(long)]
    pub debug: bool,

    /// Verbose output
    #[arg(long, short)]
    pub verbose: bool,

    /// Subcommands
    #[command(subcommand)]
    pub command: Option<Commands>,
}

#[derive(Subcommand)]
pub enum Commands {
    /// Show version information
    Version,

    /// MCP server operations
    Mcp {
        #[command(subcommand)]
        command: McpCommands,
    },
}

#[derive(Subcommand)]
pub enum McpCommands {
    /// Start MCP server
    Serve,
}
