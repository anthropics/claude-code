//! Permission management

use claude_core::{PermissionContext, PermissionResult};
use std::collections::HashMap;

/// Permission manager
pub struct PermissionManager {
    /// Current context
    context: PermissionContext,
    /// Permission history
    history: Vec<PermissionDecision>,
}

/// Permission decision
#[derive(Debug, Clone)]
pub struct PermissionDecision {
    /// Operation
    pub operation: String,
    /// Was allowed
    pub allowed: bool,
    /// Timestamp
    pub timestamp: std::time::SystemTime,
}

impl PermissionManager {
    /// Create new permission manager
    pub fn new() -> Self {
        Self {
            context: PermissionContext::default(),
            history: Vec::new(),
        }
    }
    
    /// Set permission mode
    pub fn set_mode(&mut self, mode: claude_core::PermissionMode) {
        self.context.mode = mode;
    }
    
    /// Add allowed path
    pub fn allow_path(&mut self, path: impl Into<String>) {
        self.context.allowed_paths.push(path.into());
    }
    
    /// Check permission
    pub fn check(&self, operation: &str, _data: &HashMap<String, String>) -> PermissionResult {
        match self.context.mode {
            claude_core::PermissionMode::AutoYes => PermissionResult::Allowed,
            claude_core::PermissionMode::AutoNo => PermissionResult::Denied {
                reason: "Auto-no mode".to_string(),
            },
            claude_core::PermissionMode::Ask => PermissionResult::NeedsConfirmation {
                action: operation.to_string(),
            },
            claude_core::PermissionMode::Default => {
                if operation.contains("write") || operation.contains("delete") {
                    PermissionResult::NeedsConfirmation {
                        action: operation.to_string(),
                    }
                } else {
                    PermissionResult::Allowed
                }
            }
        }
    }
    
    /// Record decision
    pub fn record(&mut self, operation: String, allowed: bool) {
        self.history.push(PermissionDecision {
            operation,
            allowed,
            timestamp: std::time::SystemTime::now(),
        });
    }
}

impl Default for PermissionManager {
    fn default() -> Self {
        Self::new()
    }
}

