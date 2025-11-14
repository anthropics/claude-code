//! CLI argument parsing

use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "claude-cli")]
#[command(about = "Claude Code - Rust implementation", long_about = None)]
#[command(version)]
#[command(author = "Anthropic")]
pub struct Cli {
    /// Model to use (default: claude-sonnet-4-5-20250929)
    #[arg(long, env = "CLAUDE_MODEL")]
    pub model: Option<String>,

    /// API key (can also use ANTHROPIC_API_KEY env var)
    #[arg(long, env = "ANTHROPIC_API_KEY")]
    pub api_key: Option<String>,

    /// Config directory (default: ~/.claude)
    #[arg(long, env = "CLAUDE_CONFIG_DIR")]
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

    /// Print mode: execute prompt and exit
    #[arg(long, short)]
    pub print: Option<String>,

    /// System prompt override
    #[arg(long)]
    pub system_prompt: Option<String>,

    /// System prompt file
    #[arg(long)]
    pub system_prompt_file: Option<String>,

    /// Subcommands
    #[command(subcommand)]
    pub command: Option<Commands>,
}

#[derive(Subcommand)]
pub enum Commands {
    /// MCP server operations
    Mcp {
        #[command(subcommand)]
        command: McpCommands,
    },

    /// Run diagnostics
    Doctor,
}

#[derive(Subcommand)]
pub enum McpCommands {
    /// Start MCP server
    Serve,
}
