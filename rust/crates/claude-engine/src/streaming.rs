//! Streaming response handler

use claude_api::StreamEvent;
use tokio::sync::mpsc;
use tracing::trace;

/// Streaming handler for real-time response processing
pub struct StreamingHandler {
    /// Event receiver
    rx: mpsc::UnboundedReceiver<StreamEvent>,
    /// Accumulated content
    content: String,
    /// Callback for tokens
    token_callback: Option<Box<dyn Fn(&str) + Send>>,
}

impl StreamingHandler {
    /// Create new streaming handler
    pub fn new(rx: mpsc::UnboundedReceiver<StreamEvent>) -> Self {
        Self {
            rx,
            content: String::new(),
            token_callback: None,
        }
    }
    
    /// Set token callback
    pub fn on_token<F>(&mut self, callback: F)
    where
        F: Fn(&str) + Send + 'static,
    {
        self.token_callback = Some(Box::new(callback));
    }
    
    /// Process stream and return complete content
    pub async fn process(mut self) -> anyhow::Result<String> {
        while let Some(event) = self.rx.recv().await {
            trace!("Processing stream event: {:?}", event);
            
            match event {
                StreamEvent::ContentBlockDelta { delta, .. } => {
                    if let Some(text) = delta.get("text").and_then(|t| t.as_str()) {
                        self.content.push_str(text);
                        
                        if let Some(ref callback) = self.token_callback {
                            callback(text);
                        }
                    }
                }
                StreamEvent::MessageStop => {
                    break;
                }
                StreamEvent::Error { error } => {
                    return Err(anyhow::anyhow!("Stream error: {}", error));
                }
                _ => {}
            }
        }
        
        Ok(self.content)
    }
    
    /// Get accumulated content so far
    pub fn content(&self) -> &str {
        &self.content
    }
    
    /// Check if stream is complete
    pub fn is_complete(&self) -> bool {
        // This would need a completion flag in practice
        false
    }
}

/// Real-time stream consumer trait
pub trait StreamConsumer: Send {
    /// Handle a token
    fn on_token(&mut self, token: &str);
    
    /// Handle stream start
    fn on_start(&mut self);
    
    /// Handle stream end
    fn on_end(&mut self);
    
    /// Handle error
    fn on_error(&mut self, error: &str);
}

/// Simple string consumer
pub struct StringConsumer {
    content: String,
}

impl StringConsumer {
    /// Create new consumer
    pub fn new() -> Self {
        Self {
            content: String::new(),
        }
    }
    
    /// Get content
    pub fn content(self) -> String {
        self.content
    }
}

impl StreamConsumer for StringConsumer {
    fn on_token(&mut self, token: &str) {
        self.content.push_str(token);
    }
    
    fn on_start(&mut self) {}
    
    fn on_end(&mut self) {}
    
    fn on_error(&mut self, _error: &str) {}
}

impl Default for StringConsumer {
    fn default() -> Self {
        Self::new()
    }
}

