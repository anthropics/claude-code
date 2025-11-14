//! Session state management for Claude Code
//!
//! This crate provides session management functionality for Claude Code,
//! including state persistence, background shell tracking, and custom state storage.
//!
//! # Overview
//!
//! Sessions are the primary way to manage state across Claude Code conversations.
//! Each session has:
//!
//! - A unique session ID
//! - Creation and last access timestamps
//! - A working directory
//! - Custom state storage (key-value store)
//! - Background shell process tracking
//!
//! # Session Persistence
//!
//! Sessions are automatically persisted to disk at `~/.claude/sessions/{session_id}.json`
//! using atomic writes to prevent corruption. The storage format is JSON, making it
//! easy to inspect and debug session state.
//!
//! # Auto-cleanup
//!
//! Sessions older than 30 days (by last access time) can be automatically removed
//! using [`Session::cleanup_old_sessions()`].
//!
//! # Examples
//!
//! ## Creating and using a session
//!
//! ```rust
//! use claude_session::Session;
//! use serde_json::json;
//!
//! # fn main() -> anyhow::Result<()> {
//! // Create a new session
//! let mut session = Session::new();
//! println!("Session ID: {}", session.id());
//!
//! // Store custom state
//! session.set_state("user_name", json!("Alice"));
//! session.set_state("preferences", json!({
//!     "theme": "dark",
//!     "notifications": true
//! }));
//!
//! // Save to disk
//! session.save()?;
//!
//! // Later, load the session
//! let loaded = Session::from_id(session.id())?;
//! assert_eq!(loaded.get_state("user_name"), Some(&json!("Alice")));
//! # Ok(())
//! # }
//! ```
//!
//! ## Managing background shells
//!
//! ```rust
//! use claude_session::Session;
//! use claude_session::background_shells::ShellInfo;
//!
//! # fn main() -> anyhow::Result<()> {
//! let mut session = Session::new();
//!
//! // Register a background shell
//! let shell_info = ShellInfo::new("shell-1", 12345, "tail -f /var/log/app.log")
//!     .with_working_dir("/app");
//!
//! session.background_shells_mut().register_shell(shell_info)?;
//!
//! // List all shells
//! let shells = session.background_shells().list_shells();
//! println!("Running shells: {}", shells.len());
//!
//! // You can kill a specific shell (requires actual PID)
//! // session.background_shells_mut().kill_shell("shell-1")?;
//!
//! // Or just unregister it without killing
//! session.background_shells_mut().unregister_shell("shell-1");
//! # Ok(())
//! # }
//! ```
//!
//! ## Cleaning up old sessions
//!
//! ```rust,no_run
//! use claude_session::Session;
//!
//! # fn main() -> anyhow::Result<()> {
//! // Remove sessions not accessed in the last 30 days
//! let removed = Session::cleanup_old_sessions(30)?;
//! println!("Removed {} old sessions", removed.len());
//! # Ok(())
//! # }
//! ```
//!
//! # Architecture
//!
//! The crate is organized into several modules:
//!
//! - [`session`] - Core session management
//! - [`state_file`] - Low-level state persistence
//! - [`background_shells`] - Background shell process tracking

pub mod background_shells;
pub mod session;
pub mod state_file;

// Re-export main types for convenience
pub use background_shells::{BackgroundShellRegistry, ShellError, ShellInfo};
pub use session::Session;
pub use state_file::StateFile;

/// The default number of days after which sessions are considered old
pub const DEFAULT_SESSION_CLEANUP_DAYS: i64 = 30;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_session_workflow() {
        // Create a new session
        let mut session = Session::new();
        let session_id = session.id().clone();

        // Add some state
        session.set_state("test", serde_json::json!({"value": 42}));

        // Save it
        session.save().unwrap();

        // Load it back
        let loaded = Session::from_id(&session_id).unwrap();
        assert_eq!(
            loaded.get_state("test"),
            Some(&serde_json::json!({"value": 42}))
        );

        // Clean up
        loaded.delete().unwrap();
    }

    #[test]
    fn test_background_shell_integration() {
        use background_shells::ShellInfo;

        let mut session = Session::new();

        // Register a shell
        let shell = ShellInfo::new("test-shell", 99999, "echo test");
        session
            .background_shells_mut()
            .register_shell(shell)
            .unwrap();

        // Verify it's registered
        assert!(session.background_shells().contains("test-shell"));
        assert_eq!(session.background_shells().count(), 1);

        // Save and reload
        let session_id = session.id().clone();
        session.save().unwrap();

        let loaded = Session::from_id(&session_id).unwrap();
        assert!(loaded.background_shells().contains("test-shell"));

        // Clean up
        loaded.delete().unwrap();
    }
}
