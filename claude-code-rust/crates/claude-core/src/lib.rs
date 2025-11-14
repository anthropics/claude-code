//! Core types, traits, and error handling for Claude Code
//!
//! This crate provides the fundamental building blocks for Claude Code,
//! including error handling, tool abstractions, and core data types.
//!
//! # Safety
//! This crate forbids unsafe code to ensure memory safety and reliability.

#![forbid(unsafe_code)]

pub mod error;
pub mod tool;
pub mod types;

pub use error::{ClaudeError, Result};
pub use tool::{Tool, ToolDescription, ToolInput, ToolRegistry, ToolResult};
pub use types::{ContentBlock, ImageSource, Message, ModelConfig, Role, SessionId};

// Re-export commonly used types
pub use anyhow;
pub use async_trait;
pub use serde;
pub use serde_json;
