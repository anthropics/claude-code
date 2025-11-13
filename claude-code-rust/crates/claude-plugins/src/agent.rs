//! Agent definition and parsing for agent plugins.

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

use crate::frontmatter::{FrontmatterParser, ParsedMarkdown};

/// Frontmatter structure for agent markdown files.
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
struct AgentFrontmatter {
    /// Description of what the agent does
    #[serde(default)]
    description: Option<String>,

    /// Tools available to this agent (comma-separated)
    #[serde(default)]
    tools: Option<String>,

    /// Model to use for this agent
    #[serde(default)]
    model: Option<String>,

    /// Color for UI display
    #[serde(default)]
    color: Option<String>,
}

/// Represents an agent plugin definition.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentDefinition {
    /// Name of the agent (derived from filename)
    pub name: String,

    /// Description of what the agent does
    pub description: String,

    /// The system prompt for the agent (markdown body)
    pub system_prompt: String,

    /// List of tools available to this agent
    pub tools: Vec<String>,

    /// Model identifier to use
    pub model: String,

    /// Color for UI display
    pub color: Option<String>,
}

impl AgentDefinition {
    /// Load an agent definition from a markdown file.
    ///
    /// # Arguments
    /// * `path` - Path to the .md file
    /// * `name` - Agent name (typically derived from filename without .md extension)
    pub fn from_file<P: AsRef<Path>>(path: P, name: String) -> Result<Self> {
        let content = fs::read_to_string(path.as_ref())
            .context("Failed to read agent file")?;

        Self::from_markdown(&content, name)
    }

    /// Parse an agent definition from markdown content.
    pub fn from_markdown(content: &str, name: String) -> Result<Self> {
        let parsed: ParsedMarkdown<AgentFrontmatter> = FrontmatterParser::parse(content)
            .context("Failed to parse agent frontmatter")?;

        let tools = parsed
            .frontmatter
            .tools
            .as_ref()
            .map(|tools_str| {
                tools_str
                    .split(',')
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect()
            })
            .unwrap_or_default();

        Ok(AgentDefinition {
            name,
            description: parsed
                .frontmatter
                .description
                .unwrap_or_else(|| "No description provided".to_string()),
            system_prompt: parsed.body,
            tools,
            model: parsed
                .frontmatter
                .model
                .unwrap_or_else(|| "claude-sonnet-4-5-20250929".to_string()),
            color: parsed.frontmatter.color,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_agent() {
        let markdown = r#"---
description: Code review agent
tools: Read, Grep, Bash
model: claude-sonnet-4-5-20250929
color: blue
---

# System Prompt

You are a code review agent. Review code for:
- Style issues
- Potential bugs
- Performance problems"#;

        let agent = AgentDefinition::from_markdown(markdown, "code-review".to_string()).unwrap();

        assert_eq!(agent.name, "code-review");
        assert_eq!(agent.description, "Code review agent");
        assert_eq!(agent.model, "claude-sonnet-4-5-20250929");
        assert_eq!(agent.color, Some("blue".to_string()));
        assert_eq!(agent.tools.len(), 3);
        assert!(agent.tools.contains(&"Read".to_string()));
        assert!(agent.system_prompt.contains("code review agent"));
    }

    #[test]
    fn test_parse_agent_minimal() {
        let markdown = r#"---
description: Simple agent
---

You are a simple agent."#;

        let agent = AgentDefinition::from_markdown(markdown, "simple".to_string()).unwrap();

        assert_eq!(agent.name, "simple");
        assert_eq!(agent.tools.len(), 0);
        assert_eq!(agent.model, "claude-sonnet-4-5-20250929"); // default
        assert_eq!(agent.color, None);
    }
}
