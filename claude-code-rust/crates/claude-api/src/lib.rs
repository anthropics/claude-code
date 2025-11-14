//! Anthropic API client library with streaming support
//!
//! This crate provides a Rust client for the Anthropic Messages API, including:
//! - Full support for streaming responses via Server-Sent Events (SSE)
//! - Automatic retry logic with exponential backoff
//! - Type-safe request and response models
//! - Tool use and multi-modal message support
//!
//! # Examples
//!
//! ## Creating a non-streaming message
//!
//! ```no_run
//! use claude_api::{AnthropicClient, ClientConfig, MessageRequestBuilder, Model};
//!
//! #[tokio::main]
//! async fn main() -> Result<(), Box<dyn std::error::Error>> {
//!     let config = ClientConfig::new("your-api-key");
//!     let client = AnthropicClient::new(config)?;
//!
//!     let request = MessageRequestBuilder::new(Model::Sonnet)
//!         .user("What is the capital of France?")
//!         .system("You are a helpful geography assistant")
//!         .max_tokens(1024)
//!         .build();
//!
//!     let response = client.create_message(request).await?;
//!     println!("Response: {:?}", response);
//!
//!     Ok(())
//! }
//! ```
//!
//! ## Streaming a message
//!
//! ```no_run
//! use claude_api::{AnthropicClient, ClientConfig, MessageRequestBuilder, Model};
//! use futures::StreamExt;
//!
//! #[tokio::main]
//! async fn main() -> Result<(), Box<dyn std::error::Error>> {
//!     let config = ClientConfig::new("your-api-key");
//!     let client = AnthropicClient::new(config)?;
//!
//!     let request = MessageRequestBuilder::new(Model::Sonnet)
//!         .user("Write a short poem about Rust")
//!         .max_tokens(1024)
//!         .build();
//!
//!     let mut stream = client.create_message_stream(request).await?;
//!
//!     while let Some(item) = stream.next().await {
//!         match item? {
//!             claude_api::streaming::MessageStreamItem::TextDelta { text, .. } => {
//!                 print!("{}", text);
//!             }
//!             _ => {}
//!         }
//!     }
//!
//!     Ok(())
//! }
//! ```

// Re-export main types
pub mod client;
pub mod models;
pub mod retry;
pub mod streaming;

// Re-export commonly used types at the crate root
pub use client::{
    AnthropicClient, ClientConfig, ClientError, MessageRequestBuilder,
    DEFAULT_API_VERSION, DEFAULT_BASE_URL, DEFAULT_TIMEOUT,
};

pub use models::{
    ContentBlock, CreateMessageRequest, ImageSource, Message, MessageResponse,
    Model, Role, StreamEvent, Tool, Usage,
};

pub use retry::{RetryConfig, RetryError, RetryStrategy};

pub use streaming::{MessageStream, MessageStreamItem, SseStream, StreamError};

/// Prelude module for convenient imports
pub mod prelude {
    pub use crate::client::{AnthropicClient, ClientConfig, MessageRequestBuilder};
    pub use crate::models::{ContentBlock, CreateMessageRequest, Message, Model, Role, Tool};
    pub use crate::streaming::{MessageStream, MessageStreamItem};
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_exports() {
        // Ensure main types are accessible
        let _: AnthropicClient;
        let _: ClientConfig;
        let _: Model;
        let _: Message;
    }
}
