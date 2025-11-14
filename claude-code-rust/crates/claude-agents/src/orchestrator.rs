//! Agent orchestration for parallel and sequential execution
//!
//! This module provides the AgentOrchestrator for managing multiple agents
//! and coordinating their execution, both in parallel and sequentially.

use anyhow::{Context as _, Result};
use claude_api::ClientConfig;
use claude_plugins::AgentDefinition;
use std::sync::Arc;
use tokio::task::JoinHandle;

use crate::agent::Agent;

/// Handle to a spawned agent task
///
/// This handle can be used to wait for the agent's completion and retrieve
/// the result. It wraps a tokio JoinHandle with the agent's name for better
/// error reporting.
#[derive(Debug)]
pub struct AgentHandle {
    /// Name of the agent
    name: String,

    /// Tokio join handle for the task
    handle: JoinHandle<Result<String>>,
}

impl AgentHandle {
    /// Create a new agent handle
    fn new(name: String, handle: JoinHandle<Result<String>>) -> Self {
        Self { name, handle }
    }

    /// Get the agent name
    pub fn name(&self) -> &str {
        &self.name
    }

    /// Wait for the agent to complete and get the result
    pub async fn wait(self) -> Result<String> {
        let name = self.name.clone();
        self.handle
            .await
            .context(format!("Agent '{}' task panicked", name))?
            .context(format!("Agent '{}' execution failed", name))
    }
}

/// Result from a completed agent execution
#[derive(Debug, Clone)]
pub struct AgentResult {
    /// Name of the agent
    pub name: String,

    /// Whether the execution was successful
    pub success: bool,

    /// Result data (if successful)
    pub data: Option<String>,

    /// Error message (if failed)
    pub error: Option<String>,
}

impl AgentResult {
    /// Create a successful result
    pub fn success(name: String, data: String) -> Self {
        Self {
            name,
            success: true,
            data: Some(data),
            error: None,
        }
    }

    /// Create a failed result
    pub fn failure(name: String, error: String) -> Self {
        Self {
            name,
            success: false,
            data: None,
            error: Some(error),
        }
    }
}

/// Orchestrator for managing multiple agents
///
/// The orchestrator handles:
/// - Spawning agents in parallel or sequentially
/// - Waiting for completion
/// - Error aggregation and handling
/// - Result collection
pub struct AgentOrchestrator {
    /// Client configuration for creating agents
    config: Arc<ClientConfig>,
}

impl AgentOrchestrator {
    /// Create a new orchestrator
    ///
    /// # Arguments
    /// * `api_key` - Anthropic API key
    pub fn new(api_key: impl Into<String>) -> Self {
        let config = ClientConfig::new(api_key);
        Self {
            config: Arc::new(config),
        }
    }

    /// Create a new orchestrator with custom config
    ///
    /// # Arguments
    /// * `config` - Custom client configuration
    pub fn with_config(config: ClientConfig) -> Self {
        Self {
            config: Arc::new(config),
        }
    }

    /// Spawn a single agent
    ///
    /// # Arguments
    /// * `agent_def` - Agent definition
    /// * `prompt` - Task prompt for the agent
    ///
    /// # Returns
    /// Handle to the spawned agent task
    pub fn spawn_agent(
        &self,
        agent_def: AgentDefinition,
        prompt: String,
    ) -> AgentHandle {
        let config = Arc::clone(&self.config);
        let name = agent_def.name.clone();

        let handle = tokio::spawn(async move {
            let agent = Agent::with_config(agent_def, (*config).clone())?;
            agent.execute(prompt).await
        });

        AgentHandle::new(name, handle)
    }

    /// Spawn multiple agents in parallel
    ///
    /// # Arguments
    /// * `agents` - Vector of (agent_definition, prompt) tuples
    ///
    /// # Returns
    /// Vector of handles to spawned agent tasks
    pub fn spawn_parallel(
        &self,
        agents: Vec<(AgentDefinition, String)>,
    ) -> Vec<AgentHandle> {
        agents
            .into_iter()
            .map(|(agent_def, prompt)| self.spawn_agent(agent_def, prompt))
            .collect()
    }

    /// Wait for a single agent to complete
    ///
    /// # Arguments
    /// * `handle` - Agent handle
    ///
    /// # Returns
    /// Result from the agent execution
    pub async fn wait_for_completion(&self, handle: AgentHandle) -> Result<String> {
        handle.wait().await
    }

    /// Wait for all agents to complete
    ///
    /// # Arguments
    /// * `handles` - Vector of agent handles
    ///
    /// # Returns
    /// Vector of results from all agents
    ///
    /// # Errors
    /// Returns an error if any agent fails
    pub async fn wait_for_all(&self, handles: Vec<AgentHandle>) -> Result<Vec<String>> {
        let mut results = Vec::new();

        for handle in handles {
            let result = handle.wait().await?;
            results.push(result);
        }

        Ok(results)
    }

    /// Wait for all agents to complete, collecting both successes and failures
    ///
    /// # Arguments
    /// * `handles` - Vector of agent handles
    ///
    /// # Returns
    /// Vector of AgentResult containing both successful and failed executions
    pub async fn wait_for_all_results(&self, handles: Vec<AgentHandle>) -> Vec<AgentResult> {
        let mut results = Vec::new();

        for handle in handles {
            let name = handle.name().to_string();
            match handle.wait().await {
                Ok(data) => {
                    results.push(AgentResult::success(name, data));
                }
                Err(e) => {
                    results.push(AgentResult::failure(name, e.to_string()));
                }
            }
        }

        results
    }

    /// Execute agents in parallel and wait for all to complete
    ///
    /// This is a convenience method that combines spawn_parallel and wait_for_all.
    ///
    /// # Arguments
    /// * `agents` - Vector of (agent_definition, prompt) tuples
    ///
    /// # Returns
    /// Vector of results from all agents
    pub async fn execute_parallel(
        &self,
        agents: Vec<(AgentDefinition, String)>,
    ) -> Result<Vec<String>> {
        let handles = self.spawn_parallel(agents);
        self.wait_for_all(handles).await
    }

    /// Execute agents in parallel and collect all results (including failures)
    ///
    /// # Arguments
    /// * `agents` - Vector of (agent_definition, prompt) tuples
    ///
    /// # Returns
    /// Vector of AgentResult containing both successful and failed executions
    pub async fn execute_parallel_all_results(
        &self,
        agents: Vec<(AgentDefinition, String)>,
    ) -> Vec<AgentResult> {
        let handles = self.spawn_parallel(agents);
        self.wait_for_all_results(handles).await
    }

    /// Execute agents sequentially
    ///
    /// # Arguments
    /// * `agents` - Vector of (agent_definition, prompt) tuples
    ///
    /// # Returns
    /// Vector of results from all agents
    pub async fn execute_sequential(
        &self,
        agents: Vec<(AgentDefinition, String)>,
    ) -> Result<Vec<String>> {
        let mut results = Vec::new();

        for (agent_def, prompt) in agents {
            let agent = Agent::with_config(agent_def, (*self.config).clone())?;
            let result = agent.execute(prompt).await?;
            results.push(result);
        }

        Ok(results)
    }

    /// Execute agents sequentially and collect all results (including failures)
    ///
    /// # Arguments
    /// * `agents` - Vector of (agent_definition, prompt) tuples
    ///
    /// # Returns
    /// Vector of AgentResult containing both successful and failed executions
    pub async fn execute_sequential_all_results(
        &self,
        agents: Vec<(AgentDefinition, String)>,
    ) -> Vec<AgentResult> {
        let mut results = Vec::new();

        for (agent_def, prompt) in agents {
            let name = agent_def.name.clone();
            match Agent::with_config(agent_def, (*self.config).clone()) {
                Ok(agent) => match agent.execute(prompt).await {
                    Ok(data) => {
                        results.push(AgentResult::success(name, data));
                    }
                    Err(e) => {
                        results.push(AgentResult::failure(name, e.to_string()));
                    }
                },
                Err(e) => {
                    results.push(AgentResult::failure(name, e.to_string()));
                }
            }
        }

        results
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use claude_plugins::AgentDefinition;

    fn create_test_agent_definition(name: &str) -> AgentDefinition {
        AgentDefinition {
            name: name.to_string(),
            description: format!("Test agent {}", name),
            system_prompt: "You are a test agent.".to_string(),
            tools: vec![],
            model: "claude-sonnet-4-5-20250929".to_string(),
            color: None,
        }
    }

    #[test]
    fn test_orchestrator_creation() {
        let orchestrator = AgentOrchestrator::new("test-api-key");
        // Just verify it was created successfully
        assert!(true);
    }

    #[test]
    fn test_agent_result_success() {
        let result = AgentResult::success("agent1".to_string(), "output".to_string());
        assert!(result.success);
        assert_eq!(result.name, "agent1");
        assert_eq!(result.data, Some("output".to_string()));
        assert_eq!(result.error, None);
    }

    #[test]
    fn test_agent_result_failure() {
        let result = AgentResult::failure("agent1".to_string(), "error message".to_string());
        assert!(!result.success);
        assert_eq!(result.name, "agent1");
        assert_eq!(result.data, None);
        assert_eq!(result.error, Some("error message".to_string()));
    }

    #[tokio::test]
    async fn test_spawn_agent() {
        let orchestrator = AgentOrchestrator::new("test-api-key");
        let agent_def = create_test_agent_definition("agent1");

        let handle = orchestrator.spawn_agent(agent_def, "test prompt".to_string());
        assert_eq!(handle.name(), "agent1");
    }

    #[tokio::test]
    async fn test_spawn_parallel() {
        let orchestrator = AgentOrchestrator::new("test-api-key");

        let agents = vec![
            (
                create_test_agent_definition("agent1"),
                "prompt1".to_string(),
            ),
            (
                create_test_agent_definition("agent2"),
                "prompt2".to_string(),
            ),
        ];

        let handles = orchestrator.spawn_parallel(agents);
        assert_eq!(handles.len(), 2);
        assert_eq!(handles[0].name(), "agent1");
        assert_eq!(handles[1].name(), "agent2");
    }
}
