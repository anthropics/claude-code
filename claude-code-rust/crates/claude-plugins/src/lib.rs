//! Claude Plugins - Plugin system for loading and parsing markdown-based plugins.
//!
//! This crate provides a complete plugin system for Claude Code that supports:
//! - Slash commands defined in markdown files with YAML frontmatter
//! - Agent plugins with system prompts and tool configurations
//! - Plugin metadata and discovery
//!
//! # Architecture
//!
//! The plugin system is organized into several modules:
//!
//! - `command` - Slash command definitions and parsing
//! - `agent` - Agent plugin definitions and parsing
//! - `metadata` - Plugin metadata from plugin.json files
//! - `discovery` - Filesystem scanning and plugin loading
//! - `frontmatter` - YAML frontmatter parsing utilities
//!
//! # Markdown Format
//!
//! Plugins are defined using markdown files with YAML frontmatter. For example:
//!
//! ```markdown
//! ---
//! description: Commit and push changes
//! allowed-tools: Bash(git *:*), Read, Write
//! ---
//!
//! # Your Task
//! Create a commit and push to origin
//! ```
//!
//! # Usage
//!
//! ```rust,no_run
//! use claude_plugins::discovery::PluginDiscovery;
//! use std::path::PathBuf;
//!
//! // Discover all commands in a directory
//! let commands_dir = PathBuf::from(".claude/commands");
//! let commands = PluginDiscovery::discover_commands(&commands_dir)?;
//!
//! for cmd in commands {
//!     println!("Command: {} - {}", cmd.name, cmd.description);
//! }
//!
//! // Discover all agents in a directory
//! let agents_dir = PathBuf::from(".claude/agents");
//! let agents = PluginDiscovery::discover_agents(&agents_dir)?;
//!
//! for agent in agents {
//!     println!("Agent: {} - {}", agent.name, agent.description);
//! }
//!
//! // Load a complete plugin directory
//! let plugin_dir = PathBuf::from("plugins/my-plugin");
//! let plugin = PluginDiscovery::discover_plugin_directory(&plugin_dir)?;
//!
//! if let Some(metadata) = plugin.metadata {
//!     println!("Plugin: {} v{}", metadata.name, metadata.version);
//! }
//! # Ok::<(), anyhow::Error>(())
//! ```

pub mod agent;
pub mod command;
pub mod discovery;
pub mod frontmatter;
pub mod metadata;

// Re-export main types for convenience
pub use agent::AgentDefinition;
pub use command::CommandDefinition;
pub use discovery::{DiscoveredPlugin, PluginDiscovery};
pub use metadata::PluginMetadata;
