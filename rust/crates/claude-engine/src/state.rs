//! Application state management

use std::collections::HashMap;

use claude_core::{AgentConfig, AgentState, Session, SessionId, UsageTracker};

/// Global application state
#[derive(Debug)]
pub struct AppState {
    /// Current active session
    pub current_session: Option<Session>,
    /// All sessions
    pub sessions: HashMap<SessionId, Session>,
    /// Agent configuration
    pub config: AgentConfig,
    /// Agent runtime state
    pub agent: AgentState,
    /// Usage tracking
    pub usage: UsageTracker,
    /// Whether running in headless mode
    pub headless: bool,
    /// Debug mode
    pub debug: bool,
    /// Theme preference
    pub theme: String,
}

impl AppState {
    /// Create new application state
    pub fn new() -> Self {
        let cwd = std::env::current_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| "/".to_string());
        
        Self {
            current_session: Some(Session::new(cwd)),
            sessions: HashMap::new(),
            config: AgentConfig::default(),
            agent: AgentState::new(),
            usage: UsageTracker::new(),
            headless: false,
            debug: false,
            theme: "dark".to_string(),
        }
    }
    
    /// Create new session
    pub fn new_session(&mut self) -> Session {
        let cwd = std::env::current_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| "/".to_string());
        
        let session = Session::new(cwd);
        
        // Save current if it has content
        if let Some(ref current) = self.current_session {
            if current.message_count() > 0 {
                self.sessions.insert(current.id.clone(), current.clone());
            }
        }
        
        let id = session.id.clone();
        self.current_session = Some(session);
        self.sessions.get(&id).unwrap().clone()
    }
    
    /// Switch to session
    pub fn switch_session(&mut self, session_id: &SessionId) -> Option<&Session> {
        if let Some(session) = self.sessions.get(session_id) {
            self.current_session = Some(session.clone());
            self.current_session.as_ref()
        } else {
            None
        }
    }
    
    /// Get session list
    pub fn list_sessions(&self) -> Vec<&Session> {
        let mut sessions: Vec<&Session> = self.sessions.values().collect();
        if let Some(ref current) = self.current_session {
            // Include current if not in list
            if !sessions.iter().any(|s| s.id == current.id) {
                sessions.push(current);
            }
        }
        // Sort by last activity
        sessions.sort_by(|a, b| b.last_activity.cmp(&a.last_activity));
        sessions
    }
    
    /// Clear current conversation
    pub fn clear_conversation(&mut self) {
        if let Some(ref mut session) = self.current_session {
            session.clear();
        }
    }
    
    /// Set model
    pub fn set_model(&mut self, model: impl Into<String>) {
        self.config.model = model.into();
    }
    
    /// Get current model
    pub fn current_model(&self) -> &str {
        &self.config.model
    }
    
    /// Check if debug mode
    pub fn is_debug(&self) -> bool {
        self.debug
    }
    
    /// Set debug mode
    pub fn set_debug(&mut self, debug: bool) {
        self.debug = debug;
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

