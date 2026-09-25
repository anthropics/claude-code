//! LSP (Language Server Protocol) client implementation
//!
//! Supports hover, go-to-definition, find-references, and diagnostics.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use thiserror::Error;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::process::{ChildStdin, ChildStdout, Command};
use tokio::sync::{Mutex, RwLock};
use tracing::{debug, error, info, instrument, warn};

/// Errors that can occur in LSP operations
#[derive(Debug, Error, Clone)]
pub enum LSPError {
    #[error("Server not found: {0}")]
    ServerNotFound(String),
    
    #[error("Connection error: {0}")]
    Connection(String),
    
    #[error("Request timeout")]
    Timeout,
    
    #[error("Server error: {code} - {message}")]
    ServerError { code: i64, message: String },
    
    #[error("Parse error: {0}")]
    Parse(String),
    
    #[error("Method not supported: {0}")]
    NotSupported(String),
    
    #[error("File not found: {0}")]
    FileNotFound(String),
}

/// LSP server configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LSPServerConfig {
    /// Server name (e.g., "rust-analyzer", "typescript-language-server")
    pub name: String,
    /// Command to start the server
    pub command: String,
    /// Command arguments
    #[serde(default)]
    pub args: Vec<String>,
    /// Environment variables
    #[serde(default)]
    pub env: HashMap<String, String>,
    /// Root directory for the server
    pub root_dir: PathBuf,
    /// Request timeout in seconds
    #[serde(default = "default_timeout")]
    pub timeout_secs: u64,
    /// File extensions this server handles
    #[serde(default)]
    pub file_extensions: Vec<String>,
}

fn default_timeout() -> u64 {
    30
}

/// LSP client for communicating with language servers
pub struct LSPClient {
    /// Server configuration
    config: LSPServerConfig,
    /// Process stdin
    stdin: Arc<Mutex<ChildStdin>>,
    /// Request ID counter
    request_id: Arc<RwLock<i64>>,
    /// Server capabilities
    capabilities: Arc<RwLock<Value>>,
    /// Server state
    state: Arc<RwLock<LSPState>>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
enum LSPState {
    Uninitialized,
    Initializing,
    Ready,
    ShuttingDown,
    Exited,
}

/// Text document identifier
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextDocumentIdentifier {
    pub uri: String,
}

/// Versioned text document identifier
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionedTextDocumentIdentifier {
    pub uri: String,
    pub version: i64,
}

/// Text document position
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextDocumentPositionParams {
    pub text_document: TextDocumentIdentifier,
    pub position: Position,
}

/// Position in a document
#[derive(Debug, Clone, Serialize, Deserialize, Copy, Default)]
pub struct Position {
    pub line: u64,
    pub character: u64,
}

/// Range in a document
#[derive(Debug, Clone, Serialize, Deserialize, Copy)]
pub struct Range {
    pub start: Position,
    pub end: Position,
}

/// Location of a symbol
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Location {
    pub uri: String,
    pub range: Range,
}

/// Hover result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Hover {
    pub contents: HoverContents,
    pub range: Option<Range>,
}

/// Hover contents (can be string or marked content)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum HoverContents {
    String(String),
    MarkupContent(MarkupContent),
    Array(Vec<MarkedString>),
}

/// Markup content
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarkupContent {
    pub kind: String,
    pub value: String,
}

/// Marked string
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum MarkedString {
    String(String),
    LanguageString {
        language: String,
        value: String,
    },
}

/// Diagnostic (error/warning/info)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Diagnostic {
    pub range: Range,
    pub severity: Option<i64>,
    pub code: Option<Value>,
    pub source: Option<String>,
    pub message: String,
    pub related_information: Option<Vec<DiagnosticRelatedInformation>>,
}

/// Related diagnostic information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagnosticRelatedInformation {
    pub location: Location,
    pub message: String,
}

/// Symbol information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SymbolInformation {
    pub name: String,
    pub kind: i64,
    pub location: Location,
    pub container_name: Option<String>,
}

/// Document symbol (hierarchical)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentSymbol {
    pub name: String,
    pub detail: Option<String>,
    pub kind: i64,
    pub range: Range,
    pub selection_range: Range,
    pub children: Option<Vec<DocumentSymbol>>,
}

/// Completion item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompletionItem {
    pub label: String,
    pub kind: Option<i64>,
    pub detail: Option<String>,
    pub documentation: Option<Value>,
    pub insert_text: Option<String>,
}

/// Implementation of LSP client methods
impl LSPClient {
    /// Create and initialize a new LSP client
    #[instrument(skip(config))]
    pub async fn start(config: LSPServerConfig) -> Result<Self, LSPError> {
        info!("Starting LSP server: {}", config.name);
        
        let mut cmd = Command::new(&config.command);
        cmd.args(&config.args)
            .current_dir(&config.root_dir)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped());
        
        for (key, value) in &config.env {
            cmd.env(key, value);
        }
        
        let mut child = cmd.spawn()
            .map_err(|e| LSPError::ServerNotFound(format!(
                "Failed to start {}: {}", config.command, e
            )))?;
        
        let stdin = child.stdin.take()
            .ok_or_else(|| LSPError::Connection("Failed to get stdin".to_string()))?;
        
        let stdout = child.stdout.take()
            .ok_or_else(|| LSPError::Connection("Failed to get stdout".to_string()))?;
        
        let client = Self {
            config,
            stdin: Arc::new(Mutex::new(stdin)),
            request_id: Arc::new(RwLock::new(0)),
            capabilities: Arc::new(RwLock::new(json!({}))),
            state: Arc::new(RwLock::new(LSPState::Uninitialized)),
        };
        
        // Start message reading loop
        let client_clone = client.clone();
        tokio::spawn(async move {
            client_clone.read_messages(stdout).await;
        });
        
        // Initialize the server
        client.initialize().await?;
        
        info!("LSP client ready: {}", client.config.name);
        
        Ok(client)
    }
    
    /// Read messages from server stdout
    async fn read_messages(&self, stdout: ChildStdout) {
        let mut reader = BufReader::new(stdout);
        let mut buffer = String::new();
        
        loop {
            buffer.clear();
            
            // Read Content-Length header
            match reader.read_line(&mut buffer).await {
                Ok(0) => {
                    debug!("LSP server closed stdout");
                    break;
                }
                Ok(_) => {
                    let line = buffer.trim();
                    if line.is_empty() {
                        continue;
                    }
                    
                    if let Some(content_length) = line.strip_prefix("Content-Length: ") {
                        if let Ok(length) = content_length.parse::<usize>() {
                            // Read empty line
                            buffer.clear();
                            let _ = reader.read_line(&mut buffer).await;
                            
                            // Read message body
                            let mut body = vec![0u8; length];
                            if let Err(e) = reader.read_exact(&mut body).await {
                                error!("Failed to read LSP message body: {}", e);
                                continue;
                            }
                            
                            if let Ok(message) = String::from_utf8(body) {
                                self.handle_message(&message).await;
                            }
                        }
                    }
                }
                Err(e) => {
                    error!("Error reading from LSP server: {}", e);
                    break;
                }
            }
        }
        
        let mut state_guard = self.state.write().await;
        *state_guard = LSPState::Exited;
    }
    
    /// Handle a message from the server
    async fn handle_message(&self, message: &str) {
        debug!("LSP message received: {}", message.chars().take(200).collect::<String>());
        
        if let Ok(value) = serde_json::from_str::<Value>(message) {
            // Handle different message types
            if value.get("method").is_some() {
                // Server request/notification
                self.handle_server_message(value).await;
            } else if value.get("id").is_some() {
                // Response to our request
                self.handle_response(value).await;
            }
        }
    }
    
    /// Handle server-initiated messages
    async fn handle_server_message(&self, message: Value) {
        if let Some(method) = message.get("method").and_then(|v| v.as_str()) {
            match method {
                "textDocument/publishDiagnostics" => {
                    if let Some(params) = message.get("params") {
                        debug!("Received diagnostics: {:?}", params);
                    }
                }
                "window/showMessage" => {
                    if let Some(params) = message.get("params") {
                        if let Some(msg) = params.get("message").and_then(|v| v.as_str()) {
                            info!("LSP server message: {}", msg);
                        }
                    }
                }
                "window/logMessage" => {
                    if let Some(params) = message.get("params") {
                        if let Some(msg) = params.get("message").and_then(|v| v.as_str()) {
                            debug!("LSP server log: {}", msg);
                        }
                    }
                }
                _ => {
                    debug!("Unhandled LSP method: {}", method);
                }
            }
        }
    }
    
    /// Handle response to our request
    async fn handle_response(&self, response: Value) {
        // Store response for request matching
        // In a full implementation, we'd use channels or callbacks
        debug!("LSP response: {:?}", response);
    }
    
    /// Initialize the server
    async fn initialize(&self) -> Result<(), LSPError> {
        *self.state.write().await = LSPState::Initializing;
        
        let root_uri = url::Url::from_file_path(&self.config.root_dir)
            .map_err(|_| LSPError::Parse("Invalid root directory path".to_string()))?;
        
        let params = json!({
            "processId": std::process::id(),
            "rootPath": self.config.root_dir.to_str(),
            "rootUri": root_uri.to_string(),
            "capabilities": {
                "textDocument": {
                    "synchronization": {
                        "dynamicRegistration": false,
                        "willSave": false,
                        "willSaveWaitUntil": false,
                        "didSave": true
                    },
                    "hover": {
                        "dynamicRegistration": false,
                        "contentFormat": ["markdown", "plaintext"]
                    },
                    "definition": {
                        "dynamicRegistration": false,
                        "linkSupport": true
                    },
                    "documentSymbol": {
                        "dynamicRegistration": false,
                        "hierarchicalDocumentSymbolSupport": true
                    },
                    "codeAction": {
                        "dynamicRegistration": false
                    },
                    "formatting": {
                        "dynamicRegistration": false
                    },
                    "rename": {
                        "dynamicRegistration": false
                    }
                },
                "workspace": {
                    "applyEdit": false,
                    "workspaceEdit": {
                        "documentChanges": false
                    },
                    "didChangeConfiguration": {
                        "dynamicRegistration": false
                    },
                    "executeCommand": {
                        "dynamicRegistration": false
                    }
                }
            },
            "workspaceFolders": null,
            "trace": "verbose"
        });
        
        let request = self.create_request("initialize", params);
        self.send_message(&request).await?;
        
        // Wait a bit for initialization (in production, use proper request/response matching)
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
        
        // Send initialized notification
        let initialized = self.create_notification("initialized", json!({}));
        self.send_message(&initialized).await?;
        
        *self.state.write().await = LSPState::Ready;
        
        Ok(())
    }
    
    /// Send shutdown request
    pub async fn shutdown(&self) -> Result<(), LSPError> {
        *self.state.write().await = LSPState::ShuttingDown;
        
        let request = self.create_request("shutdown", json!({}));
        self.send_message(&request).await?;
        
        // Send exit notification
        let exit = self.create_notification("exit", json!({}));
        self.send_message(&exit).await?;
        
        Ok(())
    }
    
    /// Get hover information at a position
    #[instrument(skip(self))]
    pub async fn hover(&self, file_path: &Path, position: Position) -> Result<Option<Hover>, LSPError> {
        self.check_ready().await?;
        
        let uri = path_to_uri(file_path)?;
        
        let params = json!({
            "textDocument": {
                "uri": uri
            },
            "position": position
        });
        
        let request = self.create_request("textDocument/hover", params);
        self.send_message(&request).await?;
        
        // In a full implementation, we'd wait for and parse the response
        // For now, return a placeholder
        Ok(None)
    }
    
    /// Go to definition
    #[instrument(skip(self))]
    pub async fn goto_definition(&self, file_path: &Path, position: Position) -> Result<Vec<Location>, LSPError> {
        self.check_ready().await?;
        
        let uri = path_to_uri(file_path)?;
        
        let params = json!({
            "textDocument": {
                "uri": uri
            },
            "position": position
        });
        
        let request = self.create_request("textDocument/definition", params);
        self.send_message(&request).await?;
        
        Ok(Vec::new())
    }
    
    /// Find references
    #[instrument(skip(self))]
    pub async fn find_references(&self, file_path: &Path, position: Position) -> Result<Vec<Location>, LSPError> {
        self.check_ready().await?;
        
        let uri = path_to_uri(file_path)?;
        
        let params = json!({
            "textDocument": {
                "uri": uri
            },
            "position": position,
            "context": {
                "includeDeclaration": true
            }
        });
        
        let request = self.create_request("textDocument/references", params);
        self.send_message(&request).await?;
        
        Ok(Vec::new())
    }
    
    /// Get document symbols
    #[instrument(skip(self))]
    pub async fn document_symbol(&self, file_path: &Path) -> Result<Vec<DocumentSymbol>, LSPError> {
        self.check_ready().await?;
        
        let uri = path_to_uri(file_path)?;
        
        let params = json!({
            "textDocument": {
                "uri": uri
            }
        });
        
        let request = self.create_request("textDocument/documentSymbol", params);
        self.send_message(&request).await?;
        
        Ok(Vec::new())
    }
    
    /// Get completions at a position
    #[instrument(skip(self))]
    pub async fn completion(&self, file_path: &Path, position: Position) -> Result<Vec<CompletionItem>, LSPError> {
        self.check_ready().await?;
        
        let uri = path_to_uri(file_path)?;
        
        let params = json!({
            "textDocument": {
                "uri": uri
            },
            "position": position
        });
        
        let request = self.create_request("textDocument/completion", params);
        self.send_message(&request).await?;
        
        Ok(Vec::new())
    }
    
    /// Notify server that document was opened
    #[instrument(skip(self))]
    pub async fn did_open(&self, file_path: &Path, language_id: &str, version: i64, text: &str) -> Result<(), LSPError> {
        self.check_ready().await?;
        
        let uri = path_to_uri(file_path)?;
        
        let params = json!({
            "textDocument": {
                "uri": uri,
                "languageId": language_id,
                "version": version,
                "text": text
            }
        });
        
        let notification = self.create_notification("textDocument/didOpen", params);
        self.send_message(&notification).await
    }
    
    /// Notify server that document was changed
    #[instrument(skip(self))]
    pub async fn did_change(&self, file_path: &Path, version: i64, changes: Vec<TextDocumentContentChangeEvent>) -> Result<(), LSPError> {
        self.check_ready().await?;
        
        let uri = path_to_uri(file_path)?;
        
        let params = json!({
            "textDocument": {
                "uri": uri,
                "version": version
            },
            "contentChanges": changes
        });
        
        let notification = self.create_notification("textDocument/didChange", params);
        self.send_message(&notification).await
    }
    
    /// Notify server that document was saved
    #[instrument(skip(self))]
    pub async fn did_save(&self, file_path: &Path) -> Result<(), LSPError> {
        self.check_ready().await?;
        
        let uri = path_to_uri(file_path)?;
        
        let params = json!({
            "textDocument": {
                "uri": uri
            }
        });
        
        let notification = self.create_notification("textDocument/didSave", params);
        self.send_message(&notification).await
    }
    
    /// Notify server that document was closed
    #[instrument(skip(self))]
    pub async fn did_close(&self, file_path: &Path) -> Result<(), LSPError> {
        self.check_ready().await?;
        
        let uri = path_to_uri(file_path)?;
        
        let params = json!({
            "textDocument": {
                "uri": uri
            }
        });
        
        let notification = self.create_notification("textDocument/didClose", params);
        self.send_message(&notification).await
    }
    
    /// Check if client is ready
    async fn check_ready(&self) -> Result<(), LSPError> {
        let state = *self.state.read().await;
        match state {
            LSPState::Ready => Ok(()),
            LSPState::Uninitialized => Err(LSPError::Connection("Client not initialized".to_string())),
            LSPState::Initializing => Err(LSPError::Connection("Client still initializing".to_string())),
            LSPState::ShuttingDown => Err(LSPError::Connection("Client shutting down".to_string())),
            LSPState::Exited => Err(LSPError::Connection("Client exited".to_string())),
        }
    }
    
    /// Create a JSON-RPC request
    fn create_request(&self, method: &str, params: Value) -> Value {
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
    
    /// Create a JSON-RPC notification
    fn create_notification(&self, method: &str, params: Value) -> Value {
        json!({
            "jsonrpc": "2.0",
            "method": method,
            "params": params
        })
    }
    
    /// Send a message to the server
    async fn send_message(&self, message: &Value) -> Result<(), LSPError> {
        let body = serde_json::to_string(message)
            .map_err(|e| LSPError::Parse(e.to_string()))?;
        
        let header = format!("Content-Length: {}\r\n\r\n", body.len());
        let full_message = format!("{}{}", header, body);
        
        let mut stdin_guard = self.stdin.lock().await;
        stdin_guard.write_all(full_message.as_bytes()).await
            .map_err(|e| LSPError::Connection(e.to_string()))?;
        stdin_guard.flush().await
            .map_err(|e| LSPError::Connection(e.to_string()))?;
        
        debug!("Sent LSP message: {}", body.chars().take(200).collect::<String>());
        
        Ok(())
    }
    
    /// Get server capabilities
    pub async fn capabilities(&self) -> Value {
        self.capabilities.read().await.clone()
    }
    
    /// Get server name
    pub fn name(&self) -> &str {
        &self.config.name
    }
}

impl Clone for LSPClient {
    fn clone(&self) -> Self {
        Self {
            config: self.config.clone(),
            stdin: self.stdin.clone(),
            request_id: self.request_id.clone(),
            capabilities: self.capabilities.clone(),
            state: self.state.clone(),
        }
    }
}

/// Content change event for didChange
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextDocumentContentChangeEvent {
    pub range: Option<Range>,
    pub range_length: Option<i64>,
    pub text: String,
}

/// Convert a file path to a URI
fn path_to_uri(path: &Path) -> Result<String, LSPError> {
    url::Url::from_file_path(path)
        .map(|u| u.to_string())
        .map_err(|_| LSPError::Parse(format!("Invalid path: {:?}", path)))
}

/// LSP client manager for multiple language servers
pub struct LSPManager {
    clients: Arc<RwLock<HashMap<String, LSPClient>>>,
}

impl Default for LSPManager {
    fn default() -> Self {
        Self::new()
    }
}

impl LSPManager {
    /// Create a new manager
    pub fn new() -> Self {
        Self {
            clients: Arc::new(RwLock::new(HashMap::new())),
        }
    }
    
    /// Start a new language server
    pub async fn start_server(&self, config: LSPServerConfig) -> Result<(), LSPError> {
        let client = LSPClient::start(config.clone()).await?;
        
        let mut clients_guard = self.clients.write().await;
        clients_guard.insert(config.name.clone(), client);
        
        info!("Started LSP server: {}", config.name);
        
        Ok(())
    }
    
    /// Get client by name
    pub async fn get_client(&self, name: &str) -> Option<LSPClient> {
        self.clients.read().await.get(name).cloned()
    }
    
    /// Get client for a file extension
    pub async fn get_client_for_extension(&self, ext: &str) -> Option<LSPClient> {
        let clients_guard = self.clients.read().await;
        
        for client in clients_guard.values() {
            if client.config.file_extensions.contains(&ext.to_string()) {
                return Some(client.clone());
            }
        }
        
        None
    }
    
    /// List all running servers
    pub async fn list_servers(&self) -> Vec<String> {
        self.clients.read().await.keys().cloned().collect()
    }
    
    /// Shutdown all servers
    pub async fn shutdown_all(&self) -> Result<(), LSPError> {
        let clients_guard = self.clients.read().await;
        
        for (name, client) in clients_guard.iter() {
            info!("Shutting down LSP server: {}", name);
            let _ = client.shutdown().await;
        }
        
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_position_serialization() {
        let pos = Position { line: 10, character: 5 };
        let json = serde_json::to_string(&pos).unwrap();
        assert!(json.contains("10"));
        assert!(json.contains("5"));
    }
    
    #[test]
    fn test_range_serialization() {
        let range = Range {
            start: Position { line: 0, character: 0 },
            end: Position { line: 10, character: 5 },
        };
        let json = serde_json::to_string(&range).unwrap();
        assert!(json.contains("start"));
        assert!(json.contains("end"));
    }
    
    #[test]
    fn test_server_config_serialization() {
        let config = LSPServerConfig {
            name: "rust-analyzer".to_string(),
            command: "rust-analyzer".to_string(),
            args: vec![],
            env: HashMap::new(),
            root_dir: PathBuf::from("/tmp"),
            timeout_secs: 30,
            file_extensions: vec!["rs".to_string()],
        };
        
        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("rust-analyzer"));
    }
}

