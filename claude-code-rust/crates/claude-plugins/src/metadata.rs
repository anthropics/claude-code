//! Plugin metadata parsing from plugin.json files.

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

/// Metadata for a plugin, typically loaded from plugin.json.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginMetadata {
    /// Plugin name
    pub name: String,

    /// Plugin version
    pub version: String,

    /// Description of what the plugin does
    pub description: String,

    /// Plugin author
    #[serde(default)]
    pub author: Option<String>,

    /// Plugin homepage or repository URL
    #[serde(default)]
    pub homepage: Option<String>,

    /// Plugin license
    #[serde(default)]
    pub license: Option<String>,

    /// Keywords for searching/categorizing the plugin
    #[serde(default)]
    pub keywords: Vec<String>,
}

impl PluginMetadata {
    /// Load plugin metadata from a plugin.json file.
    pub fn from_file<P: AsRef<Path>>(path: P) -> Result<Self> {
        let content = fs::read_to_string(path.as_ref())
            .context("Failed to read plugin.json")?;

        Self::from_json(&content)
    }

    /// Parse plugin metadata from JSON string.
    pub fn from_json(json: &str) -> Result<Self> {
        serde_json::from_str(json).context("Failed to parse plugin.json")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_metadata() {
        let json = r#"{
            "name": "my-plugin",
            "version": "1.0.0",
            "description": "A test plugin",
            "author": "Test Author",
            "homepage": "https://example.com",
            "license": "MIT",
            "keywords": ["test", "example"]
        }"#;

        let metadata = PluginMetadata::from_json(json).unwrap();

        assert_eq!(metadata.name, "my-plugin");
        assert_eq!(metadata.version, "1.0.0");
        assert_eq!(metadata.description, "A test plugin");
        assert_eq!(metadata.author, Some("Test Author".to_string()));
        assert_eq!(metadata.keywords.len(), 2);
    }

    #[test]
    fn test_parse_metadata_minimal() {
        let json = r#"{
            "name": "minimal-plugin",
            "version": "0.1.0",
            "description": "Minimal plugin"
        }"#;

        let metadata = PluginMetadata::from_json(json).unwrap();

        assert_eq!(metadata.name, "minimal-plugin");
        assert_eq!(metadata.author, None);
        assert_eq!(metadata.keywords.len(), 0);
    }
}
