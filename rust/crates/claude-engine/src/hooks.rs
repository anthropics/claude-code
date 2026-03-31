//! Hook system for lifecycle extension

/// Hook phase
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HookPhase {
    /// Before query
    BeforeQuery,
    /// After query
    AfterQuery,
    /// Before tool use
    BeforeToolUse,
    /// After tool use
    AfterToolUse,
}

/// Hook trait
pub trait Hook: Send + Sync {
    /// Get hook phase
    fn phase(&self) -> HookPhase;
    /// Execute hook
    fn execute(&self, context: &mut serde_json::Value);
}

