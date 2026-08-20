//! Complete Query Engine with full tool orchestration loop

use async_trait::async_trait;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use tracing::{debug, error, info, instrument, trace, warn};

use claude_api::{AnthropicClient, StreamEvent};
use claude_core::{
    AgentConfig, AgentState, ClaudeError, ClaudeResult, ContentBlock, Message, MessageRole,
    PermissionContext, PermissionMode, Session, Tool, ToolCall, ToolContext, ToolInput, ToolOutput,
    ToolResult, Tools, TokenUsage, ToolUseId,
};

mod events;
mod state;
mod streaming;
mod tool_orchestrator;

pub use events::{EngineEvent, EventHandler};
pub use state::AppState;
pub use streaming::StreamingHandler;
pub use tool_orchestrator::ToolOrchestrator;

/// Query engine - main orchestration logic
pub struct QueryEngine {
    /// API client
    client: AnthropicClient,
    /// Agent configuration
    config: AgentConfig,
    /// Agent state
    state: Arc<RwLock<AgentState>>,
    /// Tool registry
    tools: Arc<RwLock<Tools>>,
    /// Application state
    app_state: Arc<RwLock<AppState>>,
    /// Permission context
    permissions: Arc<RwLock<PermissionContext>>,
    /// Event sender
    event_tx: Option<mpsc::UnboundedSender<EngineEvent>>,
}

impl QueryEngine {
    /// Create new query engine
    pub fn new(
        client: AnthropicClient,
        config: AgentConfig,
        app_state: Arc<RwLock<AppState>>,
    ) -> Self {
        Self {
            client,
            config,
            state: Arc::new(RwLock::new(AgentState::new())),
            tools: Arc::new(RwLock::new(Tools::new())),
            app_state,
            permissions: Arc::new(RwLock::new(PermissionContext::default())),
            event_tx: None,
        }
    }
    
    /// Set permission mode
    pub async fn set_permission_mode(&self, mode: PermissionMode) {
        let mut perms = self.permissions.write().await;
        perms.mode = mode;
    }
    
    /// Register a tool
    pub async fn register_tool<T: Tool + 'static>(&self, tool: T) {
        let mut tools = self.tools.write().await;
        tools.register(tool);
    }
    
    /// Register multiple tools
    pub async fn register_tools(&self, tools: Vec<Box<dyn Tool>>) {
        let mut registry = self.tools.write().await;
        for tool in tools {
            // We need to downcast to concrete type - this is a limitation
            // In practice, we'll register each tool individually
        }
    }
    
    /// Set event handler
    pub fn set_event_handler(&mut self, tx: mpsc::UnboundedSender<EngineEvent>) {
        self.event_tx = Some(tx);
    }
    
    /// Send event
    async fn send_event(&self, event: EngineEvent) {
        if let Some(ref tx) = self.event_tx {
            let _ = tx.send(event);
        }
    }
    
    /// Process a user query - MAIN LOOP
    #[instrument(skip(self, query))]
    pub async fn process_query(&self, query: &str) -> ClaudeResult<Message> {
        info!("Processing query: {}", query);
        
        // Update state
        {
            let mut state = self.state.write().await;
            state.set_status(claude_core::AgentStatus::Processing);
            state.current_task = Some(query.to_string());
        }
        
        self.send_event(EngineEvent::QueryStarted { 
            query: query.to_string() 
        }).await;
        
        // Get current session
        let session = {
            let app = self.app_state.read().await;
            app.current_session.clone()
        };
        
        // Add user message to conversation
        let user_msg = Message::user(query);
        {
            let mut app = self.app_state.write().await;
            if let Some(ref mut s) = app.current_session {
                s.add_message(user_msg.clone());
            }
        }
        
        self.send_event(EngineEvent::MessageAdded { 
            message: user_msg.clone() 
        }).await;
        
        // MAIN TOOL LOOP
        let mut iteration = 0;
        let max_iterations = self.config.max_tool_iterations;
        let mut final_response: Option<Message> = None;
        
        loop {
            if iteration >= max_iterations {
                warn!("Max tool iterations ({}) reached", max_iterations);
                return Err(ClaudeError::MaxIterations { max: max_iterations });
            }
            iteration += 1;
            
            trace!("Tool loop iteration {}", iteration);
            
            // Build messages for API
            let messages = self.build_api_messages().await?;
            
            // Get tool definitions
            let tool_defs = {
                let tools = self.tools.read().await;
                tools.definitions().into_iter().cloned().collect()
            };
            
            // Call API with streaming
            let stream = self.client.create_message_stream(
                &self.config.model,
                messages,
                Some(&tool_defs),
                self.config.max_tokens,
                self.config.temperature,
            ).await?;
            
            // Process the streaming response
            let stream_result = self.process_stream(stream).await?;
            
            match stream_result {
                StreamResult::Complete { message, tool_calls } => {
                    // Add assistant message to conversation
                    {
                        let mut app = self.app_state.write().await;
                        if let Some(ref mut s) = app.current_session {
                            s.add_message(message.clone());
                        }
                    }
                    
                    self.send_event(EngineEvent::MessageAdded { 
                        message: message.clone() 
                    }).await;
                    
                    // Check if we need to execute tools
                    if tool_calls.is_empty() {
                        // No tools - we're done!
                        final_response = Some(message);
                        break;
                    }
                    
                    // Execute tools
                    let results = self.execute_tool_calls(&tool_calls).await?;
                    
                    // Add tool results as user message
                    let tool_result_msg = Message {
                        id: Some(claude_core::MessageId::new()),
                        role: MessageRole::User,
                        content: results.iter().map(|r| {
                            ContentBlock::ToolResult {
                                tool_use_id: r.tool_use_id.clone(),
                                content: r.output.clone().into(),
                                is_error: r.error.as_ref().map(|_| true),
                            }
                        }).collect(),
                        usage: None,
                        timestamp: Some(chrono::Utc::now()),
                    };
                    
                    {
                        let mut app = self.app_state.write().await;
                        if let Some(ref mut s) = app.current_session {
                            s.add_message(tool_result_msg.clone());
                        }
                    }
                    
                    self.send_event(EngineEvent::MessageAdded { 
                        message: tool_result_msg 
                    }).await;
                    
                    // Update tool count
                    {
                        let mut state = self.state.write().await;
                        state.increment_tool_count();
                    }
                }
                
                StreamResult::Error { error } => {
                    return Err(error);
                }
            }
        }
        
        // Update final state
        {
            let mut state = self.state.write().await;
            state.set_status(claude_core::AgentStatus::Idle);
            state.current_task = None;
            state.current_tool = None;
        }
        
        self.send_event(EngineEvent::QueryComplete).await;
        
        final_response.ok_or_else(|| ClaudeError::internal("No response generated"))
    }
    
    /// Build messages for API call
    async fn build_api_messages(&self) -> ClaudeResult<Vec<claude_api::ApiMessage>> {
        let app = self.app_state.read().await;
        
        if let Some(ref session) = app.current_session {
            let api_messages: Vec<claude_api::ApiMessage> = session
                .conversation
                .messages
                .iter()
                .map(|m| claude_api::ApiMessage {
                    role: match m.role {
                        MessageRole::User => "user".to_string(),
                        MessageRole::Assistant => "assistant".to_string(),
                        MessageRole::System => "system".to_string(),
                    },
                    content: m.content.iter().map(|block| match block {
                        ContentBlock::Text { text } => {
                            serde_json::json!({"type": "text", "text": text})
                        }
                        ContentBlock::ToolUse { id, name, input } => {
                            serde_json::json!({
                                "type": "tool_use",
                                "id": id.0,
                                "name": name,
                                "input": input
                            })
                        }
                        ContentBlock::ToolResult { tool_use_id, content, is_error } => {
                            let content_text = match content {
                                crate::ToolResultContent::Text(t) => t.clone(),
                                crate::ToolResultContent::Blocks(_) => "[complex content]".to_string(),
                            };
                            serde_json::json!({
                                "type": "tool_result",
                                "tool_use_id": tool_use_id.0,
                                "content": content_text,
                                "is_error": is_error
                            })
                        }
                        _ => serde_json::json!({"type": "text", "text": ""}),
                    }).collect(),
                })
                .collect();
            
            Ok(api_messages)
        } else {
            Err(ClaudeError::internal("No active session"))
        }
    }
    
    /// Process streaming response
    async fn process_stream(
        &self,
        mut stream: tokio_stream::wrappers::UnboundedReceiverStream<StreamEvent>,
    ) -> ClaudeResult<StreamResult> {
        let mut content_blocks: Vec<ContentBlock> = Vec::new();
        let mut current_text = String::new();
        let mut current_tool_use: Option<(ToolUseId, String, serde_json::Value)> = None;
        let mut tool_calls: Vec<ToolCall> = Vec::new();
        let mut usage: Option<TokenUsage> = None;
        
        while let Some(event) = stream.next().await {
            trace!("Stream event: {:?}", event);
            
            match event {
                StreamEvent::MessageStart { message } => {
                    self.send_event(EngineEvent::StreamStarted).await;
                }
                
                StreamEvent::ContentBlockStart { index, content_block } => {
                    // New content block started
                    if let Some(ref tool) = current_tool_use {
                        // Save previous tool use
                        tool_calls.push(ToolCall {
                            id: tool.0.clone(),
                            name: tool.1.clone(),
                            input: tool.2.clone(),
                        });
                        content_blocks.push(ContentBlock::ToolUse {
                            id: tool.0.clone(),
                            name: tool.1.clone(),
                            input: tool.2.clone(),
                        });
                    }
                    
                    if !current_text.is_empty() {
                        content_blocks.push(ContentBlock::Text { 
                            text: current_text.clone() 
                        });
                        current_text.clear();
                    }
                    
                    match content_block.get("type").and_then(|t| t.as_str()) {
                        Some("text") => {
                            // Text block - will accumulate in deltas
                        }
                        Some("tool_use") => {
                            let id = content_block.get("id")
                                .and_then(|i| i.as_str())
                                .map(|s| ToolUseId(s.to_string()))
                                .unwrap_or_else(ToolUseId::new);
                            let name = content_block.get("name")
                                .and_then(|n| n.as_str())
                                .unwrap_or("")
                                .to_string();
                            current_tool_use = Some((id, name, serde_json::Value::Object(serde_json::Map::new())));
                            
                            self.send_event(EngineEvent::ToolUseStarted {
                                id: current_tool_use.as_ref().unwrap().0.clone(),
                                name: name.clone(),
                            }).await;
                        }
                        _ => {}
                    }
                }
                
                StreamEvent::ContentBlockDelta { index, delta } => {
                    if let Some(text) = delta.get("text").and_then(|t| t.as_str()) {
                        current_text.push_str(text);
                        
                        self.send_event(EngineEvent::StreamToken {
                            token: text.to_string(),
                        }).await;
                    }
                    
                    if let Some(partial_json) = delta.get("partial_json").and_then(|p| p.as_str()) {
                        // Tool input accumulating
                        if let Some(ref mut tool) = current_tool_use {
                            // Merge partial JSON into tool input
                            if let Ok(value) = serde_json::from_str(partial_json) {
                                if let serde_json::Value::Object(map) = value {
                                    if let serde_json::Value::Object(ref mut existing) = tool.2 {
                                        for (k, v) in map {
                                            existing.insert(k, v);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                
                StreamEvent::ContentBlockStop { index } => {
                    // Content block complete
                }
                
                StreamEvent::MessageDelta { delta, usage: u } => {
                    if let Some(u) = u {
                        usage = Some(u);
                    }
                }
                
                StreamEvent::MessageStop => {
                    // Finalize content
                    if let Some(ref tool) = current_tool_use {
                        tool_calls.push(ToolCall {
                            id: tool.0.clone(),
                            name: tool.1.clone(),
                            input: tool.2.clone(),
                        });
                        content_blocks.push(ContentBlock::ToolUse {
                            id: tool.0.clone(),
                            name: tool.1.clone(),
                            input: tool.2.clone(),
                        });
                    }
                    
                    if !current_text.is_empty() {
                        content_blocks.push(ContentBlock::Text { 
                            text: current_text 
                        });
                    }
                    
                    self.send_event(EngineEvent::StreamComplete).await;
                }
                
                StreamEvent::Error { error } => {
                    return Ok(StreamResult::Error { 
                        error: ClaudeError::api(error) 
                    });
                }
                
                _ => {}
            }
        }
        
        let message = Message {
            id: Some(claude_core::MessageId::new()),
            role: MessageRole::Assistant,
            content: content_blocks,
            usage,
            timestamp: Some(chrono::Utc::now()),
        };
        
        Ok(StreamResult::Complete { message, tool_calls })
    }
    
    /// Execute tool calls
    async fn execute_tool_calls(&self, calls: &[ToolCall]) -> ClaudeResult<Vec<ToolResult>> {
        let mut results = Vec::new();
        let perms = self.permissions.read().await.clone();
        let cwd = std::env::current_dir()?
            .to_string_lossy()
            .to_string();
        
        for call in calls {
            debug!("Executing tool: {}", call.name);
            
            // Find the tool
            let tool = {
                let tools = self.tools.read().await;
                tools.get(&call.name).cloned()
            };
            
            if let Some(tool) = tool {
                // Update state
                {
                    let mut state = self.state.write().await;
                    state.current_tool = Some(call.name.clone());
                    state.set_status(claude_core::AgentStatus::ExecutingTools);
                }
                
                // Check permission
                let tool_ctx = ToolContext::new(cwd.clone());
                let input = ToolInput::new(&call.name, call.input.clone());
                
                let perm_result = tool.check_permission(&input, &tool_ctx);
                
                match perm_result {
                    claude_core::PermissionResult::Allowed => {
                        // Execute the tool
                        let start = std::time::Instant::now();
                        
                        let output = tool.execute(input, tool_ctx).await?;
                        
                        let duration = start.elapsed();
                        
                        let result = if output.is_error {
                            ToolResult {
                                tool_use_id: call.id.clone(),
                                output: crate::ToolResultContent::Text(output.content.clone()),
                                error: Some(output.content),
                                duration_ms: duration.as_millis() as u64,
                            }
                        } else {
                            ToolResult {
                                tool_use_id: call.id.clone(),
                                output: crate::ToolResultContent::Text(output.content),
                                error: None,
                                duration_ms: duration.as_millis() as u64,
                            }
                        };
                        
                        self.send_event(EngineEvent::ToolUseCompleted {
                            id: call.id.clone(),
                            result: result.clone(),
                        }).await;
                        
                        results.push(result);
                    }
                    
                    claude_core::PermissionResult::NeedsConfirmation { action } => {
                        // Request user confirmation
                        self.send_event(EngineEvent::PermissionRequested {
                            action: action.clone(),
                            tool_name: call.name.clone(),
                            tool_input: call.input.clone(),
                        }).await;
                        
                        // For now, auto-allow in non-interactive mode
                        // In real implementation, this would wait for user response
                        warn!("Permission confirmation needed for {} - auto-allowing for now", call.name);
                        
                        let result = ToolResult::error(
                            call.id.clone(),
                            format!("Permission required for: {}", action)
                        );
                        results.push(result);
                    }
                    
                    claude_core::PermissionResult::Denied { reason } => {
                        let result = ToolResult::error(
                            call.id.clone(),
                            format!("Permission denied: {}", reason)
                        );
                        results.push(result);
                    }
                    
                    _ => {
                        let result = ToolResult::error(
                            call.id.clone(),
                            "Unexpected permission result".to_string()
                        );
                        results.push(result);
                    }
                }
            } else {
                let result = ToolResult::error(
                    call.id.clone(),
                    format!("Tool '{}' not found", call.name)
                );
                results.push(result);
            }
        }
        
        Ok(results)
    }
}

/// Stream processing result
enum StreamResult {
    /// Complete message with potential tool calls
    Complete {
        message: Message,
        tool_calls: Vec<ToolCall>,
    },
    /// Error occurred
    Error {
        error: ClaudeError,
    },
}

