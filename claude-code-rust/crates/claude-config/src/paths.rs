use std::path::PathBuf;
use std::env;
use claude_core::Result;
use anyhow::Context;

/// Get the user's Claude config directory (~/.claude/)
pub fn user_config_dir() -> Result<PathBuf> {
    // Check for environment variable override
    if let Ok(config_dir) = env::var("CLAUDE_CONFIG_DIR") {
        return Ok(PathBuf::from(config_dir));
    }

    // Use the standard home directory location
    dirs::home_dir()
        .map(|home| home.join(".claude"))
        .ok_or_else(|| {
            anyhow::anyhow!("Could not determine home directory")
                .into()
        })
}

/// Get the project's Claude config directory (./.claude/)
pub fn project_config_dir() -> Result<PathBuf> {
    let current_dir = env::current_dir()
        .context("Could not get current directory")?;
    Ok(current_dir.join(".claude"))
}

/// Get the user settings file path (~/.claude/settings.json)
pub fn user_settings_path() -> Result<PathBuf> {
    Ok(user_config_dir()?.join("settings.json"))
}

/// Get the project settings file path (./.claude/settings.json)
pub fn project_settings_path() -> Result<PathBuf> {
    Ok(project_config_dir()?.join("settings.json"))
}

/// Get the user MCP config file path (~/.claude/.mcp.json)
pub fn user_mcp_path() -> Result<PathBuf> {
    Ok(user_config_dir()?.join(".mcp.json"))
}

/// Get the project MCP config file path (./.claude/.mcp.json)
pub fn project_mcp_path() -> Result<PathBuf> {
    Ok(project_config_dir()?.join(".mcp.json"))
}

/// Ensure the user config directory exists
pub fn ensure_user_config_dir() -> Result<PathBuf> {
    let config_dir = user_config_dir()?;
    std::fs::create_dir_all(&config_dir)
        .context("Failed to create user config directory")?;
    Ok(config_dir)
}

/// Ensure the project config directory exists
pub fn ensure_project_config_dir() -> Result<PathBuf> {
    let config_dir = project_config_dir()?;
    std::fs::create_dir_all(&config_dir)
        .context("Failed to create project config directory")?;
    Ok(config_dir)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_user_config_dir() {
        let dir = user_config_dir();
        assert!(dir.is_ok());
        assert!(dir.unwrap().to_string_lossy().contains(".claude"));
    }

    #[test]
    fn test_project_config_dir() {
        let dir = project_config_dir();
        assert!(dir.is_ok());
        assert!(dir.unwrap().to_string_lossy().contains(".claude"));
    }
}
