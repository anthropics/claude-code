//! Model Context Protocol (MCP) implementation for Claude Code
//!
//! This crate provides both client and server implementations of the Model Context Protocol (MCP),
//! enabling Claude Code to communicate with external MCP servers and expose its own tools
//! as an MCP server.
//!
//! # Architecture
//!
//! The crate is organized into several key modules:
//!
//! ## Protocol Layer ([`protocol`])
//! - JSON-RPC 2.0 message types (Request, Response, Notification)
//! - MCP-specific message types (Initialize, ListTools, CallTool)
//! - Serialization/deserialization support
//!
//! ## Transport Layer ([`transport`])
//! - Stdio-based transport for process communication
//! - Line-based JSON message framing
//! - Async read/write with tokio
//! - Process lifecycle management
//!
//! ## Client ([`client`])
//! - Connect to external MCP servers
//! - Discover available tools
//! - Execute tool calls
//! - Automatic initialization and cleanup
//!
//! ## Server ([`server`])
//! - Expose Claude Code tools via MCP
//! - Handle client requests
//! - Tool registration and execution
//! - Stdio server implementation
//!
//! # Quick Start - Client
//!
//! Connect to an MCP server and call tools:
//!
//! ```no_run
//! use claude_mcp::McpClient;
//! use serde_json::json;
//!
//! #[tokio::main]
//! async fn main() -> Result<(), Box<dyn std::error::Error>> {
//!     // Connect to an MCP server
//!     let mut client = McpClient::connect("mcp-server", &[]).await?;
//!
//!     // List available tools
//!     let tools = client.list_tools().await?;
//!     for tool in tools {
//!         println!("Tool: {} - {}", tool.name, tool.description);
//!     }
//!
//!     // Call a tool
//!     let result = client.call_tool("echo", json!({
//!         "message": "Hello, MCP!"
//!     })).await?;
//!
//!     println!("Result: {:?}", result);
//!
//!     // Disconnect
//!     client.disconnect().await?;
//!     Ok(())
//! }
//! ```
//!
//! # Quick Start - Server
//!
//! Expose tools via MCP:
//!
//! ```no_run
//! use claude_mcp::McpServer;
//! use claude_tools::EchoTool;
//!
//! #[tokio::main]
//! async fn main() -> Result<(), Box<dyn std::error::Error>> {
//!     let mut server = McpServer::new("my-server", "1.0.0");
//!
//!     // Register tools
//!     server.register_tool(EchoTool::new());
//!
//!     // Start serving over stdio
//!     server.serve_stdio().await?;
//!     Ok(())
//! }
//! ```
//!
//! # MCP Protocol Overview
//!
//! The Model Context Protocol uses JSON-RPC 2.0 over stdio for communication:
//!
//! ## Message Format
//! Each message is a single line of JSON followed by a newline.
//!
//! ## Message Types
//!
//! ### Request
//! ```json
//! {
//!   "jsonrpc": "2.0",
//!   "id": 1,
//!   "method": "tools/list",
//!   "params": {}
//! }
//! ```
//!
//! ### Response
//! ```json
//! {
//!   "jsonrpc": "2.0",
//!   "id": 1,
//!   "result": {
//!     "tools": [
//!       {
//!         "name": "echo",
//!         "description": "Echoes back the input",
//!         "inputSchema": {
//!           "type": "object",
//!           "properties": {
//!             "message": {"type": "string"}
//!           }
//!         }
//!       }
//!     ]
//!   }
//! }
//! ```
//!
//! ### Notification
//! ```json
//! {
//!   "jsonrpc": "2.0",
//!   "method": "notification",
//!   "params": {}
//! }
//! ```
//!
//! ## Lifecycle
//!
//! 1. **Initialize**: Client sends `initialize` request with capabilities
//! 2. **Ready**: Server responds with its capabilities and tools
//! 3. **Tool Discovery**: Client can call `tools/list` to discover available tools
//! 4. **Tool Execution**: Client calls `tools/call` to execute tools
//! 5. **Shutdown**: Connection is closed when either side terminates
//!
//! ## Key Methods
//!
//! - `initialize`: Initialize the MCP connection
//! - `tools/list`: List available tools
//! - `tools/call`: Execute a tool
//!
//! # Error Handling
//!
//! The crate provides comprehensive error types:
//!
//! - [`client::McpClientError`]: Client-side errors (transport, protocol, server errors)
//! - [`server::McpServerError`]: Server-side errors (transport, protocol, tool execution)
//! - [`transport::TransportError`]: Low-level transport errors (IO, serialization)
//!
//! # Thread Safety
//!
//! All types in this crate are thread-safe and can be safely shared across async tasks.
//! The client and server use internal locking to coordinate concurrent access.
//!
//! # Safety
//! This crate forbids unsafe code to ensure memory safety and reliability.

#![forbid(unsafe_code)]
#![warn(missing_docs)]

pub mod client;
pub mod protocol;
pub mod server;
pub mod transport;

// Re-export commonly used types
pub use client::{McpClient, McpClientError, McpClientResult};
pub use protocol::{
    CallToolParams, CallToolResult, InitializeParams, InitializeResult, JsonRpcError,
    JsonRpcNotification, JsonRpcRequest, JsonRpcResponse, ListToolsResult, McpTool, RequestId,
    ServerCapabilities, ServerInfo, ToolContent,
};
pub use server::{McpServer, McpServerError, McpServerResult};
pub use transport::{Message, StdioTransport, TransportError, TransportResult};

#[cfg(test)]
mod integration_tests {
    use super::*;
    use claude_core::{Tool, ToolInput, ToolResult};
    use async_trait::async_trait;
    use serde_json::json;

    struct TestTool;

    #[async_trait]
    impl Tool for TestTool {
        fn name(&self) -> &str {
            "TestTool"
        }

        fn description(&self) -> &str {
            "A test tool for integration testing"
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
            let message = input
                .get("message")
                .and_then(|v| v.as_str())
                .unwrap_or("default");

            Ok(ToolResult::success(json!({
                "echo": message
            })))
        }
    }

    #[test]
    fn test_protocol_types() {
        // Test that protocol types serialize correctly
        let req = JsonRpcRequest::new(RequestId::from(1), "test", json!({}));
        let json = serde_json::to_string(&req).unwrap();
        assert!(json.contains("\"method\":\"test\""));

        let resp = JsonRpcResponse::success(RequestId::from(1), json!({"ok": true}));
        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("\"result\""));
    }

    #[test]
    fn test_error_types() {
        let err = JsonRpcError::method_not_found("testMethod");
        assert_eq!(err.code, -32601);
        assert!(err.message.contains("testMethod"));

        let err = JsonRpcError::invalid_params("bad params");
        assert_eq!(err.code, -32602);
    }

    #[test]
    fn test_tool_content() {
        let text = ToolContent::text("Hello");
        let json = serde_json::to_value(&text).unwrap();
        assert_eq!(json["type"], "text");
        assert_eq!(json["text"], "Hello");
    }
}
