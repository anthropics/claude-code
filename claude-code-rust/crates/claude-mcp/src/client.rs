//! MCP Client implementation
//!
//! This module provides an MCP client that can connect to and communicate
//! with MCP servers over stdio.

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{Mutex, RwLock};

use crate::protocol::*;
use crate::transport::{Message, StdioTransport, TransportError};

/// Errors that can occur during MCP client operations
#[derive(Debug, thiserror::Error)]
pub enum McpClientError {
    /// Transport error
    #[error("Transport error: {0}")]
    Transport(#[from] TransportError),

    /// Protocol error
    #[error("Protocol error: {0}")]
    Protocol(String),

    /// Server returned an error
    #[error("Server error: {0}")]
    ServerError(String),

    /// Request timeout
    #[error("Request timeout")]
    Timeout,

    /// Client not initialized
    #[error("Client not initialized")]
    NotInitialized,

    /// Client already closed
    #[error("Client already closed")]
    Closed,
}

pub type McpClientResult<T> = Result<T, McpClientError>;

/// Pending request waiting for a response
struct PendingRequest {
    sender: tokio::sync::oneshot::Sender<JsonRpcResponse>,
}

/// MCP Client for communicating with MCP servers
///
/// # Example
///
/// ```no_run
/// use claude_mcp::McpClient;
///
/// #[tokio::main]
/// async fn main() -> Result<(), Box<dyn std::error::Error>> {
///     // Connect to an MCP server
///     let mut client = McpClient::connect("mcp-server", &[]).await?;
///
///     // List available tools
///     let tools = client.list_tools().await?;
///     println!("Available tools: {:?}", tools);
///
///     // Call a tool
///     let result = client.call_tool("my_tool", serde_json::json!({"arg": "value"})).await?;
///     println!("Result: {:?}", result);
///
///     // Disconnect
///     client.disconnect().await?;
///     Ok(())
/// }
/// ```
pub struct McpClient {
    /// Transport layer
    transport: Arc<Mutex<StdioTransport>>,

    /// Pending requests waiting for responses
    pending_requests: Arc<RwLock<HashMap<RequestId, PendingRequest>>>,

    /// Next request ID
    next_id: Arc<Mutex<i64>>,

    /// Whether the client has been initialized
    initialized: Arc<RwLock<bool>>,

    /// Background task handle for processing messages
    message_handler: Option<tokio::task::JoinHandle<()>>,

    /// Server information
    server_info: Arc<RwLock<Option<ServerInfo>>>,

    /// Server capabilities
    server_capabilities: Arc<RwLock<Option<ServerCapabilities>>>,
}

impl McpClient {
    /// Connect to an MCP server by spawning a command
    ///
    /// This will:
    /// 1. Spawn the server process
    /// 2. Send an initialize request
    /// 3. Wait for the initialize response
    pub async fn connect(command: &str, args: &[String]) -> McpClientResult<Self> {
        let transport = StdioTransport::spawn(command, args).await?;
        let mut client = Self::new(transport);

        // Initialize the connection
        client.initialize().await?;

        Ok(client)
    }

    /// Create a new MCP client with the given transport
    fn new(transport: StdioTransport) -> Self {
        let transport = Arc::new(Mutex::new(transport));
        let pending_requests = Arc::new(RwLock::new(HashMap::new()));
        let initialized = Arc::new(RwLock::new(false));
        let server_info = Arc::new(RwLock::new(None));
        let server_capabilities = Arc::new(RwLock::new(None));

        // Spawn message handler task
        let message_handler = {
            let transport = Arc::clone(&transport);
            let pending_requests = Arc::clone(&pending_requests);

            tokio::spawn(async move {
                Self::message_handler_task(transport, pending_requests).await;
            })
        };

        Self {
            transport,
            pending_requests,
            next_id: Arc::new(Mutex::new(1)),
            initialized,
            message_handler: Some(message_handler),
            server_info,
            server_capabilities,
        }
    }

    /// Background task for handling incoming messages
    async fn message_handler_task(
        transport: Arc<Mutex<StdioTransport>>,
        pending_requests: Arc<RwLock<HashMap<RequestId, PendingRequest>>>,
    ) {
        loop {
            let message = {
                let mut transport = transport.lock().await;
                match transport.receive().await {
                    Ok(msg) => msg,
                    Err(e) => {
                        tracing::debug!("Transport receive error: {}", e);
                        break;
                    }
                }
            };

            match message {
                Message::Response(response) => {
                    let mut pending = pending_requests.write().await;
                    if let Some(pending_req) = pending.remove(&response.id) {
                        let _ = pending_req.sender.send(response);
                    } else {
                        tracing::warn!("Received response for unknown request: {:?}", response.id);
                    }
                }
                Message::Notification(notification) => {
                    tracing::debug!("Received notification: {}", notification.method);
                    // Handle notifications (for future extension)
                }
                Message::Request(request) => {
                    tracing::warn!("Received unexpected request: {}", request.method);
                    // Clients shouldn't receive requests in standard MCP flow
                }
            }
        }
    }

    /// Send a request and wait for a response
    async fn send_request(
        &self,
        method: impl Into<String>,
        params: impl serde::Serialize,
    ) -> McpClientResult<JsonRpcResponse> {
        let id = {
            let mut next_id = self.next_id.lock().await;
            let id = *next_id;
            *next_id += 1;
            RequestId::from(id)
        };

        let request = JsonRpcRequest::new(id.clone(), method, params);

        // Create a oneshot channel for the response
        let (tx, rx) = tokio::sync::oneshot::channel();

        // Register the pending request
        {
            let mut pending = self.pending_requests.write().await;
            pending.insert(id, PendingRequest { sender: tx });
        }

        // Send the request
        {
            let transport = self.transport.lock().await;
            transport.send(Message::Request(request))?;
        }

        // Wait for the response with timeout
        let response = tokio::time::timeout(std::time::Duration::from_secs(30), rx)
            .await
            .map_err(|_| McpClientError::Timeout)?
            .map_err(|_| McpClientError::Protocol("Response channel closed".to_string()))?;

        // Check for errors in the response
        if let Some(error) = response.error {
            return Err(McpClientError::ServerError(error.message));
        }

        Ok(response)
    }

    /// Initialize the MCP connection
    async fn initialize(&mut self) -> McpClientResult<()> {
        let params = InitializeParams {
            protocol_version: "2024-11-05".to_string(),
            capabilities: ClientCapabilities::default(),
            client_info: ClientInfo {
                name: "claude-code".to_string(),
                version: env!("CARGO_PKG_VERSION").to_string(),
            },
        };

        let response = self.send_request("initialize", params).await?;

        let result: InitializeResult = serde_json::from_value(
            response
                .result
                .ok_or_else(|| McpClientError::Protocol("Missing result".to_string()))?,
        )
        .map_err(|e| McpClientError::Protocol(format!("Invalid initialize result: {}", e)))?;

        // Store server info and capabilities
        *self.server_info.write().await = Some(result.server_info);
        *self.server_capabilities.write().await = Some(result.capabilities);
        *self.initialized.write().await = true;

        Ok(())
    }

    /// List available tools from the server
    pub async fn list_tools(&self) -> McpClientResult<Vec<McpTool>> {
        self.ensure_initialized().await?;

        let response = self
            .send_request("tools/list", serde_json::json!({}))
            .await?;

        let result: ListToolsResult = serde_json::from_value(
            response
                .result
                .ok_or_else(|| McpClientError::Protocol("Missing result".to_string()))?,
        )
        .map_err(|e| McpClientError::Protocol(format!("Invalid list tools result: {}", e)))?;

        Ok(result.tools)
    }

    /// Call a tool on the server
    pub async fn call_tool(
        &self,
        name: impl Into<String>,
        arguments: serde_json::Value,
    ) -> McpClientResult<CallToolResult> {
        self.ensure_initialized().await?;

        let params = CallToolParams {
            name: name.into(),
            arguments,
        };

        let response = self.send_request("tools/call", params).await?;

        let result: CallToolResult = serde_json::from_value(
            response
                .result
                .ok_or_else(|| McpClientError::Protocol("Missing result".to_string()))?,
        )
        .map_err(|e| McpClientError::Protocol(format!("Invalid call tool result: {}", e)))?;

        Ok(result)
    }

    /// Get server information
    pub async fn server_info(&self) -> Option<ServerInfo> {
        self.server_info.read().await.clone()
    }

    /// Get server capabilities
    pub async fn server_capabilities(&self) -> Option<ServerCapabilities> {
        self.server_capabilities.read().await.clone()
    }

    /// Check if the client is initialized
    async fn ensure_initialized(&self) -> McpClientResult<()> {
        if !*self.initialized.read().await {
            return Err(McpClientError::NotInitialized);
        }
        Ok(())
    }

    /// Disconnect from the server
    pub async fn disconnect(mut self) -> McpClientResult<()> {
        // Abort message handler
        if let Some(handle) = self.message_handler.take() {
            handle.abort();
        }

        // Close transport
        let transport = Arc::try_unwrap(self.transport)
            .ok()
            .map(|mutex| mutex.into_inner())
            .ok_or(McpClientError::Closed)?;

        transport.close().await?;

        Ok(())
    }

    /// Check if the server process is still running
    pub async fn is_running(&self) -> bool {
        let mut transport = self.transport.lock().await;
        transport.is_running()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_client_creation() {
        // Just verify types compile
        let _: Result<McpClient, McpClientError> = Err(McpClientError::NotInitialized);
    }

    #[test]
    fn test_error_types() {
        let err = McpClientError::ServerError("test error".to_string());
        assert!(err.to_string().contains("test error"));
    }
}
