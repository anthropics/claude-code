//! Application state and lifecycle management

use anyhow::{Context, Result};
use claude_agents::AgentOrchestrator;
use claude_api::{AnthropicClient, ClientConfig};
use claude_config::ClaudeConfig;
use claude_hooks::HookExecutor;
use claude_session::Session;
use claude_tools::ToolRegistry;
use std::sync::Arc;

/// Main application state
pub struct App {
    pub config: ClaudeConfig,
    pub api_client: Arc<AnthropicClient>,
    pub tool_registry: Arc<ToolRegistry>,
    pub session: Session,
    pub hook_executor: Option<HookExecutor>,
    pub orchestrator: AgentOrchestrator,
}

impl App {
    /// Create a new application
    pub async fn new(api_key: String, model: Option<String>) -> Result<Self> {
        // Load config
        let mut config = ClaudeConfig::load().context("Failed to load configuration")?;

        // Override with provided values
        if let Some(model) = model {
            config.model = model;
        }

        // Create API client
        let client_config = ClientConfig::new(api_key);
        let api_client =
            Arc::new(AnthropicClient::new(client_config).context("Failed to create API client")?);

        // Create tool registry and register built-in tools
        let mut tool_registry = ToolRegistry::new();
        claude_tools::register_built_in_tools(&mut tool_registry);
        let tool_registry = Arc::new(tool_registry);

        // Create session
        let session = Session::new();

        // Create orchestrator
        let orchestrator = AgentOrchestrator::new(config.get_api_key().unwrap_or_default());

        Ok(Self {
            config,
            api_client,
            tool_registry,
            session,
            hook_executor: None,
            orchestrator,
        })
    }

    /// Initialize the application
    pub async fn initialize(&mut self) -> Result<()> {
        // Save session
        self.session.save().context("Failed to save session")?;

        tracing::info!(
            "Application initialized with session: {}",
            self.session.id().as_str()
        );
        Ok(())
    }

    /// Get model name
    pub fn model(&self) -> &str {
        &self.config.model
    }

    /// Shutdown the application
    pub async fn shutdown(&mut self) -> Result<()> {
        // Clean up background shells
        self.session.background_shells_mut().cleanup();

        tracing::info!("Application shutdown complete");
        Ok(())
    }
}
