//! Hook discovery from plugin directories.
//!
//! This module handles discovering and loading hook configurations from
//! plugin directories and hooks.json files.

use crate::hook::{HookConfig, HookError};
use std::path::{Path, PathBuf};

/// Discovers hooks from plugin directories.
///
/// This struct is responsible for:
/// - Finding hooks.json files in plugin directories
/// - Loading and parsing hook configurations
/// - Aggregating hooks from multiple sources
pub struct HookDiscovery {
    /// Paths to search for hooks
    search_paths: Vec<PathBuf>,
}

impl HookDiscovery {
    /// Creates a new hook discovery instance.
    pub fn new() -> Self {
        Self {
            search_paths: Vec::new(),
        }
    }

    /// Adds a search path for hook discovery.
    pub fn add_search_path(&mut self, path: PathBuf) {
        self.search_paths.push(path);
    }

    /// Adds multiple search paths for hook discovery.
    pub fn add_search_paths(&mut self, paths: Vec<PathBuf>) {
        self.search_paths.extend(paths);
    }

    /// Discovers all hooks from the configured search paths.
    ///
    /// This method:
    /// 1. Searches for hooks.json files in all search paths
    /// 2. Loads and parses each hooks.json file
    /// 3. Aggregates all hooks into a single HookConfig
    pub fn discover_hooks(&self) -> Result<HookConfig, HookError> {
        let mut aggregated_config = HookConfig::new();

        for search_path in &self.search_paths {
            if let Ok(hooks) = self.discover_hooks_in_path(search_path) {
                for hook in hooks.hooks {
                    aggregated_config.add_hook(hook);
                }
            }
        }

        Ok(aggregated_config)
    }

    /// Discovers hooks in a specific path.
    ///
    /// Looks for:
    /// - hooks.json in the given directory
    /// - hooks.json in subdirectories (plugins)
    fn discover_hooks_in_path(&self, path: &Path) -> Result<HookConfig, HookError> {
        let mut config = HookConfig::new();

        // Check for hooks.json in the current directory
        let hooks_file = path.join("hooks.json");
        if hooks_file.exists() && hooks_file.is_file() {
            match HookConfig::from_file(&hooks_file) {
                Ok(loaded_config) => {
                    for hook in loaded_config.hooks {
                        config.add_hook(hook);
                    }
                }
                Err(e) => {
                    eprintln!("Warning: Failed to load hooks from {:?}: {}", hooks_file, e);
                }
            }
        }

        // Check for hooks.json in subdirectories (plugin directories)
        if let Ok(entries) = std::fs::read_dir(path) {
            for entry in entries.flatten() {
                if let Ok(file_type) = entry.file_type() {
                    if file_type.is_dir() {
                        let subdir = entry.path();
                        let subdir_hooks_file = subdir.join("hooks.json");

                        if subdir_hooks_file.exists() && subdir_hooks_file.is_file() {
                            match HookConfig::from_file(&subdir_hooks_file) {
                                Ok(loaded_config) => {
                                    for hook in loaded_config.hooks {
                                        config.add_hook(hook);
                                    }
                                }
                                Err(e) => {
                                    eprintln!(
                                        "Warning: Failed to load hooks from {:?}: {}",
                                        subdir_hooks_file, e
                                    );
                                }
                            }
                        }
                    }
                }
            }
        }

        Ok(config)
    }

    /// Loads hooks from a specific hooks.json file.
    pub fn load_hooks_file(&self, path: &Path) -> Result<HookConfig, HookError> {
        HookConfig::from_file(&path.to_path_buf())
    }

    /// Discovers hooks from the default Claude plugin directories.
    ///
    /// Default locations:
    /// - .claude/hooks.json (project-level hooks)
    /// - .claude/plugins/*/hooks.json (plugin hooks)
    /// - ~/.claude/plugins/*/hooks.json (user-level plugin hooks)
    pub fn discover_default_hooks(project_root: &Path) -> Result<HookConfig, HookError> {
        let mut discovery = HookDiscovery::new();

        // Add project-level .claude directory
        let claude_dir = project_root.join(".claude");
        if claude_dir.exists() {
            discovery.add_search_path(claude_dir.clone());

            // Add project plugins directory
            let plugins_dir = claude_dir.join("plugins");
            if plugins_dir.exists() {
                discovery.add_search_path(plugins_dir);
            }
        }

        // Add user-level plugins directory
        if let Some(home_dir) = dirs::home_dir() {
            let user_plugins_dir = home_dir.join(".claude").join("plugins");
            if user_plugins_dir.exists() {
                discovery.add_search_path(user_plugins_dir);
            }
        }

        discovery.discover_hooks()
    }
}

impl Default for HookDiscovery {
    fn default() -> Self {
        Self::new()
    }
}

/// Helper function to find the project root directory.
///
/// Searches upwards from the current directory for:
/// - .git directory
/// - .claude directory
pub fn find_project_root() -> Option<PathBuf> {
    let mut current = std::env::current_dir().ok()?;

    loop {
        // Check for .git directory
        if current.join(".git").exists() {
            return Some(current);
        }

        // Check for .claude directory
        if current.join(".claude").exists() {
            return Some(current);
        }

        // Move to parent directory
        if !current.pop() {
            break;
        }
    }

    None
}

/// Helper module for directory utilities (used by discovery).
mod dirs {
    use std::path::PathBuf;

    /// Returns the user's home directory.
    pub fn home_dir() -> Option<PathBuf> {
        std::env::var_os("HOME")
            .map(PathBuf::from)
            .or_else(|| std::env::var_os("USERPROFILE").map(PathBuf::from))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_hook_discovery_empty() {
        let discovery = HookDiscovery::new();
        let config = discovery.discover_hooks().unwrap();
        assert_eq!(config.hooks.len(), 0);
    }

    #[test]
    fn test_hook_discovery_from_file() {
        let temp_dir = TempDir::new().unwrap();
        let hooks_file = temp_dir.path().join("hooks.json");

        let hooks_json = r#"{
            "hooks": [
                {
                    "hook": "SessionStart",
                    "command": "echo 'test'"
                }
            ]
        }"#;

        fs::write(&hooks_file, hooks_json).unwrap();

        let mut discovery = HookDiscovery::new();
        discovery.add_search_path(temp_dir.path().to_path_buf());

        let config = discovery.discover_hooks().unwrap();
        assert_eq!(config.hooks.len(), 1);
        assert!(config.hooks[0].is_session_start());
    }

    #[test]
    fn test_hook_discovery_from_subdirectories() {
        let temp_dir = TempDir::new().unwrap();

        // Create a plugin subdirectory
        let plugin_dir = temp_dir.path().join("my-plugin");
        fs::create_dir(&plugin_dir).unwrap();

        let hooks_file = plugin_dir.join("hooks.json");
        let hooks_json = r#"{
            "hooks": [
                {
                    "hook": "PreToolUse",
                    "command": "validate.sh",
                    "matcher": "^Write$"
                }
            ]
        }"#;

        fs::write(&hooks_file, hooks_json).unwrap();

        let mut discovery = HookDiscovery::new();
        discovery.add_search_path(temp_dir.path().to_path_buf());

        let config = discovery.discover_hooks().unwrap();
        assert_eq!(config.hooks.len(), 1);
        assert!(config.hooks[0].is_pre_tool_use());
    }

    #[test]
    fn test_hook_discovery_multiple_sources() {
        let temp_dir = TempDir::new().unwrap();

        // Create hooks.json in root
        let root_hooks = temp_dir.path().join("hooks.json");
        fs::write(
            &root_hooks,
            r#"{
            "hooks": [
                {
                    "hook": "SessionStart",
                    "command": "root.sh"
                }
            ]
        }"#,
        )
        .unwrap();

        // Create plugin with hooks
        let plugin_dir = temp_dir.path().join("plugin1");
        fs::create_dir(&plugin_dir).unwrap();
        let plugin_hooks = plugin_dir.join("hooks.json");
        fs::write(
            &plugin_hooks,
            r#"{
            "hooks": [
                {
                    "hook": "PreToolUse",
                    "command": "plugin.sh"
                }
            ]
        }"#,
        )
        .unwrap();

        let mut discovery = HookDiscovery::new();
        discovery.add_search_path(temp_dir.path().to_path_buf());

        let config = discovery.discover_hooks().unwrap();
        assert_eq!(config.hooks.len(), 2);
    }
}
