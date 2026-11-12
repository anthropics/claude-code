//! MCP (Model Context Protocol) client implementation
//!
//! Supports JSON-RPC communication with MCP servers for tool discovery and invocation.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;
use thiserror::Error;
use tokio::sync::RwLock;
use tracing::{debug, error, info, instrument, warn};
use url::Url;

/// Errors that can occur in MCP operations
#[derive(Debug, Error, Clone)]
pub enum MCPError {
    #[error("Connection error: {0}")]
    Connection(String),
    
    #[error("Protocol error: {0}")]
    Protocol(String),
    
    #[error("Tool not found: {0}")]
    ToolNotFound(String),
    
    #[error("Invalid parameters: {0}")]
    InvalidParameters(String),
    
    #[error("Server error: {0}")]
    Server(String),
    
    #[error("Timeout")]
    Timeout,
    
    #[error("Serialization error: {0}")]
    Serialization(String),
}

/// MCP server configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MCPServerConfig {
    /// Server name/identifier
    pub name: String,
    /// Server URL
    pub url: String,
    /// Authentication token (if required)
    pub auth_token: Option<String>,
    /// Request timeout in seconds
    #[serde(default = "default_timeout")]
    pub timeout_secs: u64,
    /// Whether to use SSE streaming
    #[serde(default)]
    pub use_streaming: bool,
    /// Custom headers
    #[serde(default)]
    pub headers: HashMap<String, String>,
}

fn default_timeout() -> u64 {
    30
}

/// MCP tool definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MCPTool {
    /// Tool name
    pub name: String,
    /// Tool description
    pub description: String,
    /// Input schema (JSON Schema)
    pub input_schema: Value,
    /// Output schema (JSON Schema)
    pub output_schema: Option<Value>,
}

/// MCP resource definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MCPResource {
    /// Resource URI
    pub uri: String,
    /// Resource name
    pub name: String,
    /// Resource description
    pub description: Option<String>,
    /// MIME type
    pub mime_type: Option<String>,
}

/// MCP client for communicating with MCP servers
pub struct MCPClient {
    /// HTTP client
    client: reqwest::Client,
    /// Server configuration
    config: MCPServerConfig,
    /// Cached tools
    tools: Arc<RwLock<HashMap<String, MCPTool>>>,
    /// Cached resources
    resources: Arc<RwLock<Vec<MCPResource>>>,
    /// JSON-RPC request ID counter
    request_id: Arc<RwLock<u64>>,
}

impl MCPClient {
    /// Create a new MCP client
    pub fn new(config: MCPServerConfig) -> Result<Self, MCPError> {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(config.timeout_secs))
            .build()
            .map_err(|e| MCPError::Connection(e.to_string()))?;
        
        // Validate URL
        Url::parse(&config.url)
            .map_err(|e| MCPError::Connection(format!("Invalid URL: {}", e)))?;
        
        Ok(Self {
            client,
            config,
            tools: Arc::new(RwLock::new(HashMap::new())),
            resources: Arc::new(RwLock::new(Vec::new())),
            request_id: Arc::new(RwLock::new(0)),
        })
    }
    
    /// Initialize connection and discover capabilities
    #[instrument(skip(self))]
    pub async fn initialize(&self) -> Result<MCPInitializeResult, MCPError> {
        info!("Initializing MCP connection to {}", self.config.url);
        
        let request = self.create_jsonrpc_request("initialize", json!({
            "protocolVersion": "2024-11-05",
            "capabilities": {
                "tools": {},
                "resources": {},
            },
            "clientInfo": {
                "name": "claude-code-rust",
                "version": env!("CARGO_PKG_VERSION"),
            }
        }));
        
        let response = self.send_request(&request).await?;
        
        // Parse response
        let result = response.get("result")
            .ok_or_else(|| MCPError::Protocol("Missing result in initialize response".to_string()))?;
        
        let protocol_version = result.get("protocolVersion")
            .and_then(|v| v.as_str())
            .ok_or_else(|| MCPError::Protocol("Missing protocolVersion".to_string()))?;
        
        let capabilities = result.get("capabilities")
            .cloned()
            .unwrap_or_else(|| json!({}));
        
        info!("MCP server initialized with protocol {}", protocol_version);
        
        // Discover tools and resources
        self.discover_tools().await?;
        self.discover_resources().await?;
        
        Ok(MCPInitializeResult {
            protocol_version: protocol_version.to_string(),
            capabilities,
        })
    }
    
    /// Discover available tools from server
    #[instrument(skip(self))]
    async fn discover_tools(&self) -> Result<(), MCPError> {
        debug!("Discovering MCP tools");
        
        let request = self.create_jsonrpc_request("tools/list", json!({}));
        let response = self.send_request(&request).await?;
        
        let result = response.get("result")
            .ok_or_else(|| MCPError::Protocol("Missing result in tools/list response".to_string()))?;
        
        let tools_array = result.get("tools")
            .and_then(|v| v.as_array())
            .ok_or_else(|| MCPError::Protocol("Missing tools array".to_string()))?;
        
        let mut tools_guard = self.tools.write().await;
        tools_guard.clear();
        
        for tool_value in tools_array {
            let tool: MCPTool = serde_json::from_value(tool_value.clone())
                .map_err(|e| MCPError::Serialization(e.to_string()))?;
            
            debug!("Discovered MCP tool: {}", tool.name);
            tools_guard.insert(tool.name.clone(), tool);
        }
        
        info!("Discovered {} MCP tools", tools_guard.len());
        
        Ok(())
    }
    
    /// Discover available resources from server
    #[instrument(skip(self))]
    async fn discover_resources(&self) -> Result<(), MCPError> {
        debug!("Discovering MCP resources");
        
        let request = self.create_jsonrpc_request("resources/list", json!({}));
        
        match self.send_request(&request).await {
            Ok(response) => {
                if let Some(result) = response.get("result") {
                    if let Some(resources_array) = result.get("resources").and_then(|v| v.as_array()) {
                        let mut resources_guard = self.resources.write().await;
                        resources_guard.clear();
                        
                        for resource_value in resources_array {
                            if let Ok(resource) = serde_json::from_value::<MCPResource>(resource_value.clone()) {
                                debug!("Discovered MCP resource: {}", resource.uri);
                                resources_guard.push(resource);
                            }
                        }
                        
                        info!("Discovered {} MCP resources", resources_guard.len());
                    }
                }
            }
            Err(e) => {
                warn!("Failed to discover resources (server may not support them): {}", e);
            }
        }
        
        Ok(())
    }
    
    /// Call an MCP tool
    #[instrument(skip(self, arguments))]
    pub async fn call_tool(&self, tool_name: &str, arguments: Value) -> Result<Value, MCPError> {
        info!("Calling MCP tool: {}", tool_name);
        
        // Validate tool exists
        {
            let tools_guard = self.tools.read().await;
            if !tools_guard.contains_key(tool_name) {
                return Err(MCPError::ToolNotFound(tool_name.to_string()));
            }
        }
        
        let request = self.create_jsonrpc_request("tools/call", json!({
            "name": tool_name,
            "arguments": arguments
        }));
        
        let response = self.send_request(&request).await?;
        
        let result = response.get("result")
            .ok_or_else(|| MCPError::Protocol("Missing result in tool call response".to_string()))?;
        
        // Check for errors
        if let Some(error) = result.get("error") {
            let error_msg = error.get("message")
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown error");
            return Err(MCPError::Server(error_msg.to_string()));
        }
        
        // Return content
        let content = result.get("content")
            .cloned()
            .unwrap_or_else(|| json!(null));
        
        Ok(content)
    }
    
    /// Read an MCP resource
    #[instrument(skip(self))]
    pub async fn read_resource(&self, uri: &str) -> Result<MCPResourceContent, MCPError> {
        debug!("Reading MCP resource: {}", uri);
        
        let request = self.create_jsonrpc_request("resources/read", json!({
            "uri": uri
        }));
        
        let response = self.send_request(&request).await?;
        
        let result = response.get("result")
            .ok_or_else(|| MCPError::Protocol("Missing result in resource read response".to_string()))?;
        
        let contents = result.get("contents")
            .and_then(|v| v.as_array())
            .ok_or_else(|| MCPError::Protocol("Missing contents array".to_string()))?;
        
        if contents.is_empty() {
            return Err(MCPError::Server("Resource has no content".to_string()));
        }
        
        let first_content = &contents[0];
        
        let mime_type = first_content.get("mimeType")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        
        let text = first_content.get("text")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        
        let blob = first_content.get("blob")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        
        Ok(MCPResourceContent {
            uri: uri.to_string(),
            mime_type,
            text,
            blob,
        })
    }
    
    /// Get cached tools
    pub async fn get_tools(&self) -> HashMap<String, MCPTool> {
        self.tools.read().await.clone()
    }
    
    /// Get cached resources
    pub async fn get_resources(&self) -> Vec<MCPResource> {
        self.resources.read().await.clone()
    }
    
    /// Create a JSON-RPC request
    fn create_jsonrpc_request(&self, method: &str, params: Value) -> Value {
        let id = {
            let mut id_guard = self.request_id.blocking_write();
            *id_guard += 1;
            *id_guard
        };
        
        json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": method,
            "params": params
        })
    }
    
    /// Send a JSON-RPC request to the server
    async fn send_request(&self, request: &Value) -> Result<Value, MCPError> {
        let url = format!("{}/rpc", self.config.url);
        
        let mut request_builder = self.client
            .post(&url)
            .header("Content-Type", "application/json");
        
        // Add auth token if present
        if let Some(token) = &self.config.auth_token {
            request_builder = request_builder.header("Authorization", format!("Bearer {}", token));
        }
        
        // Add custom headers
        for (key, value) in &self.config.headers {
            request_builder = request_builder.header(key, value);
        }
        
        let response = request_builder
            .json(request)
            .send()
            .await
            .map_err(|e| MCPError::Connection(e.to_string()))?;
        
        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(MCPError::Server(format!("HTTP {}: {}", status, body)));
        }
        
        let json_response: Value = response.json().await
            .map_err(|e| MCPError::Serialization(e.to_string()))?;
        
        // Check for JSON-RPC error
        if let Some(error) = json_response.get("error") {
            let error_msg = error.get("message")
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown JSON-RPC error");
            return Err(MCPError::Server(error_msg.to_string()));
        }
        
        Ok(json_response)
    }
}

/// Result of MCP initialization
#[derive(Debug, Clone)]
pub struct MCPInitializeResult {
    pub protocol_version: String,
    pub capabilities: Value,
}

/// Content of an MCP resource
#[derive(Debug, Clone)]
pub struct MCPResourceContent {
    pub uri: String,
    pub mime_type: Option<String>,
    pub text: Option<String>,
    pub blob: Option<String>,
}

/// MCP client pool for managing multiple servers
pub struct MCPClientPool {
    clients: Arc<RwLock<HashMap<String, MCPClient>>>,
}

impl Default for MCPClientPool {
    fn default() -> Self {
        Self::new()
    }
}

impl MCPClientPool {
    /// Create a new empty pool
    pub fn new() -> Self {
        Self {
            clients: Arc::new(RwLock::new(HashMap::new())),
        }
    }
    
    /// Add a client to the pool
    pub async fn add_client(&self, config: MCPServerConfig) -> Result<(), MCPError> {
        let client = MCPClient::new(config.clone())?;
        
        // Initialize the client
        client.initialize().await?;
        
        let mut clients_guard = self.clients.write().await;
        clients_guard.insert(config.name.clone(), client);
        
        info!("Added MCP client for server: {}", config.name);
        
        Ok(())
    }
    
    /// Get a client by name
    pub async fn get_client(&self, name: &str) -> Option<MCPClient> {
        let clients_guard = self.clients.read().await;
        clients_guard.get(name).cloned()
    }
    
    /// Get all client names
    pub async fn list_clients(&self) -> Vec<String> {
        let clients_guard = self.clients.read().await;
        clients_guard.keys().cloned().collect()
    }
    
    /// Remove a client
    pub async fn remove_client(&self, name: &str) {
        let mut clients_guard = self.clients.write().await;
        clients_guard.remove(name);
    }
    
    /// Call a tool on a specific server
    pub async fn call_tool(&self, server: &str, tool: &str, arguments: Value) -> Result<Value, MCPError> {
        let clients_guard = self.clients.read().await;
        let client = clients_guard.get(server)
            .ok_or_else(|| MCPError::ToolNotFound(format!("Server '{}' not found", server)))?;
        
        // Need to clone for the async call since we're holding the read lock
        let client_clone = MCPClient {
            client: client.client.clone(),
            config: client.config.clone(),
            tools: client.tools.clone(),
            resources: client.resources.clone(),
            request_id: client.request_id.clone(),
        };
        
        // Drop the lock before making the call
        drop(clients_guard);
        
        client_clone.call_tool(tool, arguments).await
    }
}

// Manual Clone implementation for MCPClient
impl Clone for MCPClient {
    fn clone(&self) -> Self {
        Self {
            client: self.client.clone(),
            config: self.config.clone(),
            tools: self.tools.clone(),
            resources: self.resources.clone(),
            request_id: self.request_id.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_server_config_serialization() {
        let config = MCPServerConfig {
            name: "test-server".to_string(),
            url: "http://localhost:3000".to_string(),
            auth_token: Some("secret".to_string()),
            timeout_secs: 30,
            use_streaming: false,
            headers: HashMap::new(),
        };
        
        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("test-server"));
        assert!(json.contains("localhost:3000"));
    }
    
    #[test]
    fn test_mcp_tool_serialization() {
        let tool = MCPTool {
            name: "test-tool".to_string(),
            description: "A test tool".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "input": { "type": "string" }
                }
            }),
            output_schema: None,
        };
        
        let json = serde_json::to_string(&tool).unwrap();
        assert!(json.contains("test-tool"));
    }
}

