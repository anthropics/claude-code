//! Multi-agent orchestration for Claude Code
//!
//! This crate provides a comprehensive framework for orchestrating multiple Claude agents
//! that can work together on complex tasks. It supports:
//!
//! - **Agent Management**: Create and configure agents with specific system prompts and tools
//! - **Parallel Execution**: Run multiple agents concurrently using tokio tasks
//! - **Sequential Execution**: Execute agents one after another
//! - **Context Isolation**: Each agent runs in its own isolated context
//! - **Tool Filtering**: Agents only have access to their allowed tools
//! - **Result Aggregation**: Collect and handle results from multiple agents
//!
//! # Architecture
//!
//! The agent orchestration system consists of several key components:
//!
//! ## Agent
//! The `Agent` struct represents a single agent with:
//! - Configuration from an `AgentDefinition` (loaded from markdown plugins)
//! - API client for communicating with Claude
//! - Model selection (Sonnet, Haiku, or Opus)
//! - Execution context for isolation
//! - Tool filtering based on allowed tools
//!
//! ## AgentOrchestrator
//! The `AgentOrchestrator` manages multiple agents and provides:
//! - Spawning agents as tokio tasks
//! - Parallel execution with `spawn_parallel`
//! - Sequential execution with `execute_sequential`
//! - Result collection with error handling
//!
//! ## AgentContext
//! The `AgentContext` provides isolation for each agent:
//! - Separate tool registries
//! - Result storage for passing data between agents
//! - Metadata tracking
//!
//! # Quick Start
//!
//! ## Creating and Running a Single Agent
//!
//! ```rust,no_run
//! use claude_agents::{Agent, AgentOrchestrator};
//! use claude_plugins::AgentDefinition;
//!
//! #[tokio::main]
//! async fn main() -> anyhow::Result<()> {
//!     // Load agent definition (typically from .claude/agents/my-agent.md)
//!     let agent_def = AgentDefinition {
//!         name: "code-reviewer".to_string(),
//!         description: "Reviews code for issues".to_string(),
//!         system_prompt: "You are a code review expert.".to_string(),
//!         tools: vec!["Read".to_string(), "Grep".to_string()],
//!         model: "claude-sonnet-4-5-20250929".to_string(),
//!         color: None,
//!     };
//!
//!     // Create the agent
//!     let agent = Agent::new(agent_def, "your-api-key")?;
//!
//!     // Execute a task
//!     let result = agent.execute("Review the main.rs file").await?;
//!     println!("Result: {}", result);
//!
//!     Ok(())
//! }
//! ```
//!
//! ## Parallel Execution
//!
//! ```rust,no_run
//! use claude_agents::AgentOrchestrator;
//! use claude_plugins::AgentDefinition;
//!
//! #[tokio::main]
//! async fn main() -> anyhow::Result<()> {
//!     let orchestrator = AgentOrchestrator::new("your-api-key");
//!
//!     // Define agents
//!     let agent1 = AgentDefinition {
//!         name: "code-reviewer".to_string(),
//!         description: "Reviews code".to_string(),
//!         system_prompt: "Review code for style issues.".to_string(),
//!         tools: vec!["Read".to_string()],
//!         model: "claude-sonnet-4-5-20250929".to_string(),
//!         color: None,
//!     };
//!
//!     let agent2 = AgentDefinition {
//!         name: "test-checker".to_string(),
//!         description: "Checks tests".to_string(),
//!         system_prompt: "Check if tests are comprehensive.".to_string(),
//!         tools: vec!["Read".to_string(), "Bash".to_string()],
//!         model: "claude-sonnet-4-5-20250929".to_string(),
//!         color: None,
//!     };
//!
//!     // Execute in parallel
//!     let results = orchestrator.execute_parallel(vec![
//!         (agent1, "Review main.rs".to_string()),
//!         (agent2, "Check test coverage".to_string()),
//!     ]).await?;
//!
//!     for (i, result) in results.iter().enumerate() {
//!         println!("Agent {} result: {}", i + 1, result);
//!     }
//!
//!     Ok(())
//! }
//! ```
//!
//! ## Sequential Execution
//!
//! ```rust,no_run
//! use claude_agents::AgentOrchestrator;
//! use claude_plugins::AgentDefinition;
//!
//! #[tokio::main]
//! async fn main() -> anyhow::Result<()> {
//!     let orchestrator = AgentOrchestrator::new("your-api-key");
//!
//!     // Define agents (same as above)
//!     # let agent1 = AgentDefinition {
//!     #     name: "agent1".to_string(),
//!     #     description: "Agent 1".to_string(),
//!     #     system_prompt: "System prompt".to_string(),
//!     #     tools: vec![],
//!     #     model: "claude-sonnet-4-5-20250929".to_string(),
//!     #     color: None,
//!     # };
//!     # let agent2 = AgentDefinition {
//!     #     name: "agent2".to_string(),
//!     #     description: "Agent 2".to_string(),
//!     #     system_prompt: "System prompt".to_string(),
//!     #     tools: vec![],
//!     #     model: "claude-sonnet-4-5-20250929".to_string(),
//!     #     color: None,
//!     # };
//!
//!     // Execute sequentially
//!     let results = orchestrator.execute_sequential(vec![
//!         (agent1, "First task".to_string()),
//!         (agent2, "Second task (using first result)".to_string()),
//!     ]).await?;
//!
//!     Ok(())
//! }
//! ```
//!
//! ## Using AgentHandle for Fine-Grained Control
//!
//! ```rust,no_run
//! use claude_agents::AgentOrchestrator;
//! use claude_plugins::AgentDefinition;
//!
//! #[tokio::main]
//! async fn main() -> anyhow::Result<()> {
//!     let orchestrator = AgentOrchestrator::new("your-api-key");
//!     # let agent_def = AgentDefinition {
//!     #     name: "agent".to_string(),
//!     #     description: "Agent".to_string(),
//!     #     system_prompt: "System prompt".to_string(),
//!     #     tools: vec![],
//!     #     model: "claude-sonnet-4-5-20250929".to_string(),
//!     #     color: None,
//!     # };
//!
//!     // Spawn agents
//!     let handle1 = orchestrator.spawn_agent(agent_def.clone(), "Task 1".to_string());
//!     let handle2 = orchestrator.spawn_agent(agent_def, "Task 2".to_string());
//!
//!     // Do other work while agents run...
//!
//!     // Wait for completion
//!     let result1 = orchestrator.wait_for_completion(handle1).await?;
//!     let result2 = orchestrator.wait_for_completion(handle2).await?;
//!
//!     Ok(())
//! }
//! ```
//!
//! # Error Handling
//!
//! The orchestrator provides two approaches to error handling:
//!
//! 1. **Fail-fast**: Methods like `wait_for_all` and `execute_parallel` return an error
//!    if any agent fails.
//!
//! 2. **Collect all**: Methods like `wait_for_all_results` and `execute_parallel_all_results`
//!    collect both successes and failures, allowing you to handle partial failures.
//!
//! ```rust,no_run
//! use claude_agents::{AgentOrchestrator, AgentResult};
//! # use claude_plugins::AgentDefinition;
//!
//! #[tokio::main]
//! async fn main() {
//!     let orchestrator = AgentOrchestrator::new("your-api-key");
//!     # let agents = vec![];
//!
//!     // Collect all results (including failures)
//!     let results = orchestrator.execute_parallel_all_results(agents).await;
//!
//!     for result in results {
//!         match result.success {
//!             true => println!("Agent {} succeeded: {:?}", result.name, result.data),
//!             false => println!("Agent {} failed: {:?}", result.name, result.error),
//!         }
//!     }
//! }
//! ```
//!
//! # Tool Filtering
//!
//! Agents only have access to tools specified in their definition:
//!
//! ```rust,no_run
//! use claude_agents::Agent;
//! use claude_plugins::AgentDefinition;
//!
//! # fn main() -> anyhow::Result<()> {
//! let agent_def = AgentDefinition {
//!     name: "restricted-agent".to_string(),
//!     description: "Agent with limited tools".to_string(),
//!     system_prompt: "You can only read files.".to_string(),
//!     tools: vec!["Read".to_string()],  // Only Read is allowed
//!     model: "claude-sonnet-4-5-20250929".to_string(),
//!     color: None,
//! };
//!
//! let agent = Agent::new(agent_def, "your-api-key")?;
//!
//! // Check tool access
//! assert!(agent.is_tool_allowed("Read"));
//! assert!(!agent.is_tool_allowed("Write"));
//! assert!(!agent.is_tool_allowed("Bash"));
//! # Ok(())
//! # }
//! ```
//!
//! # Streaming Support
//!
//! Agents support streaming responses for real-time output:
//!
//! ```rust,no_run
//! use claude_agents::Agent;
//! # use claude_plugins::AgentDefinition;
//!
//! #[tokio::main]
//! async fn main() -> anyhow::Result<()> {
//!     # let agent_def = AgentDefinition {
//!     #     name: "agent".to_string(),
//!     #     description: "Agent".to_string(),
//!     #     system_prompt: "System prompt".to_string(),
//!     #     tools: vec![],
//!     #     model: "claude-sonnet-4-5-20250929".to_string(),
//!     #     color: None,
//!     # };
//!     let agent = Agent::new(agent_def, "your-api-key")?;
//!
//!     let result = agent.execute_stream("Write a poem", |chunk| {
//!         print!("{}", chunk);  // Print each chunk as it arrives
//!     }).await?;
//!
//!     println!("\n\nFull result: {}", result);
//!     Ok(())
//! }
//! ```
//!
//! # Safety
//! This crate forbids unsafe code to ensure memory safety and reliability.

#![forbid(unsafe_code)]

pub mod agent;
pub mod context;
pub mod orchestrator;

// Re-export main types for convenience
pub use agent::Agent;
pub use context::AgentContext;
pub use orchestrator::{AgentHandle, AgentOrchestrator, AgentResult};

// Re-export types from dependencies for convenience
pub use claude_plugins::AgentDefinition;

/// Prelude module for convenient imports
pub mod prelude {
    pub use crate::agent::Agent;
    pub use crate::context::AgentContext;
    pub use crate::orchestrator::{AgentHandle, AgentOrchestrator, AgentResult};
    pub use claude_plugins::AgentDefinition;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_exports() {
        // Ensure main types are accessible
        let _: Agent;
        let _: AgentContext;
        let _: AgentOrchestrator;
        let _: AgentHandle;
        let _: AgentResult;
        let _: AgentDefinition;
    }
}
