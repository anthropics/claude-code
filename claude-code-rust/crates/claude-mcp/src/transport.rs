//! Transport layer for MCP communication
//!
//! This module provides stdio-based transport for JSON-RPC 2.0 messages.
//! Messages are sent as line-delimited JSON over stdin/stdout.

use serde::{Deserialize, Serialize};
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, ChildStdout, Command};
use tokio::sync::mpsc;

use crate::protocol::{JsonRpcNotification, JsonRpcRequest, JsonRpcResponse};

/// Errors that can occur during transport operations
#[derive(Debug, thiserror::Error)]
pub enum TransportError {
    /// IO error
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    /// Serialization error
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    /// Process error
    #[error("Process error: {0}")]
    Process(String),

    /// Channel error
    #[error("Channel error: {0}")]
    Channel(String),

    /// Transport closed
    #[error("Transport closed")]
    Closed,
}

pub type TransportResult<T> = Result<T, TransportError>;

/// A message that can be sent over the transport
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Message {
    /// JSON-RPC Request
    Request(JsonRpcRequest),
    /// JSON-RPC Response
    Response(JsonRpcResponse),
    /// JSON-RPC Notification
    Notification(JsonRpcNotification),
}

/// Stdio transport for communicating with MCP servers/clients
///
/// This transport uses line-delimited JSON over stdin/stdout to communicate
/// with external processes.
pub struct StdioTransport {
    /// Child process handle
    process: Option<Child>,

    /// Channel for sending messages to the process
    write_tx: mpsc::UnboundedSender<Message>,

    /// Channel for receiving messages from the process
    read_rx: mpsc::UnboundedReceiver<Message>,

    /// Handle to the reader task
    reader_handle: Option<tokio::task::JoinHandle<()>>,

    /// Handle to the writer task
    writer_handle: Option<tokio::task::JoinHandle<()>>,
}

impl StdioTransport {
    /// Create a new stdio transport by spawning a command
    pub async fn spawn(command: &str, args: &[String]) -> TransportResult<Self> {
        let mut child = Command::new(command)
            .args(args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .kill_on_drop(true)
            .spawn()?;

        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| TransportError::Process("Failed to get stdin".to_string()))?;

        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| TransportError::Process("Failed to get stdout".to_string()))?;

        Self::new(Some(child), stdin, stdout)
    }

    /// Create a new stdio transport from existing stdin/stdout
    ///
    /// This is useful for implementing MCP servers that communicate over stdio
    pub fn new(
        process: Option<Child>,
        stdin: ChildStdin,
        stdout: ChildStdout,
    ) -> TransportResult<Self> {
        let (write_tx, write_rx) = mpsc::unbounded_channel();
        let (read_tx, read_rx) = mpsc::unbounded_channel();

        // Spawn reader task
        let reader_handle = tokio::spawn(Self::reader_task(stdout, read_tx));

        // Spawn writer task
        let writer_handle = tokio::spawn(Self::writer_task(stdin, write_rx));

        Ok(Self {
            process,
            write_tx,
            read_rx,
            reader_handle: Some(reader_handle),
            writer_handle: Some(writer_handle),
        })
    }

    /// Reader task that reads messages from stdout
    async fn reader_task(
        stdout: ChildStdout,
        tx: mpsc::UnboundedSender<Message>,
    ) {
        let mut reader = BufReader::new(stdout);
        let mut line = String::new();

        loop {
            line.clear();

            match reader.read_line(&mut line).await {
                Ok(0) => {
                    // EOF
                    tracing::debug!("Transport reader: EOF");
                    break;
                }
                Ok(_) => {
                    let trimmed = line.trim();
                    if trimmed.is_empty() {
                        continue;
                    }

                    tracing::trace!("Transport received: {}", trimmed);

                    match serde_json::from_str::<Message>(trimmed) {
                        Ok(message) => {
                            if tx.send(message).is_err() {
                                tracing::debug!("Transport reader: receiver closed");
                                break;
                            }
                        }
                        Err(e) => {
                            tracing::warn!("Failed to parse message: {} - line: {}", e, trimmed);
                        }
                    }
                }
                Err(e) => {
                    tracing::error!("Transport reader error: {}", e);
                    break;
                }
            }
        }
    }

    /// Writer task that writes messages to stdin
    async fn writer_task(
        mut stdin: ChildStdin,
        mut rx: mpsc::UnboundedReceiver<Message>,
    ) {
        while let Some(message) = rx.recv().await {
            match serde_json::to_string(&message) {
                Ok(json) => {
                    tracing::trace!("Transport sending: {}", json);

                    let line = format!("{}\n", json);
                    if let Err(e) = stdin.write_all(line.as_bytes()).await {
                        tracing::error!("Transport write error: {}", e);
                        break;
                    }

                    if let Err(e) = stdin.flush().await {
                        tracing::error!("Transport flush error: {}", e);
                        break;
                    }
                }
                Err(e) => {
                    tracing::error!("Failed to serialize message: {}", e);
                }
            }
        }
    }

    /// Send a message over the transport
    pub fn send(&self, message: Message) -> TransportResult<()> {
        self.write_tx
            .send(message)
            .map_err(|_| TransportError::Closed)
    }

    /// Receive a message from the transport
    pub async fn receive(&mut self) -> TransportResult<Message> {
        self.read_rx
            .recv()
            .await
            .ok_or(TransportError::Closed)
    }

    /// Close the transport and wait for the process to exit
    pub async fn close(self) -> TransportResult<()> {
        // Close is handled by the Drop implementation
        // This method exists to provide async cleanup if needed
        Ok(())
    }

    /// Check if the process is still running
    pub fn is_running(&mut self) -> bool {
        if let Some(ref mut process) = self.process {
            process.try_wait().ok().flatten().is_none()
        } else {
            true // No process means we're using stdio directly
        }
    }
}

impl Drop for StdioTransport {
    fn drop(&mut self) {
        // Abort background tasks
        if let Some(handle) = self.reader_handle.take() {
            handle.abort();
        }

        if let Some(handle) = self.writer_handle.take() {
            handle.abort();
        }

        // Kill process if still running
        if let Some(mut process) = self.process.take() {
            let _ = process.start_kill();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::{RequestId, JsonRpcRequest};
    use serde_json::json;

    #[test]
    fn test_message_serialization() {
        let req = JsonRpcRequest::new(
            RequestId::from(1),
            "test",
            json!({"key": "value"}),
        );

        let msg = Message::Request(req);
        let json = serde_json::to_string(&msg).unwrap();

        assert!(json.contains("\"method\":\"test\""));
        assert!(json.contains("\"jsonrpc\":\"2.0\""));
    }

    #[test]
    fn test_message_deserialization() {
        let json = r#"{"jsonrpc":"2.0","id":1,"method":"test","params":{}}"#;
        let msg: Message = serde_json::from_str(json).unwrap();

        match msg {
            Message::Request(req) => {
                assert_eq!(req.method, "test");
                assert_eq!(req.jsonrpc, "2.0");
            }
            _ => panic!("Expected request message"),
        }
    }
}
