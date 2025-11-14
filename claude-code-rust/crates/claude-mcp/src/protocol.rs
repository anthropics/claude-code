//! JSON-RPC 2.0 and MCP protocol message types
//!
//! This module defines the core protocol types for Model Context Protocol (MCP),
//! which uses JSON-RPC 2.0 as its transport layer.

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// JSON-RPC 2.0 request ID
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(untagged)]
pub enum RequestId {
    /// Numeric ID
    Number(i64),
    /// String ID
    String(String),
}

impl From<i64> for RequestId {
    fn from(n: i64) -> Self {
        RequestId::Number(n)
    }
}

impl From<String> for RequestId {
    fn from(s: String) -> Self {
        RequestId::String(s)
    }
}

impl From<&str> for RequestId {
    fn from(s: &str) -> Self {
        RequestId::String(s.to_string())
    }
}

/// JSON-RPC 2.0 Request message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcRequest {
    /// JSON-RPC version (always "2.0")
    pub jsonrpc: String,

    /// Request ID
    pub id: RequestId,

    /// Method name
    pub method: String,

    /// Method parameters
    #[serde(default)]
    pub params: Value,
}

impl JsonRpcRequest {
    /// Create a new JSON-RPC request
    pub fn new<T: Serialize>(id: RequestId, method: impl Into<String>, params: T) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            id,
            method: method.into(),
            params: serde_json::to_value(params).unwrap_or(Value::Null),
        }
    }
}

/// JSON-RPC 2.0 Response message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcResponse {
    /// JSON-RPC version (always "2.0")
    pub jsonrpc: String,

    /// Request ID this response corresponds to
    pub id: RequestId,

    /// Result (present on success)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,

    /// Error (present on failure)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<JsonRpcError>,
}

impl JsonRpcResponse {
    /// Create a successful response
    pub fn success<T: Serialize>(id: RequestId, result: T) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            id,
            result: Some(serde_json::to_value(result).unwrap_or(Value::Null)),
            error: None,
        }
    }

    /// Create an error response
    pub fn error(id: RequestId, error: JsonRpcError) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            id,
            result: None,
            error: Some(error),
        }
    }
}

/// JSON-RPC 2.0 Error object
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcError {
    /// Error code
    pub code: i32,

    /// Error message
    pub message: String,

    /// Additional error data
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
}

impl JsonRpcError {
    /// Create a new JSON-RPC error
    pub fn new(code: i32, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            data: None,
        }
    }

    /// Create a parse error (-32700)
    pub fn parse_error() -> Self {
        Self::new(-32700, "Parse error")
    }

    /// Create an invalid request error (-32600)
    pub fn invalid_request() -> Self {
        Self::new(-32600, "Invalid request")
    }

    /// Create a method not found error (-32601)
    pub fn method_not_found(method: &str) -> Self {
        Self::new(-32601, format!("Method not found: {}", method))
    }

    /// Create an invalid params error (-32602)
    pub fn invalid_params(msg: impl Into<String>) -> Self {
        Self::new(-32602, msg)
    }

    /// Create an internal error (-32603)
    pub fn internal_error(msg: impl Into<String>) -> Self {
        Self::new(-32603, msg)
    }
}

/// JSON-RPC 2.0 Notification message (no response expected)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcNotification {
    /// JSON-RPC version (always "2.0")
    pub jsonrpc: String,

    /// Method name
    pub method: String,

    /// Method parameters
    #[serde(default)]
    pub params: Value,
}

impl JsonRpcNotification {
    /// Create a new JSON-RPC notification
    pub fn new<T: Serialize>(method: impl Into<String>, params: T) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            method: method.into(),
            params: serde_json::to_value(params).unwrap_or(Value::Null),
        }
    }
}

/// MCP Initialize request parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InitializeParams {
    /// Protocol version
    #[serde(rename = "protocolVersion")]
    pub protocol_version: String,

    /// Client capabilities
    pub capabilities: ClientCapabilities,

    /// Client information
    #[serde(rename = "clientInfo")]
    pub client_info: ClientInfo,
}

/// Client capabilities
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ClientCapabilities {
    /// Experimental capabilities
    #[serde(default)]
    pub experimental: Value,
}

/// Client information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientInfo {
    /// Client name
    pub name: String,

    /// Client version
    pub version: String,
}

/// MCP Initialize response result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InitializeResult {
    /// Protocol version
    #[serde(rename = "protocolVersion")]
    pub protocol_version: String,

    /// Server capabilities
    pub capabilities: ServerCapabilities,

    /// Server information
    #[serde(rename = "serverInfo")]
    pub server_info: ServerInfo,
}

/// Server capabilities
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ServerCapabilities {
    /// Whether the server supports tools
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tools: Option<ToolsCapability>,

    /// Experimental capabilities
    #[serde(default)]
    pub experimental: Value,
}

/// Tools capability
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ToolsCapability {
    /// List of available tools
    #[serde(default)]
    pub list_changed: bool,
}

/// Server information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerInfo {
    /// Server name
    pub name: String,

    /// Server version
    pub version: String,
}

/// MCP Tool definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpTool {
    /// Tool name
    pub name: String,

    /// Tool description
    pub description: String,

    /// Input schema (JSON Schema)
    #[serde(rename = "inputSchema")]
    pub input_schema: Value,
}

/// List tools result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListToolsResult {
    /// Available tools
    pub tools: Vec<McpTool>,
}

/// Call tool parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CallToolParams {
    /// Tool name
    pub name: String,

    /// Tool arguments
    #[serde(default)]
    pub arguments: Value,
}

/// Call tool result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CallToolResult {
    /// Tool output content
    pub content: Vec<ToolContent>,

    /// Whether an error occurred
    #[serde(rename = "isError", skip_serializing_if = "Option::is_none")]
    pub is_error: Option<bool>,
}

/// Tool content item
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ToolContent {
    /// Text content
    #[serde(rename = "text")]
    Text { text: String },

    /// Image content
    #[serde(rename = "image")]
    Image {
        data: String,
        #[serde(rename = "mimeType")]
        mime_type: String,
    },

    /// Resource content
    #[serde(rename = "resource")]
    Resource {
        uri: String,
        #[serde(rename = "mimeType", skip_serializing_if = "Option::is_none")]
        mime_type: Option<String>,
    },
}

impl ToolContent {
    /// Create text content
    pub fn text(text: impl Into<String>) -> Self {
        Self::Text { text: text.into() }
    }

    /// Create image content
    pub fn image(data: impl Into<String>, mime_type: impl Into<String>) -> Self {
        Self::Image {
            data: data.into(),
            mime_type: mime_type.into(),
        }
    }

    /// Create resource content
    pub fn resource(uri: impl Into<String>) -> Self {
        Self::Resource {
            uri: uri.into(),
            mime_type: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_request_id() {
        let num_id = RequestId::from(42);
        assert_eq!(serde_json::to_string(&num_id).unwrap(), "42");

        let str_id = RequestId::from("test-id");
        assert_eq!(serde_json::to_string(&str_id).unwrap(), "\"test-id\"");
    }

    #[test]
    fn test_jsonrpc_request() {
        let req = JsonRpcRequest::new(
            RequestId::from(1),
            "testMethod",
            json!({"param": "value"}),
        );

        assert_eq!(req.jsonrpc, "2.0");
        assert_eq!(req.method, "testMethod");
        assert_eq!(req.params["param"], "value");
    }

    #[test]
    fn test_jsonrpc_response_success() {
        let resp = JsonRpcResponse::success(
            RequestId::from(1),
            json!({"result": "ok"}),
        );

        assert!(resp.result.is_some());
        assert!(resp.error.is_none());
    }

    #[test]
    fn test_jsonrpc_response_error() {
        let err = JsonRpcError::method_not_found("testMethod");
        let resp = JsonRpcResponse::error(RequestId::from(1), err);

        assert!(resp.result.is_none());
        assert!(resp.error.is_some());
        assert_eq!(resp.error.unwrap().code, -32601);
    }

    #[test]
    fn test_tool_content() {
        let text = ToolContent::text("Hello");
        let json = serde_json::to_value(&text).unwrap();
        assert_eq!(json["type"], "text");
        assert_eq!(json["text"], "Hello");

        let image = ToolContent::image("base64data", "image/png");
        let json = serde_json::to_value(&image).unwrap();
        assert_eq!(json["type"], "image");
    }
}
