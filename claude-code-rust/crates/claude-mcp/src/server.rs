//! MCP Server implementation
//!
//! This module provides an MCP server that exposes tools over the
//! Model Context Protocol using stdio transport.

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

use claude_core::{Tool, ToolInput};

use crate::protocol::*;
use crate::transport::{Message, StdioTransport, TransportError, TransportResult};

/// Errors that can occur during MCP server operations
#[derive(Debug, thiserror::Error)]
pub enum McpServerError {
    /// Transport error
    #[error("Transport error: {0}")]
    Transport(#[from] TransportError),

    /// Protocol error
    #[error("Protocol error: {0}")]
    Protocol(String),

    /// Tool execution error
    #[error("Tool execution error: {0}")]
    ToolExecution(String),

    /// Server already running
    #[error("Server already running")]
    AlreadyRunning,
}

pub type McpServerResult<T> = Result<T, McpServerError>;

/// MCP Server for exposing tools via the Model Context Protocol
///
/// # Example
///
/// ```no_run
/// use claude_mcp::McpServer;
/// use claude_tools::EchoTool;
///
/// #[tokio::main]
/// async fn main() -> Result<(), Box<dyn std::error::Error>> {
///     let mut server = McpServer::new("my-server", "1.0.0");
///
///     // Register tools
///     server.register_tool(EchoTool::new());
///
///     // Start serving over stdio
///     server.serve_stdio().await?;
///     Ok(())
/// }
/// ```
pub struct McpServer {
    /// Server name
    name: String,

    /// Server version
    version: String,

    /// Registered tools
    tools: Arc<RwLock<HashMap<String, Box<dyn Tool>>>>,

    /// Server capabilities
    capabilities: ServerCapabilities,

    /// Whether the server has been initialized
    initialized: Arc<RwLock<bool>>,
}

impl McpServer {
    /// Create a new MCP server
    pub fn new(name: impl Into<String>, version: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            version: version.into(),
            tools: Arc::new(RwLock::new(HashMap::new())),
            capabilities: ServerCapabilities {
                tools: Some(ToolsCapability {
                    list_changed: false,
                }),
                experimental: serde_json::Value::Null,
            },
            initialized: Arc::new(RwLock::new(false)),
        }
    }

    /// Register a tool with the server
    pub fn register_tool<T: Tool + 'static>(&mut self, tool: T) {
        let name = tool.name().to_string();
        let tools = Arc::clone(&self.tools);

        tokio::spawn(async move {
            let mut tools = tools.write().await;
            tools.insert(name, Box::new(tool));
        });
    }

    /// Serve over stdio
    ///
    /// This will read from stdin and write to stdout, making it suitable
    /// for use as an MCP server process.
    pub async fn serve_stdio(self) -> McpServerResult<()> {
        use tokio::io::{stdin, stdout};
        use tokio::process::{ChildStdin, ChildStdout};

        // Convert tokio stdin/stdout to the types expected by StdioTransport
        // We use unsafe here because we need to convert from Stdin/Stdout to ChildStdin/ChildStdout
        // This is safe because we're the only ones using these handles and we won't drop them prematurely
        let stdin_handle = stdin();
        let stdout_handle = stdout();

        // We need to create ChildStdin/ChildStdout from the current process stdio
        // Since StdioTransport expects these types, we'll use a workaround with channels
        use tokio::sync::mpsc;
        use crate::transport::Message;

        let (write_tx, mut write_rx) = mpsc::unbounded_channel::<Message>();
        let (read_tx, mut read_rx) = mpsc::unbounded_channel::<Message>();

        // Spawn reader task for stdin
        let reader_handle = tokio::spawn(async move {
            use tokio::io::{AsyncBufReadExt, BufReader};
            let mut reader = BufReader::new(stdin_handle);
            let mut line = String::new();

            loop {
                line.clear();
                match reader.read_line(&mut line).await {
                    Ok(0) => break, // EOF
                    Ok(_) => {
                        let trimmed = line.trim();
                        if trimmed.is_empty() {
                            continue;
                        }

                        if let Ok(message) = serde_json::from_str::<Message>(trimmed) {
                            if read_tx.send(message).is_err() {
                                break;
                            }
                        }
                    }
                    Err(_) => break,
                }
            }
        });

        // Spawn writer task for stdout
        let writer_handle = tokio::spawn(async move {
            use tokio::io::AsyncWriteExt;
            let mut stdout = stdout_handle;

            while let Some(message) = write_rx.recv().await {
                if let Ok(json) = serde_json::to_string(&message) {
                    let line = format!("{}\n", json);
                    if stdout.write_all(line.as_bytes()).await.is_err() {
                        break;
                    }
                    if stdout.flush().await.is_err() {
                        break;
                    }
                }
            }
        });

        // Main serve loop
        loop {
            let message = match read_rx.recv().await {
                Some(msg) => msg,
                None => break,
            };

            match message {
                Message::Request(request) => {
                    let response = self.handle_request(request).await;
                    if write_tx.send(Message::Response(response)).is_err() {
                        break;
                    }
                }
                Message::Notification(notification) => {
                    self.handle_notification(notification).await;
                }
                Message::Response(_) => {
                    tracing::warn!("Servers should not receive responses");
                }
            }
        }

        // Cleanup
        reader_handle.abort();
        writer_handle.abort();

        Ok(())
    }

    /// Serve using a custom transport
    pub async fn serve(self, mut transport: StdioTransport) -> McpServerResult<()> {
        loop {
            let message = match transport.receive().await {
                Ok(msg) => msg,
                Err(e) => {
                    tracing::debug!("Transport receive error: {}", e);
                    break;
                }
            };

            match message {
                Message::Request(request) => {
                    let response = self.handle_request(request).await;
                    if let Err(e) = transport.send(Message::Response(response)) {
                        tracing::error!("Failed to send response: {}", e);
                        break;
                    }
                }
                Message::Notification(notification) => {
                    self.handle_notification(notification).await;
                }
                Message::Response(_) => {
                    tracing::warn!("Servers should not receive responses");
                }
            }
        }

        Ok(())
    }

    /// Handle an incoming request
    async fn handle_request(&self, request: JsonRpcRequest) -> JsonRpcResponse {
        match request.method.as_str() {
            "initialize" => self.handle_initialize(request).await,
            "tools/list" => self.handle_list_tools(request).await,
            "tools/call" => self.handle_call_tool(request).await,
            _ => JsonRpcResponse::error(
                request.id,
                JsonRpcError::method_not_found(&request.method),
            ),
        }
    }

    /// Handle an initialize request
    async fn handle_initialize(&self, request: JsonRpcRequest) -> JsonRpcResponse {
        // Parse initialize params (we don't strictly validate them)
        let _params: Result<InitializeParams, _> = serde_json::from_value(request.params);

        let result = InitializeResult {
            protocol_version: "2024-11-05".to_string(),
            capabilities: self.capabilities.clone(),
            server_info: ServerInfo {
                name: self.name.clone(),
                version: self.version.clone(),
            },
        };

        *self.initialized.write().await = true;

        JsonRpcResponse::success(request.id, result)
    }

    /// Handle a list tools request
    async fn handle_list_tools(&self, request: JsonRpcRequest) -> JsonRpcResponse {
        if !*self.initialized.read().await {
            return JsonRpcResponse::error(
                request.id,
                JsonRpcError::internal_error("Server not initialized"),
            );
        }

        let tools = self.tools.read().await;

        let mcp_tools: Vec<McpTool> = tools
            .values()
            .map(|tool| McpTool {
                name: tool.name().to_string(),
                description: tool.description().to_string(),
                input_schema: tool.input_schema(),
            })
            .collect();

        let result = ListToolsResult { tools: mcp_tools };

        JsonRpcResponse::success(request.id, result)
    }

    /// Handle a call tool request
    async fn handle_call_tool(&self, request: JsonRpcRequest) -> JsonRpcResponse {
        if !*self.initialized.read().await {
            return JsonRpcResponse::error(
                request.id,
                JsonRpcError::internal_error("Server not initialized"),
            );
        }

        // Parse call tool params
        let params: CallToolParams = match serde_json::from_value(request.params) {
            Ok(p) => p,
            Err(e) => {
                return JsonRpcResponse::error(
                    request.id,
                    JsonRpcError::invalid_params(format!("Invalid parameters: {}", e)),
                )
            }
        };

        // Get the tool
        let tools = self.tools.read().await;
        let tool = match tools.get(&params.name) {
            Some(t) => t,
            None => {
                return JsonRpcResponse::error(
                    request.id,
                    JsonRpcError::invalid_params(format!("Tool not found: {}", params.name)),
                )
            }
        };

        // Execute the tool
        let tool_input = match ToolInput::new(params.arguments) {
            Ok(input) => input,
            Err(e) => {
                return JsonRpcResponse::error(
                    request.id,
                    JsonRpcError::invalid_params(format!("Invalid arguments: {}", e)),
                )
            }
        };

        let tool_result = match tool.execute(tool_input).await {
            Ok(result) => result,
            Err(e) => {
                return JsonRpcResponse::error(
                    request.id,
                    JsonRpcError::internal_error(format!("Tool execution failed: {}", e)),
                )
            }
        };

        // Convert tool result to MCP format
        let content = if tool_result.success {
            if let Some(output) = tool_result.output {
                vec![ToolContent::text(
                    serde_json::to_string_pretty(&output).unwrap_or_else(|_| output.to_string()),
                )]
            } else {
                vec![ToolContent::text("Success")]
            }
        } else {
            vec![ToolContent::text(
                tool_result
                    .error
                    .unwrap_or_else(|| "Unknown error".to_string()),
            )]
        };

        let result = CallToolResult {
            content,
            is_error: Some(!tool_result.success),
        };

        JsonRpcResponse::success(request.id, result)
    }

    /// Handle an incoming notification
    async fn handle_notification(&self, notification: JsonRpcNotification) {
        tracing::debug!(
            "Received notification: {} with params: {:?}",
            notification.method,
            notification.params
        );
        // Handle notifications if needed in the future
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use claude_core::{Tool, ToolResult};
    use async_trait::async_trait;
    use serde_json::json;

    struct TestTool;

    #[async_trait]
    impl Tool for TestTool {
        fn name(&self) -> &str {
            "TestTool"
        }

        fn description(&self) -> &str {
            "A test tool"
        }

        fn input_schema(&self) -> serde_json::Value {
            json!({
                "type": "object",
                "properties": {
                    "message": {"type": "string"}
                }
            })
        }

        async fn execute(&self, input: ToolInput) -> claude_core::Result<ToolResult> {
            Ok(ToolResult::success(json!({
                "echo": input.get("message")
            })))
        }
    }

    #[tokio::test]
    async fn test_server_creation() {
        let mut server = McpServer::new("test-server", "1.0.0");
        server.register_tool(TestTool);

        assert_eq!(server.name, "test-server");
        assert_eq!(server.version, "1.0.0");
    }

    #[tokio::test]
    async fn test_handle_initialize() {
        let server = McpServer::new("test", "1.0");

        let request = JsonRpcRequest::new(
            RequestId::from(1),
            "initialize",
            json!({
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {
                    "name": "test-client",
                    "version": "1.0"
                }
            }),
        );

        let response = server.handle_initialize(request).await;

        assert!(response.result.is_some());
        assert!(response.error.is_none());
    }

    #[tokio::test]
    async fn test_handle_list_tools() {
        let mut server = McpServer::new("test", "1.0");
        server.register_tool(TestTool);

        // Initialize first
        *server.initialized.write().await = true;

        // Need to wait for the tool to be registered
        tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;

        let request = JsonRpcRequest::new(RequestId::from(1), "tools/list", json!({}));

        let response = server.handle_list_tools(request).await;

        assert!(response.result.is_some());
        assert!(response.error.is_none());

        let result: ListToolsResult =
            serde_json::from_value(response.result.unwrap()).unwrap();
        assert_eq!(result.tools.len(), 1);
        assert_eq!(result.tools[0].name, "TestTool");
    }
}
