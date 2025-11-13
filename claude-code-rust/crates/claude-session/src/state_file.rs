//! State file management for persisting session state to disk
//!
//! This module provides functionality to save and load session state
//! from the file system using atomic writes to prevent corruption.

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// Helper for persisting session state to disk
pub struct StateFile;

impl StateFile {
    /// Get the base directory for session storage (~/.claude/sessions)
    pub fn sessions_dir() -> Result<PathBuf> {
        let home = dirs::home_dir().context("Failed to get home directory")?;
        Ok(home.join(".claude").join("sessions"))
    }

    /// Get the path for a specific session's state file
    pub fn session_path(session_id: &str) -> Result<PathBuf> {
        let sessions_dir = Self::sessions_dir()?;
        Ok(sessions_dir.join(format!("{}.json", session_id)))
    }

    /// Save state to disk using atomic write
    ///
    /// This method writes to a temporary file first, then renames it to the
    /// target path to ensure the operation is atomic and prevents corruption.
    pub fn save_state<T: Serialize>(session_id: &str, state: &T) -> Result<()> {
        let sessions_dir = Self::sessions_dir()?;
        fs::create_dir_all(&sessions_dir)
            .context("Failed to create sessions directory")?;

        let target_path = Self::session_path(session_id)?;
        let temp_path = sessions_dir.join(format!("{}.tmp", session_id));

        // Serialize state to JSON
        let json = serde_json::to_string_pretty(state)
            .context("Failed to serialize state")?;

        // Write to temporary file
        fs::write(&temp_path, json)
            .context("Failed to write temporary state file")?;

        // Atomically rename temp file to target
        fs::rename(&temp_path, &target_path)
            .context("Failed to rename temporary state file")?;

        Ok(())
    }

    /// Load state from disk
    pub fn load_state<T: for<'de> Deserialize<'de>>(session_id: &str) -> Result<T> {
        let path = Self::session_path(session_id)?;

        let contents = fs::read_to_string(&path)
            .with_context(|| format!("Failed to read state file: {}", path.display()))?;

        let state = serde_json::from_str(&contents)
            .context("Failed to deserialize state")?;

        Ok(state)
    }

    /// Delete a session's state file
    pub fn delete_state(session_id: &str) -> Result<()> {
        let path = Self::session_path(session_id)?;

        if path.exists() {
            fs::remove_file(&path)
                .with_context(|| format!("Failed to delete state file: {}", path.display()))?;
        }

        Ok(())
    }

    /// List all session files in the sessions directory
    pub fn list_sessions() -> Result<Vec<String>> {
        let sessions_dir = Self::sessions_dir()?;

        if !sessions_dir.exists() {
            return Ok(Vec::new());
        }

        let mut session_ids = Vec::new();

        for entry in fs::read_dir(&sessions_dir)
            .context("Failed to read sessions directory")? {

            let entry = entry.context("Failed to read directory entry")?;
            let path = entry.path();

            // Only include .json files (not .tmp files)
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Some(filename) = path.file_stem().and_then(|s| s.to_str()) {
                    session_ids.push(filename.to_string());
                }
            }
        }

        Ok(session_ids)
    }

    /// Check if a session state file exists
    pub fn exists(session_id: &str) -> Result<bool> {
        let path = Self::session_path(session_id)?;
        Ok(path.exists())
    }

    /// Get metadata for a session file (modification time, etc.)
    pub fn get_metadata(session_id: &str) -> Result<fs::Metadata> {
        let path = Self::session_path(session_id)?;
        fs::metadata(&path)
            .with_context(|| format!("Failed to get metadata for: {}", path.display()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::{Deserialize, Serialize};

    #[derive(Debug, Serialize, Deserialize, PartialEq)]
    struct TestState {
        value: String,
        count: u32,
    }

    #[test]
    fn test_sessions_dir() {
        let dir = StateFile::sessions_dir().unwrap();
        assert!(dir.to_string_lossy().contains(".claude/sessions"));
    }

    #[test]
    fn test_session_path() {
        let path = StateFile::session_path("test-session").unwrap();
        assert!(path.to_string_lossy().contains(".claude/sessions/test-session.json"));
    }

    #[test]
    fn test_save_and_load_state() {
        let session_id = format!("test-{}", uuid::Uuid::new_v4());
        let test_state = TestState {
            value: "hello".to_string(),
            count: 42,
        };

        // Save state
        StateFile::save_state(&session_id, &test_state).unwrap();

        // Verify file exists
        assert!(StateFile::exists(&session_id).unwrap());

        // Load state
        let loaded: TestState = StateFile::load_state(&session_id).unwrap();
        assert_eq!(loaded, test_state);

        // Clean up
        StateFile::delete_state(&session_id).unwrap();
        assert!(!StateFile::exists(&session_id).unwrap());
    }

    #[test]
    fn test_list_sessions() {
        let session_id1 = format!("test-list-{}", uuid::Uuid::new_v4());
        let session_id2 = format!("test-list-{}", uuid::Uuid::new_v4());

        let test_state = TestState {
            value: "test".to_string(),
            count: 1,
        };

        // Create two test sessions
        StateFile::save_state(&session_id1, &test_state).unwrap();
        StateFile::save_state(&session_id2, &test_state).unwrap();

        // List sessions
        let sessions = StateFile::list_sessions().unwrap();
        assert!(sessions.contains(&session_id1));
        assert!(sessions.contains(&session_id2));

        // Clean up
        StateFile::delete_state(&session_id1).unwrap();
        StateFile::delete_state(&session_id2).unwrap();
    }

    #[test]
    fn test_delete_nonexistent_state() {
        let session_id = format!("nonexistent-{}", uuid::Uuid::new_v4());

        // Should not error when deleting non-existent file
        let result = StateFile::delete_state(&session_id);
        assert!(result.is_ok());
    }
}
