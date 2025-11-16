//! Command definition and parsing for slash commands.

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

use crate::frontmatter::{FrontmatterParser, ParsedMarkdown};

/// Frontmatter structure for command markdown files.
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
struct CommandFrontmatter {
    /// Description of what the command does
    #[serde(default)]
    description: Option<String>,

    /// Allowed tools that can be used by this command
    #[serde(default)]
    allowed_tools: Option<String>,

    /// Hint for command arguments
    #[serde(default)]
    argument_hint: Option<String>,

    /// Whether to disable model invocation for this command
    #[serde(default)]
    disable_model_invocation: bool,
}

/// Represents a slash command plugin definition.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandDefinition {
    /// Name of the command (derived from filename)
    pub name: String,

    /// Description of what the command does
    pub description: String,

    /// The markdown content/prompt for the command
    pub content: String,

    /// List of allowed tools for this command
    pub allowed_tools: Option<Vec<String>>,

    /// Hint for command arguments
    pub argument_hint: Option<String>,

    /// Whether to disable model invocation
    pub disable_model_invocation: bool,
}

impl CommandDefinition {
    /// Load a command definition from a markdown file.
    ///
    /// # Arguments
    /// * `path` - Path to the .md file
    /// * `name` - Command name (typically derived from filename without .md extension)
    pub fn from_file<P: AsRef<Path>>(path: P, name: String) -> Result<Self> {
        let content = fs::read_to_string(path.as_ref()).context("Failed to read command file")?;

        Self::from_markdown(&content, name)
    }

    /// Parse a command definition from markdown content.
    pub fn from_markdown(content: &str, name: String) -> Result<Self> {
        let parsed: ParsedMarkdown<CommandFrontmatter> =
            FrontmatterParser::parse(content).context("Failed to parse command frontmatter")?;

        let allowed_tools = parsed.frontmatter.allowed_tools.as_ref().map(|tools_str| {
            tools_str
                .split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect()
        });

        Ok(CommandDefinition {
            name,
            description: parsed
                .frontmatter
                .description
                .unwrap_or_else(|| "No description provided".to_string()),
            content: parsed.body,
            allowed_tools,
            argument_hint: parsed.frontmatter.argument_hint,
            disable_model_invocation: parsed.frontmatter.disable_model_invocation,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_command() {
        let markdown = r#"---
description: Commit and push changes
allowed-tools: Bash(git *:*), Read, Write
argument-hint: <message>
---

# Your Task
Create a commit and push to origin"#;

        let cmd = CommandDefinition::from_markdown(markdown, "commit-push".to_string()).unwrap();

        assert_eq!(cmd.name, "commit-push");
        assert_eq!(cmd.description, "Commit and push changes");
        assert!(cmd.content.contains("# Your Task"));

        let tools = cmd.allowed_tools.unwrap();
        assert_eq!(tools.len(), 3);
        assert!(tools.contains(&"Bash(git *:*)".to_string()));
        assert!(tools.contains(&"Read".to_string()));
    }

    #[test]
    fn test_parse_command_minimal() {
        let markdown = r#"---
description: Simple command
---

Do something simple"#;

        let cmd = CommandDefinition::from_markdown(markdown, "simple".to_string()).unwrap();

        assert_eq!(cmd.name, "simple");
        assert_eq!(cmd.description, "Simple command");
        assert_eq!(cmd.allowed_tools, None);
        assert!(!cmd.disable_model_invocation);
    }
}
