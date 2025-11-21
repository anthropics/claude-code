//! Agent context for isolated execution environment
//!
//! This module provides context isolation for agents, ensuring each agent
//! runs in its own isolated environment with separate tool registries and
//! result storage.

use std::collections::HashMap;
use std::sync::{Arc, RwLock};

use anyhow::Result;
use serde_json::Value;

/// Context for agent execution providing isolation and state management
///
/// Each agent runs in its own context with:
/// - Isolated tool registry (only allowed tools are accessible)
/// - Result storage for passing data between agents
/// - Metadata tracking
#[derive(Debug, Clone)]
pub struct AgentContext {
    /// Agent name
    agent_name: String,

    /// Tools allowed in this context
    allowed_tools: Vec<String>,

    /// Results from completed operations
    results: Arc<RwLock<HashMap<String, Value>>>,

    /// Metadata for the agent
    metadata: Arc<RwLock<HashMap<String, String>>>,
}

impl AgentContext {
    /// Create a new agent context
    ///
    /// # Arguments
    /// * `agent_name` - Name of the agent
    /// * `allowed_tools` - List of tools the agent is allowed to use
    pub fn new(agent_name: String, allowed_tools: Vec<String>) -> Self {
        Self {
            agent_name,
            allowed_tools,
            results: Arc::new(RwLock::new(HashMap::new())),
            metadata: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Get the agent name
    pub fn agent_name(&self) -> &str {
        &self.agent_name
    }

    /// Get the list of allowed tools
    pub fn allowed_tools(&self) -> &[String] {
        &self.allowed_tools
    }

    /// Check if a tool is allowed in this context
    pub fn is_tool_allowed(&self, tool_name: &str) -> bool {
        // If no tools are specified, allow all
        if self.allowed_tools.is_empty() {
            return true;
        }

        // Check for exact match or wildcard patterns
        self.allowed_tools.iter().any(|allowed| {
            if allowed == "*" {
                true
            } else if allowed.ends_with('*') {
                // Prefix match (e.g., "Bash*" matches "Bash", "BashGit", etc.)
                let prefix = &allowed[..allowed.len() - 1];
                tool_name.starts_with(prefix)
            } else {
                // Exact match
                allowed == tool_name
            }
        })
    }

    /// Store a result in the context
    ///
    /// # Arguments
    /// * `key` - Result identifier
    /// * `value` - Result value
    pub fn store_result(&self, key: String, value: Value) -> Result<()> {
        let mut results = self.results.write().map_err(|e| {
            anyhow::anyhow!("Failed to acquire write lock on results: {}", e)
        })?;
        results.insert(key, value);
        Ok(())
    }

    /// Get a result from the context
    ///
    /// # Arguments
    /// * `key` - Result identifier
    pub fn get_result(&self, key: &str) -> Result<Option<Value>> {
        let results = self.results.read().map_err(|e| {
            anyhow::anyhow!("Failed to acquire read lock on results: {}", e)
        })?;
        Ok(results.get(key).cloned())
    }

    /// Get all results from the context
    pub fn get_all_results(&self) -> Result<HashMap<String, Value>> {
        let results = self.results.read().map_err(|e| {
            anyhow::anyhow!("Failed to acquire read lock on results: {}", e)
        })?;
        Ok(results.clone())
    }

    /// Set metadata for the agent
    ///
    /// # Arguments
    /// * `key` - Metadata key
    /// * `value` - Metadata value
    pub fn set_metadata(&self, key: String, value: String) -> Result<()> {
        let mut metadata = self.metadata.write().map_err(|e| {
            anyhow::anyhow!("Failed to acquire write lock on metadata: {}", e)
        })?;
        metadata.insert(key, value);
        Ok(())
    }

    /// Get metadata from the agent
    ///
    /// # Arguments
    /// * `key` - Metadata key
    pub fn get_metadata(&self, key: &str) -> Result<Option<String>> {
        let metadata = self.metadata.read().map_err(|e| {
            anyhow::anyhow!("Failed to acquire read lock on metadata: {}", e)
        })?;
        Ok(metadata.get(key).cloned())
    }

    /// Clear all results
    pub fn clear_results(&self) -> Result<()> {
        let mut results = self.results.write().map_err(|e| {
            anyhow::anyhow!("Failed to acquire write lock on results: {}", e)
        })?;
        results.clear();
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_context_creation() {
        let context = AgentContext::new(
            "test-agent".to_string(),
            vec!["Read".to_string(), "Write".to_string()],
        );

        assert_eq!(context.agent_name(), "test-agent");
        assert_eq!(context.allowed_tools().len(), 2);
    }

    #[test]
    fn test_tool_allowed() {
        let context = AgentContext::new(
            "test-agent".to_string(),
            vec!["Read".to_string(), "Bash*".to_string()],
        );

        assert!(context.is_tool_allowed("Read"));
        assert!(context.is_tool_allowed("Bash"));
        assert!(context.is_tool_allowed("BashGit"));
        assert!(!context.is_tool_allowed("Write"));
    }

    #[test]
    fn test_tool_allowed_wildcard() {
        let context = AgentContext::new("test-agent".to_string(), vec!["*".to_string()]);

        assert!(context.is_tool_allowed("Read"));
        assert!(context.is_tool_allowed("Write"));
        assert!(context.is_tool_allowed("Bash"));
    }

    #[test]
    fn test_tool_allowed_empty() {
        let context = AgentContext::new("test-agent".to_string(), vec![]);

        // Empty list allows all tools
        assert!(context.is_tool_allowed("Read"));
        assert!(context.is_tool_allowed("Write"));
    }

    #[test]
    fn test_result_storage() {
        let context = AgentContext::new("test-agent".to_string(), vec![]);

        let value = serde_json::json!({"status": "success"});
        context.store_result("result1".to_string(), value.clone()).unwrap();

        let retrieved = context.get_result("result1").unwrap();
        assert_eq!(retrieved, Some(value));

        let none = context.get_result("nonexistent").unwrap();
        assert_eq!(none, None);
    }

    #[test]
    fn test_metadata() {
        let context = AgentContext::new("test-agent".to_string(), vec![]);

        context
            .set_metadata("key1".to_string(), "value1".to_string())
            .unwrap();

        let retrieved = context.get_metadata("key1").unwrap();
        assert_eq!(retrieved, Some("value1".to_string()));

        let none = context.get_metadata("nonexistent").unwrap();
        assert_eq!(none, None);
    }

    #[test]
    fn test_clear_results() {
        let context = AgentContext::new("test-agent".to_string(), vec![]);

        context
            .store_result("result1".to_string(), serde_json::json!({"a": 1}))
            .unwrap();
        context
            .store_result("result2".to_string(), serde_json::json!({"b": 2}))
            .unwrap();

        let all = context.get_all_results().unwrap();
        assert_eq!(all.len(), 2);

        context.clear_results().unwrap();

        let all = context.get_all_results().unwrap();
        assert_eq!(all.len(), 0);
    }
}
