//! CLI argument parsing

use clap::{Parser, Subcommand};

/// Claude Code - AI-powered coding assistant
#[derive(Parser)]
#[command(name = "claude-code")]
#[command(about = "AI-powered coding assistant", version)]
pub struct Cli {
    /// Command to execute
    #[command(subcommand)]
    pub command: Commands,
    
    /// Log level
    #[arg(long, global = true, default_value = "info")]
    pub log_level: String,
}

/// Available commands
#[derive(Subcommand)]
pub enum Commands {
    /// Interactive chat mode
    Chat {
        /// Optional single query to process
        #[arg(value_name = "QUERY")]
        query: Option<String>,
    },
}

