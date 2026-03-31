//! Application state management

use claude_core::{AgentState, Session, SessionId};
use std::collections::HashMap;

/// Application state
#[derive(Debug, Default)]
pub struct AppState {
    /// Active sessions
    pub sessions: HashMap<SessionId, Session>,
    /// Current agent state
    pub agent: AgentState,
}

impl AppState {
    /// Get or create session
    pub fn get_or_create_session(&mut self, id: SessionId, cwd: String) -> &mut Session {
        self.sessions.entry(id.clone()).or_insert_with(|| Session::new(cwd))
    }
    
    /// Get session by ID
    pub fn get_session(&self, id: &SessionId) -> Option<&Session> {
        self.sessions.get(id)
    }
}

