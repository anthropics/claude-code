//! Agent implementation for executing tasks with Claude
//!
//! This module provides the Agent struct that represents a single agent
//! with its own configuration, tools, and execution context.

use anyhow::{Context as _, Result};
use claude_api::{AnthropicClient, ClientConfig, MessageRequestBuilder, Model};
use claude_plugins::AgentDefinition;
use futures::StreamExt;
use std::sync::{Arc, RwLock};

use crate::context::AgentContext;

/// Agent for executing tasks with Claude
///
/// Each agent has:
/// - A definition (from a plugin)
/// - An API client for communication with Claude
/// - A list of allowed tools
/// - A model to use
/// - An execution context for isolation
pub struct Agent {
    /// Agent definition from plugin
    definition: AgentDefinition,

    /// API client for Claude
    client: Arc<AnthropicClient>,

    /// Model to use for this agent
    model: Model,

    /// Execution context
    context: Arc<RwLock<AgentContext>>,
}

impl Agent {
    /// Create a new agent
    ///
    /// # Arguments
    /// * `definition` - Agent definition from plugin
    /// * `api_key` - Anthropic API key
    pub fn new(definition: AgentDefinition, api_key: impl Into<String>) -> Result<Self> {
        let model = Self::parse_model(&definition.model);

        let config = ClientConfig::new(api_key);
        let client = AnthropicClient::new(config)
            .context("Failed to create Anthropic client")?;

        let context = AgentContext::new(definition.name.clone(), definition.tools.clone());

        Ok(Self {
            definition,
            client: Arc::new(client),
            model,
            context: Arc::new(RwLock::new(context)),
        })
    }

    /// Create a new agent with a custom client config
    ///
    /// # Arguments
    /// * `definition` - Agent definition from plugin
    /// * `config` - Custom client configuration
    pub fn with_config(definition: AgentDefinition, config: ClientConfig) -> Result<Self> {
        let model = Self::parse_model(&definition.model);

        let client = Arc::new(AnthropicClient::new(config)
            .context("Failed to create Anthropic client")?);

        let context = AgentContext::new(definition.name.clone(), definition.tools.clone());

        Ok(Self {
            definition,
            client,
            model,
            context: Arc::new(RwLock::new(context)),
        })
    }

    /// Parse model string to Model enum
    fn parse_model(model_str: &str) -> Model {
        match model_str {
            "claude-sonnet-4-5-20250929" => Model::Sonnet,
            "claude-3-5-haiku-20241022" => Model::Haiku,
            "claude-opus-4-20250514" => Model::Opus,
            _ => Model::Sonnet, // Default to Sonnet
        }
    }

    /// Get the agent name
    pub fn name(&self) -> &str {
        &self.definition.name
    }

    /// Get the agent description
    pub fn description(&self) -> &str {
        &self.definition.description
    }

    /// Get the system prompt
    pub fn system_prompt(&self) -> &str {
        &self.definition.system_prompt
    }

    /// Get the allowed tools
    pub fn allowed_tools(&self) -> &[String] {
        &self.definition.tools
    }

    /// Get the execution context (cloned Arc for thread-safety)
    pub fn context(&self) -> Arc<RwLock<AgentContext>> {
        Arc::clone(&self.context)
    }

    /// Execute a task with the agent (non-streaming)
    ///
    /// # Arguments
    /// * `prompt` - The task prompt for the agent
    ///
    /// # Returns
    /// The response text from Claude
    pub async fn execute(&self, prompt: impl Into<String>) -> Result<String> {
        let prompt = prompt.into();

        // Build the request with system prompt
        let request = MessageRequestBuilder::new(self.model.clone())
            .system(&self.definition.system_prompt)
            .user(prompt)
            .max_tokens(4096)
            .build();

        // Execute the request
        let response = self
            .client
            .create_message(request)
            .await
            .context("Failed to create message")?;

        // Extract text from response
        let text = response
            .content
            .iter()
            .filter_map(|block| match block {
                claude_api::ContentBlock::Text { text } => Some(text.as_str()),
                _ => None,
            })
            .collect::<Vec<_>>()
            .join("\n");

        Ok(text)
    }

    /// Execute a task with the agent (streaming)
    ///
    /// # Arguments
    /// * `prompt` - The task prompt for the agent
    /// * `on_chunk` - Callback function for each text chunk
    ///
    /// # Returns
    /// The complete response text from Claude
    pub async fn execute_stream<F>(
        &self,
        prompt: impl Into<String>,
        mut on_chunk: F,
    ) -> Result<String>
    where
        F: FnMut(&str),
    {
        let prompt = prompt.into();

        // Build the request with system prompt
        let request = MessageRequestBuilder::new(self.model.clone())
            .system(&self.definition.system_prompt)
            .user(prompt)
            .max_tokens(4096)
            .build();

        // Execute the streaming request
        let mut stream = self
            .client
            .create_message_stream(request)
            .await
            .context("Failed to create message stream")?;

        let mut full_text = String::new();

        // Process stream events
        while let Some(item) = stream.next().await {
            let item = item.context("Stream error")?;

            match item {
                claude_api::MessageStreamItem::TextDelta { text, .. } => {
                    on_chunk(&text);
                    full_text.push_str(&text);
                }
                claude_api::MessageStreamItem::MessageStart { .. } => {}
                claude_api::MessageStreamItem::ContentBlockStart { .. } => {}
                claude_api::MessageStreamItem::InputJsonDelta { .. } => {}
                claude_api::MessageStreamItem::ContentBlockStop { .. } => {}
                claude_api::MessageStreamItem::MessageDelta { .. } => {}
                claude_api::MessageStreamItem::MessageStop { .. } => {}
                claude_api::MessageStreamItem::Error(_) => {}
            }
        }

        Ok(full_text)
    }

    /// Check if a tool is allowed for this agent
    pub fn is_tool_allowed(&self, tool_name: &str) -> bool {
        self.context.read().unwrap().is_tool_allowed(tool_name)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use claude_plugins::AgentDefinition;

    fn create_test_agent_definition() -> AgentDefinition {
        AgentDefinition {
            name: "test-agent".to_string(),
            description: "Test agent".to_string(),
            system_prompt: "You are a test agent.".to_string(),
            tools: vec!["Read".to_string(), "Write".to_string()],
            model: "claude-sonnet-4-5-20250929".to_string(),
            color: None,
        }
    }

    #[test]
    fn test_agent_creation() {
        let definition = create_test_agent_definition();
        let agent = Agent::new(definition, "test-api-key").unwrap();

        assert_eq!(agent.name(), "test-agent");
        assert_eq!(agent.description(), "Test agent");
        assert_eq!(agent.allowed_tools().len(), 2);
    }

    #[test]
    fn test_model_parsing() {
        assert_eq!(
            Agent::parse_model("claude-sonnet-4-5-20250929").as_str(),
            "claude-sonnet-4-5-20250929"
        );
        assert_eq!(
            Agent::parse_model("claude-3-5-haiku-20241022").as_str(),
            "claude-3-5-haiku-20241022"
        );
        assert_eq!(
            Agent::parse_model("claude-opus-4-20250514").as_str(),
            "claude-opus-4-20250514"
        );
        // Unknown model defaults to Sonnet
        assert_eq!(
            Agent::parse_model("unknown-model").as_str(),
            "claude-sonnet-4-5-20250929"
        );
    }

    #[test]
    fn test_tool_filtering() {
        let definition = create_test_agent_definition();
        let agent = Agent::new(definition, "test-api-key").unwrap();

        assert!(agent.is_tool_allowed("Read"));
        assert!(agent.is_tool_allowed("Write"));
        assert!(!agent.is_tool_allowed("Bash"));
    }

    #[test]
    fn test_context_access() {
        let definition = create_test_agent_definition();
        let agent = Agent::new(definition, "test-api-key").unwrap();

        let context = agent.context();
        let ctx = context.read().unwrap();
        assert_eq!(ctx.agent_name(), "test-agent");
        assert_eq!(ctx.allowed_tools().len(), 2);
    }
}
