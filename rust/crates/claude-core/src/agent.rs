//! Agent state and configuration

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::{AgentId, TokenUsage};

/// Agent status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AgentStatus {
    /// Idle, waiting for input
    #[default]
    Idle,
    /// Processing a query
    Processing,
    /// Executing tools
    ExecutingTools,
    /// Waiting for user confirmation
    AwaitingConfirmation,
    /// Error state
    Error,
}

/// Agent configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfig {
    /// Agent name
    pub name: String,
    /// Model to use
    pub model: String,
    /// Max tokens per response
    pub max_tokens: u32,
    /// Temperature
    pub temperature: Option<f32>,
    /// System prompt
    pub system_prompt: Option<String>,
    /// Custom instructions
    pub custom_instructions: Option<String>,
    /// Whether to show token usage
    pub show_usage: bool,
    /// Whether to stream responses
    pub streaming: bool,
    /// Tool timeout in seconds
    pub tool_timeout_secs: u64,
    /// Max tool iterations
    pub max_tool_iterations: u32,
}

impl Default for AgentConfig {
    fn default() -> Self {
        Self {
            name: "Claude".to_string(),
            model: "claude-3-7-sonnet-20250219".to_string(),
            max_tokens: 8192,
            temperature: None,
            system_prompt: None,
            custom_instructions: None,
            show_usage: true,
            streaming: true,
            tool_timeout_secs: 300,
            max_tool_iterations: 50,
        }
    }
}

/// Agent runtime state
#[derive(Debug, Clone, Default)]
pub struct AgentState {
    /// Agent ID
    pub id: AgentId,
    /// Current status
    pub status: AgentStatus,
    /// Current task description
    pub current_task: Option<String>,
    /// Current tool being executed
    pub current_tool: Option<String>,
    /// Accumulated token usage
    pub usage: TokenUsage,
    /// Tool execution count this session
    pub tool_count: u32,
    /// Custom data store
    pub data: HashMap<String, String>,
    /// Start time
    pub start_time: Option<std::time::SystemTime>,
}

impl AgentState {
    /// Create new agent state
    pub fn new() -> Self {
        Self {
            id: AgentId::new(),
            status: AgentStatus::Idle,
            current_task: None,
            current_tool: None,
            usage: TokenUsage::default(),
            tool_count: 0,
            data: HashMap::new(),
            start_time: Some(std::time::SystemTime::now()),
        }
    }
    
    /// Update status
    pub fn set_status(&mut self, status: AgentStatus) {
        self.status = status;
    }
    
    /// Increment tool count
    pub fn increment_tool_count(&mut self) {
        self.tool_count += 1;
    }
    
    /// Accumulate usage
    pub fn accumulate_usage(&mut self, usage: &TokenUsage) {
        self.usage.accumulate(usage);
    }
    
    /// Check if max tools reached
    pub fn is_max_tools_reached(&self, max: u32) -> bool {
        self.tool_count >= max
    }
    
    /// Get runtime duration
    pub fn runtime_duration(&self) -> Option<std::time::Duration> {
        self.start_time.map(|t| t.elapsed().unwrap_or_default())
    }
}

