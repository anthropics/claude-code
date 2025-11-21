//! Frontmatter parser for extracting YAML metadata from markdown files.

use anyhow::{Context, Result};
use serde::de::DeserializeOwned;

/// Represents the result of parsing a markdown file with frontmatter.
#[derive(Debug, Clone)]
pub struct ParsedMarkdown<T> {
    /// The parsed frontmatter metadata
    pub frontmatter: T,
    /// The markdown body content (everything after the frontmatter)
    pub body: String,
}

/// Parser for extracting YAML frontmatter from markdown files.
pub struct FrontmatterParser;

impl FrontmatterParser {
    /// Parse a markdown file with YAML frontmatter.
    ///
    /// Expected format:
    /// ```markdown
    /// ---
    /// key: value
    /// another-key: another value
    /// ---
    ///
    /// # Markdown body
    /// Content here...
    /// ```
    pub fn parse<T: DeserializeOwned>(content: &str) -> Result<ParsedMarkdown<T>> {
        let (frontmatter_str, body) = Self::extract_frontmatter(content)?;

        let frontmatter: T =
            serde_yaml::from_str(frontmatter_str).context("Failed to parse YAML frontmatter")?;

        Ok(ParsedMarkdown {
            frontmatter,
            body: body.to_string(),
        })
    }

    /// Extract the frontmatter and body from markdown content.
    ///
    /// Returns a tuple of (frontmatter_yaml, body_markdown).
    fn extract_frontmatter(content: &str) -> Result<(&str, &str)> {
        let content = content.trim_start();

        // Check if content starts with frontmatter delimiter
        if !content.starts_with("---") {
            anyhow::bail!("Markdown file must start with frontmatter delimiter '---'");
        }

        // Skip the first "---" and find the closing "---"
        let after_first_delimiter = &content[3..];

        // Find the closing delimiter
        let end_delimiter_pos = after_first_delimiter
            .find("\n---")
            .context("Could not find closing frontmatter delimiter '---'")?;

        let frontmatter = &after_first_delimiter[..end_delimiter_pos].trim();

        // Body starts after the closing "---" and any following newlines
        let body_start = 3 + end_delimiter_pos + 4; // "---" + frontmatter + "\n---"
        let body = if body_start < content.len() {
            content[body_start..].trim()
        } else {
            ""
        };

        Ok((frontmatter, body))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::Deserialize;

    #[derive(Debug, Deserialize, PartialEq)]
    struct TestFrontmatter {
        title: String,
        description: Option<String>,
    }

    #[test]
    fn test_parse_frontmatter() {
        let content = r#"---
title: Test Command
description: A test description
---

# Body Content
This is the body."#;

        let result: ParsedMarkdown<TestFrontmatter> = FrontmatterParser::parse(content).unwrap();

        assert_eq!(result.frontmatter.title, "Test Command");
        assert_eq!(
            result.frontmatter.description,
            Some("A test description".to_string())
        );
        assert!(result.body.contains("# Body Content"));
    }

    #[test]
    fn test_missing_frontmatter() {
        let content = "# Just a markdown file";
        let result: Result<ParsedMarkdown<TestFrontmatter>> = FrontmatterParser::parse(content);
        assert!(result.is_err());
    }
}
