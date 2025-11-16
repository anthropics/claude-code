//! Server-Sent Events (SSE) streaming support for the Anthropic API

use crate::models::StreamEvent;
use bytes::Bytes;
use futures::stream::Stream;
use pin_project::pin_project;
use std::pin::Pin;
use std::task::{Context, Poll};
use thiserror::Error;

/// Errors that can occur during streaming
#[derive(Debug, Error)]
pub enum StreamError {
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),

    #[error("JSON parse error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("UTF-8 decode error: {0}")]
    Utf8(#[from] std::string::FromUtf8Error),

    #[error("Invalid SSE format: {0}")]
    InvalidFormat(String),

    #[error("Stream ended unexpectedly")]
    UnexpectedEnd,
}

/// A stream of Server-Sent Events
#[pin_project]
pub struct SseStream {
    #[pin]
    inner: Pin<Box<dyn Stream<Item = Result<Bytes, reqwest::Error>> + Send>>,
    buffer: Vec<u8>,
}

impl SseStream {
    /// Create a new SSE stream from an HTTP response
    pub fn new(response: reqwest::Response) -> Self {
        Self {
            inner: Box::pin(response.bytes_stream()),
            buffer: Vec::new(),
        }
    }

    /// Parse SSE data into events
    fn parse_event(data: &str) -> Result<Option<StreamEvent>, StreamError> {
        // SSE events come in the format:
        // event: <event_type>
        // data: <json_data>
        //
        // For Anthropic API, we primarily care about the data field

        let mut event_type: Option<&str> = None;
        let mut data_lines: Vec<&str> = Vec::new();

        for line in data.lines() {
            if line.starts_with("event:") {
                event_type = Some(line[6..].trim());
            } else if line.starts_with("data:") {
                data_lines.push(line[5..].trim());
            }
        }

        if data_lines.is_empty() {
            return Ok(None);
        }

        let data_str = data_lines.join("\n");

        // Handle ping events
        if event_type == Some("ping") || data_str == "{}" || data_str.is_empty() {
            return Ok(Some(StreamEvent::Ping));
        }

        // Parse JSON data
        let event: StreamEvent = serde_json::from_str(&data_str).map_err(|e| {
            StreamError::InvalidFormat(format!("Failed to parse event: {} (data: {})", e, data_str))
        })?;

        Ok(Some(event))
    }
}

impl Stream for SseStream {
    type Item = Result<StreamEvent, StreamError>;

    fn poll_next(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        let mut this = self.project();

        loop {
            // Try to get the next chunk from the response
            match this.inner.as_mut().poll_next(cx) {
                Poll::Ready(Some(Ok(chunk))) => {
                    // Add chunk to buffer
                    this.buffer.extend_from_slice(chunk.as_ref());

                    // Look for complete SSE events (separated by \n\n)
                    if let Some(pos) = this.buffer.windows(2).position(|w| w == b"\n\n") {
                        // Extract the event data
                        let event_data = this.buffer.drain(..pos + 2).collect::<Vec<_>>();

                        // Parse the event
                        let event_str = String::from_utf8(event_data).map_err(StreamError::Utf8)?;

                        match Self::parse_event(&event_str) {
                            Ok(Some(event)) => return Poll::Ready(Some(Ok(event))),
                            Ok(None) => continue, // Skip empty events
                            Err(e) => return Poll::Ready(Some(Err(e))),
                        }
                    }
                    // If we don't have a complete event yet, continue polling
                }
                Poll::Ready(Some(Err(e))) => {
                    return Poll::Ready(Some(Err(StreamError::Http(e))));
                }
                Poll::Ready(None) => {
                    // Stream ended - check if we have any remaining data in buffer
                    if !this.buffer.is_empty() {
                        let event_str =
                            String::from_utf8(this.buffer.clone()).map_err(StreamError::Utf8)?;
                        this.buffer.clear();

                        if !event_str.trim().is_empty() {
                            match Self::parse_event(&event_str) {
                                Ok(Some(event)) => return Poll::Ready(Some(Ok(event))),
                                Ok(None) => {}
                                Err(e) => return Poll::Ready(Some(Err(e))),
                            }
                        }
                    }
                    return Poll::Ready(None);
                }
                Poll::Pending => return Poll::Pending,
            }
        }
    }
}

/// A high-level stream that yields complete messages and text deltas
#[pin_project]
pub struct MessageStream {
    #[pin]
    sse_stream: SseStream,
    current_message_id: Option<String>,
    accumulated_text: String,
    accumulated_json: String,
}

impl MessageStream {
    /// Create a new message stream from an SSE stream
    pub fn new(sse_stream: SseStream) -> Self {
        Self {
            sse_stream,
            current_message_id: None,
            accumulated_text: String::new(),
            accumulated_json: String::new(),
        }
    }

    /// Create a message stream directly from an HTTP response
    pub fn from_response(response: reqwest::Response) -> Self {
        Self::new(SseStream::new(response))
    }
}

impl Stream for MessageStream {
    type Item = Result<MessageStreamItem, StreamError>;

    fn poll_next(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        let mut this = self.project();

        match this.sse_stream.as_mut().poll_next(cx) {
            Poll::Ready(Some(Ok(event))) => {
                let item = match event {
                    StreamEvent::MessageStart { message } => {
                        *this.current_message_id = Some(message.id.clone());
                        MessageStreamItem::MessageStart(message)
                    }
                    StreamEvent::ContentBlockStart {
                        index,
                        content_block,
                    } => {
                        this.accumulated_text.clear();
                        this.accumulated_json.clear();
                        MessageStreamItem::ContentBlockStart {
                            index,
                            content_block,
                        }
                    }
                    StreamEvent::ContentBlockDelta { index, delta } => match delta {
                        crate::models::ContentBlockDelta::TextDelta { text } => {
                            this.accumulated_text.push_str(&text);
                            MessageStreamItem::TextDelta { index, text }
                        }
                        crate::models::ContentBlockDelta::InputJsonDelta { partial_json } => {
                            this.accumulated_json.push_str(&partial_json);
                            MessageStreamItem::InputJsonDelta {
                                index,
                                partial_json,
                            }
                        }
                    },
                    StreamEvent::ContentBlockStop { index } => {
                        MessageStreamItem::ContentBlockStop { index }
                    }
                    StreamEvent::MessageDelta { delta, usage } => {
                        MessageStreamItem::MessageDelta { delta, usage }
                    }
                    StreamEvent::MessageStop => {
                        let message_id = this.current_message_id.take();
                        MessageStreamItem::MessageStop { message_id }
                    }
                    StreamEvent::Ping => {
                        // Skip ping events and continue polling
                        cx.waker().wake_by_ref();
                        return Poll::Pending;
                    }
                    StreamEvent::Error { error } => MessageStreamItem::Error(error),
                };
                Poll::Ready(Some(Ok(item)))
            }
            Poll::Ready(Some(Err(e))) => Poll::Ready(Some(Err(e))),
            Poll::Ready(None) => Poll::Ready(None),
            Poll::Pending => Poll::Pending,
        }
    }
}

/// Items yielded by the MessageStream
#[derive(Debug, Clone)]
pub enum MessageStreamItem {
    MessageStart(crate::models::MessageStart),
    ContentBlockStart {
        index: usize,
        content_block: crate::models::ContentBlockStart,
    },
    TextDelta {
        index: usize,
        text: String,
    },
    InputJsonDelta {
        index: usize,
        partial_json: String,
    },
    ContentBlockStop {
        index: usize,
    },
    MessageDelta {
        delta: crate::models::MessageDelta,
        usage: crate::models::Usage,
    },
    MessageStop {
        message_id: Option<String>,
    },
    Error(crate::models::ApiError),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_sse_event() {
        let data = r#"event: message_start
data: {"type":"message_start","message":{"id":"msg_123","type":"message","role":"assistant","content":[],"model":"claude-3-5-sonnet-20241022","stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":10,"output_tokens":1}}}"#;

        let event = SseStream::parse_event(data).unwrap();
        assert!(event.is_some());
    }

    #[test]
    fn test_parse_ping() {
        let data = "event: ping\ndata: {}";
        let event = SseStream::parse_event(data).unwrap();
        assert!(matches!(event, Some(StreamEvent::Ping)));
    }

    #[test]
    fn test_parse_text_delta() {
        let data = r#"event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}"#;

        let event = SseStream::parse_event(data).unwrap();
        assert!(event.is_some());
    }
}
