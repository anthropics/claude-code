//! Plugin discovery system for finding and loading plugins from the filesystem.

use anyhow::{Context, Result};
use std::path::Path;
use walkdir::WalkDir;

use crate::agent::AgentDefinition;
use crate::command::CommandDefinition;
use crate::metadata::PluginMetadata;

/// Plugin discovery service for locating and loading plugins.
pub struct PluginDiscovery;

impl PluginDiscovery {
    /// Discover all command plugins in a directory.
    ///
    /// Scans for .md files in the commands directory and parses them
    /// as CommandDefinition objects.
    ///
    /// # Arguments
    /// * `path` - Path to the commands directory (e.g., .claude/commands)
    pub fn discover_commands<P: AsRef<Path>>(path: P) -> Result<Vec<CommandDefinition>> {
        let path = path.as_ref();

        if !path.exists() {
            return Ok(Vec::new());
        }

        let mut commands = Vec::new();

        for entry in WalkDir::new(path)
            .follow_links(true)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let entry_path = entry.path();

            // Only process .md files
            if !entry_path.is_file()
                || entry_path.extension().and_then(|s| s.to_str()) != Some("md")
            {
                continue;
            }

            // Derive command name from filename (without .md extension)
            let name = entry_path
                .file_stem()
                .and_then(|s| s.to_str())
                .context("Invalid filename")?
                .to_string();

            match CommandDefinition::from_file(entry_path, name.clone()) {
                Ok(cmd) => commands.push(cmd),
                Err(e) => {
                    eprintln!("Warning: Failed to load command '{}': {}", name, e);
                }
            }
        }

        Ok(commands)
    }

    /// Discover all agent plugins in a directory.
    ///
    /// Scans for .md files in the agents directory and parses them
    /// as AgentDefinition objects.
    ///
    /// # Arguments
    /// * `path` - Path to the agents directory (e.g., .claude/agents)
    pub fn discover_agents<P: AsRef<Path>>(path: P) -> Result<Vec<AgentDefinition>> {
        let path = path.as_ref();

        if !path.exists() {
            return Ok(Vec::new());
        }

        let mut agents = Vec::new();

        for entry in WalkDir::new(path)
            .follow_links(true)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let entry_path = entry.path();

            // Only process .md files
            if !entry_path.is_file()
                || entry_path.extension().and_then(|s| s.to_str()) != Some("md")
            {
                continue;
            }

            // Derive agent name from filename (without .md extension)
            let name = entry_path
                .file_stem()
                .and_then(|s| s.to_str())
                .context("Invalid filename")?
                .to_string();

            match AgentDefinition::from_file(entry_path, name.clone()) {
                Ok(agent) => agents.push(agent),
                Err(e) => {
                    eprintln!("Warning: Failed to load agent '{}': {}", name, e);
                }
            }
        }

        Ok(agents)
    }

    /// Load plugin metadata from a plugin.json file.
    ///
    /// # Arguments
    /// * `path` - Path to the plugin.json file
    pub fn load_plugin_metadata<P: AsRef<Path>>(path: P) -> Result<PluginMetadata> {
        PluginMetadata::from_file(path)
    }

    /// Discover all plugins in a directory structure.
    ///
    /// Expects a directory layout like:
    /// ```text
    /// plugin_dir/
    ///   plugin.json
    ///   commands/
    ///     command1.md
    ///     command2.md
    ///   agents/
    ///     agent1.md
    ///     agent2.md
    /// ```
    pub fn discover_plugin_directory<P: AsRef<Path>>(path: P) -> Result<DiscoveredPlugin> {
        let path = path.as_ref();

        let metadata = {
            let metadata_path = path.join("plugin.json");
            if metadata_path.exists() {
                Some(Self::load_plugin_metadata(metadata_path)?)
            } else {
                None
            }
        };

        let commands = Self::discover_commands(path.join("commands"))?;
        let agents = Self::discover_agents(path.join("agents"))?;

        Ok(DiscoveredPlugin {
            metadata,
            commands,
            agents,
        })
    }
}

/// Represents a discovered plugin with all its components.
#[derive(Debug)]
pub struct DiscoveredPlugin {
    /// Plugin metadata (if plugin.json exists)
    pub metadata: Option<PluginMetadata>,

    /// Commands discovered in this plugin
    pub commands: Vec<CommandDefinition>,

    /// Agents discovered in this plugin
    pub agents: Vec<AgentDefinition>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_discover_commands() {
        let temp_dir = TempDir::new().unwrap();
        let commands_dir = temp_dir.path().join("commands");
        fs::create_dir(&commands_dir).unwrap();

        // Create a test command file
        let cmd_file = commands_dir.join("test.md");
        fs::write(
            &cmd_file,
            r#"---
description: Test command
---

Do something"#,
        )
        .unwrap();

        let commands = PluginDiscovery::discover_commands(&commands_dir).unwrap();
        assert_eq!(commands.len(), 1);
        assert_eq!(commands[0].name, "test");
    }

    #[test]
    fn test_discover_agents() {
        let temp_dir = TempDir::new().unwrap();
        let agents_dir = temp_dir.path().join("agents");
        fs::create_dir(&agents_dir).unwrap();

        // Create a test agent file
        let agent_file = agents_dir.join("reviewer.md");
        fs::write(
            &agent_file,
            r#"---
description: Review agent
tools: Read, Grep
---

You are a reviewer"#,
        )
        .unwrap();

        let agents = PluginDiscovery::discover_agents(&agents_dir).unwrap();
        assert_eq!(agents.len(), 1);
        assert_eq!(agents[0].name, "reviewer");
    }

    #[test]
    fn test_discover_plugin_directory() {
        let temp_dir = TempDir::new().unwrap();
        let plugin_dir = temp_dir.path();

        // Create plugin.json
        fs::write(
            plugin_dir.join("plugin.json"),
            r#"{
                "name": "test-plugin",
                "version": "1.0.0",
                "description": "Test plugin"
            }"#,
        )
        .unwrap();

        // Create commands directory with a command
        let commands_dir = plugin_dir.join("commands");
        fs::create_dir(&commands_dir).unwrap();
        fs::write(
            commands_dir.join("test.md"),
            r#"---
description: Test command
---

Test"#,
        )
        .unwrap();

        let plugin = PluginDiscovery::discover_plugin_directory(plugin_dir).unwrap();

        assert!(plugin.metadata.is_some());
        assert_eq!(plugin.metadata.unwrap().name, "test-plugin");
        assert_eq!(plugin.commands.len(), 1);
        assert_eq!(plugin.agents.len(), 0);
    }
}
