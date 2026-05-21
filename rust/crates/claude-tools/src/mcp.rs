//! MCP (Model Context Protocol) tool integration

use async_trait::async_trait;
use claude_core::{ClaudeError, ClaudeResult, PermissionResult, Tool, ToolContext, ToolDefinition, ToolInput, ToolOutput, ToolProgress, ToolValidation};
use serde_json::json;
use tracing::{info, instrument, warn};

/// MCP tool for calling MCP servers
pub struct MCPTool {
    definition: ToolDefinition,
    /// MCP server endpoint
    server_url: String,
}

impl MCPTool {
    /// Create new MCP tool
    pub fn new() -> Self {
        Self {
            definition: ToolDefinition::new(
                "MCP",
                "Call tools via the Model Context Protocol (MCP). Integrates with external tool servers."
            )
            .with_schema(json!({
                "type": "object",
                "required": ["server", "tool", "arguments"],
                "properties": {
                    "server": {
                        "type": "string",
                        "description": "MCP server name or URL"
                    },
                    "tool": {
                        "type": "string",
                        "description": "Tool name to call"
                    },
                    "arguments": {
                        "type": "object",
                        "description": "Tool arguments"
                    }
                }
            }))
            .with_alias("mcp"),
            server_url: std::env::var("MCP_SERVER_URL")
                .unwrap_or_else(|_| "http://localhost:3000".to_string()),
        }
    }
    
    /// Set server URL
    pub fn with_server(mut self, url: impl Into<String>) -> Self {
        self.server_url = url.into();
        self
    }
}

impl Default for MCPTool {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Tool for MCPTool {
    fn definition(&self) -> &ToolDefinition {
        &self.definition
    }
    
    fn validate(&self, input: &ToolInput) -> ToolValidation {
        let has_server = input.get_string("server").map(|s| !s.is_empty()).unwrap_or(false);
        let has_tool = input.get_string("tool").map(|t| !t.is_empty()).unwrap_or(false);
        let has_args = input.input.get("arguments").is_some();
        
        if !has_server {
            return ToolValidation::Invalid("server is required".to_string());
        }
        
        if !has_tool {
            return ToolValidation::Invalid("tool is required".to_string());
        }
        
        if !has_args {
            return ToolValidation::Invalid("arguments is required".to_string());
        }
        
        ToolValidation::Valid
    }
    
    fn check_permission(&self, input: &ToolInput, ctx: &ToolContext) -> PermissionResult {
        // MCP calls need confirmation unless in auto-yes mode
        if ctx.permission.mode == claude_core::PermissionMode::AutoYes {
            return PermissionResult::Allowed;
        }
        
        let server = input.get_string("server").unwrap_or_default();
        let tool = input.get_string("tool").unwrap_or_default();
        
        PermissionResult::NeedsConfirmation {
            action: format!("Call MCP tool '{}' on server '{}'", tool, server),
        }
    }
    
    #[instrument(skip(self, input, context))]
    async fn execute(&self, input: ToolInput, context: ToolContext) -> ClaudeResult<ToolOutput> {
        let server = input.get_string("server")
            .ok_or_else(|| ClaudeError::validation("server", "Required parameter missing"))?;
        
        let tool = input.get_string("tool")
            .ok_or_else(|| ClaudeError::validation("tool", "Required parameter missing"))?;
        
        let arguments = input.input.get("arguments")
            .cloned()
            .unwrap_or_else(|| json!({}));
        
        info!("Calling MCP tool '{}' on server '{}'", tool, server);
        
        // Placeholder implementation - would make HTTP request to MCP server
        // in production
        
        Ok(ToolOutput {
            content: format!(
                "MCP call to '{}' on '{}' with arguments: {}\n\n[MCP integration would make actual call to MCP server]",
                tool,
                server,
                arguments
            ),
            is_error: false,
            metadata: Some(json!({
                "server": server,
                "tool": tool,
                "arguments": arguments,
            })),
            suggestions: Some(vec![
                "Configure MCP_SERVER_URL environment variable".to_string(),
                "Ensure MCP server is running".to_string(),
            ]),
            progress: Vec::new(),
        })
    }
}

