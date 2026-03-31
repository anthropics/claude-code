//! Complete tool implementations for Claude Code

use async_trait::async_trait;
use claude_core::{ClaudeError, ClaudeResult, PermissionContext, PermissionResult, Tool, ToolContext, ToolDefinition, ToolInput, ToolOutput, ToolValidation};
use serde_json::json;
use std::collections::HashMap;

pub mod bash;
pub mod file;
pub mod grep;
pub mod glob;
pub mod ls;
pub mod mcp;
pub mod git;
pub mod github;
pub mod lsp;

pub use bash::BashTool;
pub use file::{FileEditTool, FileReadTool, FileWriteTool};
pub use grep::GrepTool;
pub use glob::GlobTool;
pub use ls::LSTool;
pub use mcp::MCPTool;
pub use git::GitTool;
pub use github::GitHubTool;
pub use lsp::LSPTool;

/// Create default tool set
pub fn default_tools() -> Vec<Box<dyn Tool>> {
    vec![
        Box::new(BashTool::new()),
        Box::new(FileReadTool::new()),
        Box::new(FileWriteTool::new()),
        Box::new(FileEditTool::new()),
        Box::new(GrepTool::new()),
        Box::new(GlobTool::new()),
        Box::new(LSTool::new()),
    ]
}

/// Tool factory
pub struct ToolFactory;

impl ToolFactory {
    /// Create tool by name
    pub fn create(name: &str) -> Option<Box<dyn Tool>> {
        match name {
            "Bash" | "bash" => Some(Box::new(BashTool::new())),
            "Read" | "read" | "FileRead" => Some(Box::new(FileReadTool::new())),
            "Write" | "write" | "FileWrite" => Some(Box::new(FileWriteTool::new())),
            "Edit" | "edit" | "FileEdit" => Some(Box::new(FileEditTool::new())),
            "Grep" | "grep" => Some(Box::new(GrepTool::new())),
            "Glob" | "glob" => Some(Box::new(GlobTool::new())),
            "LS" | "ls" | "List" => Some(Box::new(LSTool::new())),
            "Git" | "git" => Some(Box::new(GitTool::new())),
            "GitHub" | "github" => Some(Box::new(GitHubTool::new())),
            "LSP" | "lsp" => Some(Box::new(LSPTool::new())),
            _ => None,
        }
    }
}

