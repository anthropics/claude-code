//! Token usage tracking

use serde::{Deserialize, Serialize};

/// Token usage information
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct TokenUsage {
    /// Input tokens used
    pub input_tokens: u32,
    /// Output tokens used
    pub output_tokens: u32,
    /// Cache creation input tokens
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cache_creation_input_tokens: Option<u32>,
    /// Cache read input tokens
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cache_read_input_tokens: Option<u32>,
    /// Total tokens (input + output)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_tokens: Option<u32>,
}

impl TokenUsage {
    /// Create new usage
    pub fn new(input: u32, output: u32) -> Self {
        Self {
            input_tokens: input,
            output_tokens: output,
            cache_creation_input_tokens: None,
            cache_read_input_tokens: None,
            total_tokens: Some(input + output),
        }
    }
    
    /// Accumulate usage from another
    pub fn accumulate(&mut self, other: &TokenUsage) {
        self.input_tokens += other.input_tokens;
        self.output_tokens += other.output_tokens;
        
        if let Some(cached) = other.cache_creation_input_tokens {
            self.cache_creation_input_tokens = Some(
                self.cache_creation_input_tokens.unwrap_or(0) + cached
            );
        }
        if let Some(cached) = other.cache_read_input_tokens {
            self.cache_read_input_tokens = Some(
                self.cache_read_input_tokens.unwrap_or(0) + cached
            );
        }
        
        self.total_tokens = Some(self.input_tokens + self.output_tokens);
    }
    
    /// Get total tokens
    pub fn total(&self) -> u32 {
        self.total_tokens.unwrap_or(self.input_tokens + self.output_tokens)
    }
    
    /// Estimate cost (rough approximation for Claude 3.7 Sonnet)
    pub fn estimate_cost_usd(&self) -> f64 {
        let input_cost = self.input_tokens as f64 * 0.000003;  // $3 per million
        let output_cost = self.output_tokens as f64 * 0.000015; // $15 per million
        input_cost + output_cost
    }
}

/// Usage tracker for a session
#[derive(Debug, Clone, Default)]
pub struct UsageTracker {
    /// Total usage
    pub total: TokenUsage,
    /// Usage by message
    pub by_message: Vec<(String, TokenUsage)>,
    /// Usage by tool
    pub by_tool: Vec<(String, TokenUsage)>,
}

impl UsageTracker {
    /// Create new tracker
    pub fn new() -> Self {
        Self::default()
    }
    
    /// Record usage for a message
    pub fn record_message(&mut self, message_id: String, usage: TokenUsage) {
        self.total.accumulate(&usage);
        self.by_message.push((message_id, usage));
    }
    
    /// Record usage for a tool
    pub fn record_tool(&mut self, tool_name: String, usage: TokenUsage) {
        self.total.accumulate(&usage);
        self.by_tool.push((tool_name, usage));
    }
    
    /// Get total cost
    pub fn total_cost_usd(&self) -> f64 {
        self.total.estimate_cost_usd()
    }
}

/// Model information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    /// Model ID
    pub id: String,
    /// Model name
    pub name: String,
    /// Context window size
    pub context_window: u32,
    /// Max output tokens
    pub max_output_tokens: u32,
    /// Whether vision is supported
    pub supports_vision: bool,
    /// Whether tool use is supported
    pub supports_tools: bool,
    /// Whether batching is supported
    pub supports_batch: bool,
    /// Input cost per 1M tokens
    pub input_cost_per_1m: f64,
    /// Output cost per 1M tokens
    pub output_cost_per_1m: f64,
}

impl ModelInfo {
    /// Claude 3.7 Sonnet
    pub fn claude_3_7_sonnet() -> Self {
        Self {
            id: "claude-3-7-sonnet-20250219".to_string(),
            name: "Claude 3.7 Sonnet".to_string(),
            context_window: 200_000,
            max_output_tokens: 8192,
            supports_vision: true,
            supports_tools: true,
            supports_batch: true,
            input_cost_per_1m: 3.0,
            output_cost_per_1m: 15.0,
        }
    }
    
    /// Claude 3.7 Sonnet with extended thinking
    pub fn claude_3_7_sonnet_extended() -> Self {
        Self {
            id: "claude-3-7-sonnet-20250219".to_string(),
            name: "Claude 3.7 Sonnet (Extended)".to_string(),
            context_window: 200_000,
            max_output_tokens: 64_000,
            supports_vision: true,
            supports_tools: true,
            supports_batch: true,
            input_cost_per_1m: 3.0,
            output_cost_per_1m: 15.0,
        }
    }
}

