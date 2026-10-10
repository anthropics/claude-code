//! Tool orchestrator for parallel and sequential tool execution

use std::collections::HashMap;

use claude_core::{ClaudeResult, Tool, ToolCall, ToolContext, ToolInput, ToolOutput, ToolProgress, ToolResult, ToolUseId};
use tokio::task::JoinSet;
use tracing::{debug, error, info, warn};

/// Tool orchestration strategy
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OrchestrationStrategy {
    /// Execute tools sequentially
    Sequential,
    /// Execute independent tools in parallel
    Parallel,
    /// Smart scheduling based on dependencies
    Smart,
}

/// Tool orchestrator for managing tool execution
pub struct ToolOrchestrator {
    /// Strategy
    strategy: OrchestrationStrategy,
    /// Running tool limit
    max_concurrent: usize,
    /// Tool timeout
    timeout_secs: u64,
    /// Active tool executions
    active: HashMap<ToolUseId, ToolExecution>,
}

/// Tool execution state
#[derive(Debug)]
struct ToolExecution {
    /// Tool name
    name: String,
    /// Tool input
    input: serde_json::Value,
    /// Progress updates
    progress: Vec<ToolProgress>,
    /// Result
    result: Option<ToolResult>,
    /// Start time
    start_time: std::time::Instant,
}

impl ToolOrchestrator {
    /// Create new orchestrator
    pub fn new(strategy: OrchestrationStrategy) -> Self {
        Self {
            strategy,
            max_concurrent: 10,
            timeout_secs: 300,
            active: HashMap::new(),
        }
    }
    
    /// Execute a batch of tool calls
    pub async fn execute_batch(
        &mut self,
        calls: Vec<ToolCall>,
        tools: &dyn ToolRegistry,
        context: &ToolContext,
    ) -> Vec<ToolResult> {
        match self.strategy {
            OrchestrationStrategy::Sequential => {
                self.execute_sequential(calls, tools, context).await
            }
            OrchestrationStrategy::Parallel => {
                self.execute_parallel(calls, tools, context).await
            }
            OrchestrationStrategy::Smart => {
                self.execute_smart(calls, tools, context).await
            }
        }
    }
    
    /// Execute tools sequentially
    async fn execute_sequential(
        &mut self,
        calls: Vec<ToolCall>,
        tools: &dyn ToolRegistry,
        context: &ToolContext,
    ) -> Vec<ToolResult> {
        let mut results = Vec::new();
        
        for call in calls {
            let result = self.execute_single(&call, tools, context).await;
            results.push(result);
        }
        
        results
    }
    
    /// Execute tools in parallel
    async fn execute_parallel(
        &mut self,
        calls: Vec<ToolCall>,
        tools: &dyn ToolRegistry,
        context: &ToolContext,
    ) -> Vec<ToolResult> {
        let mut results: HashMap<ToolUseId, ToolResult> = HashMap::new();
        let mut set = JoinSet::new();
        
        // Spawn all tasks
        for call in calls {
            let tool = tools.get_tool(&call.name).cloned();
            let ctx = context.clone();
            let input = ToolInput::new(&call.name, call.input.clone());
            let id = call.id.clone();
            
            set.spawn(async move {
                let result = if let Some(tool) = tool {
                    match tool.execute(input, ctx).await {
                        Ok(output) => ToolResult {
                            tool_use_id: id.clone(),
                            output: claude_core::ToolResultContent::Text(output.content.clone()),
                            error: if output.is_error { Some(output.content) } else { None },
                            duration_ms: 0,
                        },
                        Err(e) => ToolResult::error(id, e.to_string()),
                    }
                } else {
                    ToolResult::error(id, format!("Tool '{}' not found", call.name))
                };
                (call.id, result)
            });
        }
        
        // Collect results
        while let Some(Ok((id, result))) = set.join_next().await {
            results.insert(id, result);
        }
        
        // Return in original order
        calls.into_iter()
            .filter_map(|call| results.remove(&call.id))
            .collect()
    }
    
    /// Execute tools with smart scheduling
    async fn execute_smart(
        &mut self,
        calls: Vec<ToolCall>,
        tools: &dyn ToolRegistry,
        context: &ToolContext,
    ) -> Vec<ToolResult> {
        // For now, just use parallel execution
        // A smart implementation would analyze dependencies and schedule accordingly
        self.execute_parallel(calls, tools, context).await
    }
    
    /// Execute a single tool
    async fn execute_single(
        &mut self,
        call: &ToolCall,
        tools: &dyn ToolRegistry,
        context: &ToolContext,
    ) -> ToolResult {
        let id = call.id.clone();
        
        if let Some(tool) = tools.get_tool(&call.name) {
            let input = ToolInput::new(&call.name, call.input.clone());
            let start = std::time::Instant::now();
            
            // Check permission
            let perm_result = tool.check_permission(&input, context);
            
            match perm_result {
                claude_core::PermissionResult::Allowed => {
                    match tool.execute(input, context.clone()).await {
                        Ok(output) => {
                            let duration = start.elapsed();
                            ToolResult {
                                tool_use_id: id,
                                output: claude_core::ToolResultContent::Text(output.content.clone()),
                                error: if output.is_error { Some(output.content) } else { None },
                                duration_ms: duration.as_millis() as u64,
                            }
                        }
                        Err(e) => {
                            ToolResult::error(id, e.to_string())
                        }
                    }
                }
                claude_core::PermissionResult::NeedsConfirmation { action } => {
                    ToolResult::error(id, format!("Permission needed: {}", action))
                }
                claude_core::PermissionResult::Denied { reason } => {
                    ToolResult::error(id, format!("Permission denied: {}", reason))
                }
                _ => {
                    ToolResult::error(id, "Unexpected permission result".to_string())
                }
            }
        } else {
            ToolResult::error(id, format!("Tool '{}' not found", call.name))
        }
    }
    
    /// Report progress for a tool
    pub fn report_progress(&mut self, id: &ToolUseId, progress: ToolProgress) {
        if let Some(exec) = self.active.get_mut(id) {
            exec.progress.push(progress);
        }
    }
    
    /// Cancel a running tool
    pub fn cancel(&mut self, id: &ToolUseId) -> bool {
        self.active.remove(id).is_some()
    }
    
    /// Cancel all tools
    pub fn cancel_all(&mut self) {
        self.active.clear();
    }
    
    /// Get active tool count
    pub fn active_count(&self) -> usize {
        self.active.len()
    }
}

/// Tool registry trait for dependency injection
pub trait ToolRegistry: Send + Sync {
    /// Get a tool by name
    fn get_tool(&self, name: &str) -> Option<Box<dyn Tool>>;
    
    /// Get all tool names
    fn tool_names(&self) -> Vec<String>;
    
    /// Check if tool exists
    fn has_tool(&self, name: &str) -> bool;
}

