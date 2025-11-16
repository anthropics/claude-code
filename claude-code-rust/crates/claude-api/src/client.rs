//! Anthropic API client implementation

use crate::models::{CreateMessageRequest, MessageResponse, Model};
use crate::retry::{with_http_retry, RetryConfig};
use crate::streaming::MessageStream;
use reqwest::{Client, ClientBuilder};
use std::time::Duration;
use thiserror::Error;

/// Default API base URL
pub const DEFAULT_BASE_URL: &str = "https://api.anthropic.com";

/// Default API version
pub const DEFAULT_API_VERSION: &str = "2023-06-01";

/// Default timeout for requests
pub const DEFAULT_TIMEOUT: Duration = Duration::from_secs(60);

/// Errors that can occur when using the API client
#[derive(Debug, Error)]
pub enum ClientError {
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("API error: {0}")]
    Api(String),

    #[error("Authentication error: missing or invalid API key")]
    Authentication,

    #[error("Invalid response: {0}")]
    InvalidResponse(String),

    #[error("Retry error: {0}")]
    Retry(#[from] crate::retry::RetryError),
}

/// Result type for client operations
pub type Result<T> = std::result::Result<T, ClientError>;

/// Configuration for the Anthropic API client
#[derive(Debug, Clone)]
pub struct ClientConfig {
    /// API key for authentication
    pub api_key: String,
    /// Base URL for the API
    pub base_url: String,
    /// API version header
    pub api_version: String,
    /// Request timeout
    pub timeout: Duration,
    /// Retry configuration
    pub retry_config: RetryConfig,
}

impl ClientConfig {
    /// Create a new client configuration with the given API key
    pub fn new(api_key: impl Into<String>) -> Self {
        Self {
            api_key: api_key.into(),
            base_url: DEFAULT_BASE_URL.to_string(),
            api_version: DEFAULT_API_VERSION.to_string(),
            timeout: DEFAULT_TIMEOUT,
            retry_config: RetryConfig::default(),
        }
    }

    /// Set the base URL
    pub fn with_base_url(mut self, base_url: impl Into<String>) -> Self {
        self.base_url = base_url.into();
        self
    }

    /// Set the API version
    pub fn with_api_version(mut self, api_version: impl Into<String>) -> Self {
        self.api_version = api_version.into();
        self
    }

    /// Set the request timeout
    pub fn with_timeout(mut self, timeout: Duration) -> Self {
        self.timeout = timeout;
        self
    }

    /// Set the retry configuration
    pub fn with_retry_config(mut self, retry_config: RetryConfig) -> Self {
        self.retry_config = retry_config;
        self
    }
}

/// Anthropic API client
pub struct AnthropicClient {
    config: ClientConfig,
    http_client: Client,
}

impl AnthropicClient {
    /// Create a new Anthropic API client
    pub fn new(config: ClientConfig) -> Result<Self> {
        let http_client = ClientBuilder::new().timeout(config.timeout).build()?;

        Ok(Self {
            config,
            http_client,
        })
    }

    /// Create a client with just an API key (using default configuration)
    pub fn from_api_key(api_key: impl Into<String>) -> Result<Self> {
        Self::new(ClientConfig::new(api_key))
    }

    /// Get the messages endpoint URL
    fn messages_url(&self) -> String {
        format!("{}/v1/messages", self.config.base_url)
    }

    /// Build the request headers
    fn build_headers(&self) -> reqwest::header::HeaderMap {
        let mut headers = reqwest::header::HeaderMap::new();

        headers.insert(
            "x-api-key",
            reqwest::header::HeaderValue::from_str(&self.config.api_key).expect("Invalid API key"),
        );

        headers.insert(
            "anthropic-version",
            reqwest::header::HeaderValue::from_str(&self.config.api_version)
                .expect("Invalid API version"),
        );

        headers.insert(
            reqwest::header::CONTENT_TYPE,
            reqwest::header::HeaderValue::from_static("application/json"),
        );

        headers
    }

    /// Create a message (non-streaming)
    pub async fn create_message(&self, request: CreateMessageRequest) -> Result<MessageResponse> {
        let url = self.messages_url();
        let headers = self.build_headers();

        // Ensure streaming is disabled
        let mut request = request;
        request.stream = Some(false);

        let response = with_http_retry(&self.config.retry_config, || async {
            self.http_client
                .post(&url)
                .headers(headers.clone())
                .json(&request)
                .send()
                .await
        })
        .await?;

        // Check for errors
        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(ClientError::Api(format!(
                "API request failed with status {}: {}",
                status, error_text
            )));
        }

        let message = response.json::<MessageResponse>().await?;
        Ok(message)
    }

    /// Create a message with streaming
    pub async fn create_message_stream(
        &self,
        request: CreateMessageRequest,
    ) -> Result<MessageStream> {
        let url = self.messages_url();
        let headers = self.build_headers();

        // Ensure streaming is enabled
        let mut request = request;
        request.stream = Some(true);

        let response = with_http_retry(&self.config.retry_config, || async {
            self.http_client
                .post(&url)
                .headers(headers.clone())
                .json(&request)
                .send()
                .await
        })
        .await?;

        // Check for errors
        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(ClientError::Api(format!(
                "API request failed with status {}: {}",
                status, error_text
            )));
        }

        Ok(MessageStream::from_response(response))
    }

    /// Get the default model
    pub fn default_model() -> Model {
        Model::Sonnet
    }

    /// Get the Sonnet model
    pub fn sonnet() -> Model {
        Model::Sonnet
    }

    /// Get the Haiku model
    pub fn haiku() -> Model {
        Model::Haiku
    }

    /// Get the Opus model
    pub fn opus() -> Model {
        Model::Opus
    }
}

/// Builder for creating message requests
pub struct MessageRequestBuilder {
    model: Model,
    messages: Vec<crate::models::Message>,
    max_tokens: u32,
    system: Option<String>,
    temperature: Option<f32>,
    tools: Option<Vec<crate::models::Tool>>,
}

impl MessageRequestBuilder {
    /// Create a new message request builder
    pub fn new(model: Model) -> Self {
        Self {
            model,
            messages: Vec::new(),
            max_tokens: 4096,
            system: None,
            temperature: None,
            tools: None,
        }
    }

    /// Add a user message
    pub fn user(mut self, content: impl Into<String>) -> Self {
        self.messages.push(crate::models::Message::user(content));
        self
    }

    /// Add an assistant message
    pub fn assistant(mut self, content: impl Into<String>) -> Self {
        self.messages
            .push(crate::models::Message::assistant(content));
        self
    }

    /// Add a message
    pub fn message(mut self, message: crate::models::Message) -> Self {
        self.messages.push(message);
        self
    }

    /// Set the system prompt
    pub fn system(mut self, system: impl Into<String>) -> Self {
        self.system = Some(system.into());
        self
    }

    /// Set the maximum number of tokens
    pub fn max_tokens(mut self, max_tokens: u32) -> Self {
        self.max_tokens = max_tokens;
        self
    }

    /// Set the temperature
    pub fn temperature(mut self, temperature: f32) -> Self {
        self.temperature = Some(temperature);
        self
    }

    /// Set the tools
    pub fn tools(mut self, tools: Vec<crate::models::Tool>) -> Self {
        self.tools = Some(tools);
        self
    }

    /// Build the request
    pub fn build(self) -> CreateMessageRequest {
        let mut request = CreateMessageRequest::new(self.model, self.messages, self.max_tokens);

        if let Some(system) = self.system {
            request = request.with_system(system);
        }

        if let Some(temperature) = self.temperature {
            request = request.with_temperature(temperature);
        }

        if let Some(tools) = self.tools {
            request = request.with_tools(tools);
        }

        request
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_client_config() {
        let config = ClientConfig::new("test-key")
            .with_base_url("https://example.com")
            .with_timeout(Duration::from_secs(30));

        assert_eq!(config.api_key, "test-key");
        assert_eq!(config.base_url, "https://example.com");
        assert_eq!(config.timeout, Duration::from_secs(30));
    }

    #[test]
    fn test_messages_url() {
        let config = ClientConfig::new("test-key");
        let client = AnthropicClient::new(config).unwrap();

        assert_eq!(
            client.messages_url(),
            "https://api.anthropic.com/v1/messages"
        );
    }

    #[test]
    fn test_message_request_builder() {
        let request = MessageRequestBuilder::new(Model::Sonnet)
            .user("Hello")
            .system("You are a helpful assistant")
            .max_tokens(1000)
            .temperature(0.7)
            .build();

        assert_eq!(request.messages.len(), 1);
        assert_eq!(request.max_tokens, 1000);
        assert_eq!(
            request.system,
            Some("You are a helpful assistant".to_string())
        );
        assert_eq!(request.temperature, Some(0.7));
    }

    #[test]
    fn test_model_selection() {
        assert_eq!(
            AnthropicClient::default_model().as_str(),
            "claude-sonnet-4-5-20250929"
        );
        assert_eq!(
            AnthropicClient::sonnet().as_str(),
            "claude-sonnet-4-5-20250929"
        );
        assert_eq!(
            AnthropicClient::haiku().as_str(),
            "claude-3-5-haiku-20241022"
        );
        assert_eq!(AnthropicClient::opus().as_str(), "claude-opus-4-20250514");
    }
}
