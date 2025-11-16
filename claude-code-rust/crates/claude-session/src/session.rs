//! Session management for Claude Code
//!
//! This module provides the core Session type that manages session state,
//! including custom state storage, working directory, and background shells.

use anyhow::{Context, Result};
use chrono::{DateTime, Duration, Utc};
use claude_core::types::SessionId;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::env;
use std::path::PathBuf;

use crate::background_shells::BackgroundShellRegistry;
use crate::state_file::StateFile;

/// Serialized session state that gets persisted to disk
#[derive(Debug, Clone, Serialize, Deserialize)]
struct SessionState {
    /// Session ID
    id: SessionId,

    /// When the session was created
    created_at: DateTime<Utc>,

    /// Last time the session was accessed
    last_accessed: DateTime<Utc>,

    /// Working directory for the session
    working_dir: PathBuf,

    /// Custom state data (key-value store)
    state: HashMap<String, serde_json::Value>,

    /// Background shell registry
    #[serde(default)]
    background_shells: BackgroundShellRegistry,
}

/// A Claude Code session
///
/// Sessions manage state for a single conversation, including:
/// - Session ID and metadata
/// - Working directory
/// - Custom state (key-value store)
/// - Background shell processes
///
/// Sessions are automatically persisted to disk at `~/.claude/sessions/{session_id}.json`
pub struct Session {
    /// Session ID
    id: SessionId,

    /// When the session was created
    created_at: DateTime<Utc>,

    /// Last time the session was accessed
    last_accessed: DateTime<Utc>,

    /// Working directory for the session
    working_dir: PathBuf,

    /// Custom state data (key-value store)
    state: HashMap<String, serde_json::Value>,

    /// Background shell registry
    background_shells: BackgroundShellRegistry,
}

impl Session {
    /// Create a new session with a generated ID
    ///
    /// The session will use the current working directory by default.
    ///
    /// # Example
    ///
    /// ```rust
    /// use claude_session::Session;
    ///
    /// let session = Session::new();
    /// println!("Created session: {}", session.id());
    /// ```
    pub fn new() -> Self {
        let working_dir = env::current_dir().unwrap_or_else(|_| PathBuf::from("/"));

        Session {
            id: SessionId::generate(),
            created_at: Utc::now(),
            last_accessed: Utc::now(),
            working_dir,
            state: HashMap::new(),
            background_shells: BackgroundShellRegistry::new(),
        }
    }

    /// Create a new session with a specific working directory
    pub fn new_with_dir(working_dir: PathBuf) -> Self {
        Session {
            id: SessionId::generate(),
            created_at: Utc::now(),
            last_accessed: Utc::now(),
            working_dir,
            state: HashMap::new(),
            background_shells: BackgroundShellRegistry::new(),
        }
    }

    /// Load an existing session by ID
    ///
    /// Returns an error if the session doesn't exist or cannot be loaded.
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// use claude_session::Session;
    /// use claude_core::types::SessionId;
    ///
    /// let session_id = SessionId::new("session_12345");
    /// let session = Session::from_id(&session_id).unwrap();
    /// ```
    pub fn from_id(session_id: &SessionId) -> Result<Self> {
        let state: SessionState = StateFile::load_state(session_id.as_str())
            .with_context(|| format!("Failed to load session: {}", session_id))?;

        Ok(Session {
            id: state.id,
            created_at: state.created_at,
            last_accessed: Utc::now(), // Update access time on load
            working_dir: state.working_dir,
            state: state.state,
            background_shells: state.background_shells,
        })
    }

    /// Get the session ID
    pub fn id(&self) -> &SessionId {
        &self.id
    }

    /// Get when the session was created
    pub fn created_at(&self) -> DateTime<Utc> {
        self.created_at
    }

    /// Get when the session was last accessed
    pub fn last_accessed(&self) -> DateTime<Utc> {
        self.last_accessed
    }

    /// Get the working directory
    pub fn working_dir(&self) -> &PathBuf {
        &self.working_dir
    }

    /// Set the working directory
    pub fn set_working_dir(&mut self, dir: PathBuf) {
        self.working_dir = dir;
        self.last_accessed = Utc::now();
    }

    /// Get a custom state value
    pub fn get_state(&self, key: &str) -> Option<&serde_json::Value> {
        self.state.get(key)
    }

    /// Get a custom state value and deserialize it
    pub fn get_state_typed<T: for<'de> Deserialize<'de>>(&self, key: &str) -> Result<Option<T>> {
        match self.state.get(key) {
            Some(value) => {
                let typed = serde_json::from_value(value.clone())
                    .with_context(|| format!("Failed to deserialize state key: {}", key))?;
                Ok(Some(typed))
            }
            None => Ok(None),
        }
    }

    /// Set a custom state value
    pub fn set_state(&mut self, key: impl Into<String>, value: serde_json::Value) {
        self.state.insert(key.into(), value);
        self.last_accessed = Utc::now();
    }

    /// Set a custom state value from a serializable type
    pub fn set_state_typed<T: Serialize>(
        &mut self,
        key: impl Into<String>,
        value: &T,
    ) -> Result<()> {
        let json_value = serde_json::to_value(value).context("Failed to serialize state value")?;
        self.set_state(key, json_value);
        Ok(())
    }

    /// Remove a custom state value
    pub fn remove_state(&mut self, key: &str) -> Option<serde_json::Value> {
        self.last_accessed = Utc::now();
        self.state.remove(key)
    }

    /// Clear all custom state
    pub fn clear_state(&mut self) {
        self.state.clear();
        self.last_accessed = Utc::now();
    }

    /// Get all state keys
    pub fn state_keys(&self) -> Vec<&String> {
        self.state.keys().collect()
    }

    /// Get the background shell registry
    pub fn background_shells(&self) -> &BackgroundShellRegistry {
        &self.background_shells
    }

    /// Get a mutable reference to the background shell registry
    pub fn background_shells_mut(&mut self) -> &mut BackgroundShellRegistry {
        self.last_accessed = Utc::now();
        &mut self.background_shells
    }

    /// Save the session to disk
    ///
    /// Sessions are automatically saved to `~/.claude/sessions/{session_id}.json`
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// use claude_session::Session;
    ///
    /// let mut session = Session::new();
    /// session.set_state("key", serde_json::json!("value"));
    /// session.save().unwrap();
    /// ```
    pub fn save(&self) -> Result<()> {
        let state = SessionState {
            id: self.id.clone(),
            created_at: self.created_at,
            last_accessed: self.last_accessed,
            working_dir: self.working_dir.clone(),
            state: self.state.clone(),
            background_shells: self.background_shells.clone(),
        };

        StateFile::save_state(self.id.as_str(), &state)
            .with_context(|| format!("Failed to save session: {}", self.id))?;

        Ok(())
    }

    /// Load a session from disk by session ID
    ///
    /// This is an alias for `Session::from_id()`
    pub fn load(session_id: &SessionId) -> Result<Self> {
        Self::from_id(session_id)
    }

    /// Delete this session from disk
    pub fn delete(&self) -> Result<()> {
        StateFile::delete_state(self.id.as_str())
            .with_context(|| format!("Failed to delete session: {}", self.id))?;
        Ok(())
    }

    /// Check if a session exists on disk
    pub fn exists(session_id: &SessionId) -> Result<bool> {
        StateFile::exists(session_id.as_str())
    }

    /// Get the age of this session in seconds
    pub fn age_seconds(&self) -> i64 {
        let now = Utc::now();
        (now - self.created_at).num_seconds()
    }

    /// Get the time since last access in seconds
    pub fn time_since_access_seconds(&self) -> i64 {
        let now = Utc::now();
        (now - self.last_accessed).num_seconds()
    }

    /// Clean up old sessions (older than the specified number of days)
    ///
    /// This is a static method that scans all sessions and removes those
    /// that haven't been accessed in the specified number of days.
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// use claude_session::Session;
    ///
    /// // Remove sessions older than 30 days
    /// let removed = Session::cleanup_old_sessions(30).unwrap();
    /// println!("Removed {} old sessions", removed.len());
    /// ```
    pub fn cleanup_old_sessions(days: i64) -> Result<Vec<String>> {
        let session_ids = StateFile::list_sessions().context("Failed to list sessions")?;

        let mut removed = Vec::new();
        let cutoff = Utc::now() - Duration::days(days);

        for session_id in session_ids {
            // Try to load the session
            match StateFile::load_state::<SessionState>(&session_id) {
                Ok(state) => {
                    // Check if it's old enough to remove
                    if state.last_accessed < cutoff {
                        if let Err(e) = StateFile::delete_state(&session_id) {
                            eprintln!("Failed to delete old session {}: {}", session_id, e);
                        } else {
                            removed.push(session_id);
                        }
                    }
                }
                Err(e) => {
                    // If we can't load it, it might be corrupted - try to delete it
                    eprintln!(
                        "Failed to load session {} (may be corrupted): {}",
                        session_id, e
                    );
                    if let Err(e) = StateFile::delete_state(&session_id) {
                        eprintln!("Failed to delete corrupted session {}: {}", session_id, e);
                    } else {
                        removed.push(session_id);
                    }
                }
            }
        }

        Ok(removed)
    }

    /// List all session IDs
    pub fn list_all() -> Result<Vec<String>> {
        StateFile::list_sessions()
    }
}

impl Default for Session {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::{Deserialize, Serialize};

    #[derive(Debug, Serialize, Deserialize, PartialEq)]
    struct TestData {
        name: String,
        count: u32,
    }

    #[test]
    fn test_session_creation() {
        let session = Session::new();
        assert!(session.id().as_str().starts_with("session_"));
        assert_eq!(session.state.len(), 0);
    }

    #[test]
    fn test_session_with_dir() {
        let dir = PathBuf::from("/tmp/test");
        let session = Session::new_with_dir(dir.clone());
        assert_eq!(session.working_dir(), &dir);
    }

    #[test]
    fn test_state_management() {
        let mut session = Session::new();

        // Set state
        session.set_state("key1", serde_json::json!("value1"));
        session.set_state("key2", serde_json::json!(42));

        // Get state
        assert_eq!(
            session.get_state("key1"),
            Some(&serde_json::json!("value1"))
        );
        assert_eq!(session.get_state("key2"), Some(&serde_json::json!(42)));
        assert_eq!(session.get_state("nonexistent"), None);

        // Remove state
        let removed = session.remove_state("key1");
        assert_eq!(removed, Some(serde_json::json!("value1")));
        assert_eq!(session.get_state("key1"), None);

        // Clear state
        session.clear_state();
        assert_eq!(session.state.len(), 0);
    }

    #[test]
    fn test_typed_state() {
        let mut session = Session::new();

        let test_data = TestData {
            name: "test".to_string(),
            count: 100,
        };

        // Set typed state
        session.set_state_typed("data", &test_data).unwrap();

        // Get typed state
        let retrieved: Option<TestData> = session.get_state_typed("data").unwrap();
        assert_eq!(retrieved, Some(test_data));

        // Get non-existent typed state
        let missing: Option<TestData> = session.get_state_typed("missing").unwrap();
        assert_eq!(missing, None);
    }

    #[test]
    fn test_save_and_load() {
        let mut session = Session::new();
        let session_id = session.id().clone();

        // Set some state
        session.set_state("test_key", serde_json::json!("test_value"));
        session.set_working_dir(PathBuf::from("/tmp/test"));

        // Save session
        session.save().unwrap();

        // Load session
        let loaded = Session::from_id(&session_id).unwrap();

        assert_eq!(loaded.id(), &session_id);
        assert_eq!(
            loaded.get_state("test_key"),
            Some(&serde_json::json!("test_value"))
        );
        assert_eq!(loaded.working_dir(), &PathBuf::from("/tmp/test"));

        // Clean up
        loaded.delete().unwrap();
    }

    #[test]
    fn test_session_exists() {
        let session = Session::new();
        let session_id = session.id().clone();

        // Should not exist initially
        assert!(!Session::exists(&session_id).unwrap());

        // Save and check
        session.save().unwrap();
        assert!(Session::exists(&session_id).unwrap());

        // Delete and check
        session.delete().unwrap();
        assert!(!Session::exists(&session_id).unwrap());
    }

    #[test]
    fn test_list_all_sessions() {
        let session1 = Session::new();
        let session2 = Session::new();

        session1.save().unwrap();
        session2.save().unwrap();

        let all_sessions = Session::list_all().unwrap();
        assert!(all_sessions.contains(&session1.id().as_str().to_string()));
        assert!(all_sessions.contains(&session2.id().as_str().to_string()));

        // Clean up
        session1.delete().unwrap();
        session2.delete().unwrap();
    }

    #[test]
    fn test_state_keys() {
        let mut session = Session::new();

        session.set_state("key1", serde_json::json!(1));
        session.set_state("key2", serde_json::json!(2));
        session.set_state("key3", serde_json::json!(3));

        let keys = session.state_keys();
        assert_eq!(keys.len(), 3);
        assert!(keys.contains(&&"key1".to_string()));
        assert!(keys.contains(&&"key2".to_string()));
        assert!(keys.contains(&&"key3".to_string()));
    }

    #[test]
    fn test_age_seconds() {
        let session = Session::new();
        let age = session.age_seconds();

        // Should be very close to 0
        assert!(age >= 0);
        assert!(age < 2); // Less than 2 seconds old
    }
}
