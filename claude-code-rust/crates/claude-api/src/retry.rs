//! Retry logic with exponential backoff for API requests

use std::time::Duration;
use thiserror::Error;
use tokio::time::sleep;

/// Errors that can occur during retry operations
#[derive(Debug, Error)]
pub enum RetryError {
    #[error("Max retries exceeded")]
    MaxRetriesExceeded,

    #[error("Request failed: {0}")]
    RequestFailed(String),

    #[error("Rate limited: {0}")]
    RateLimited(String),
}

/// Configuration for retry behavior
#[derive(Debug, Clone)]
pub struct RetryConfig {
    /// Maximum number of retry attempts
    pub max_retries: u32,
    /// Initial backoff duration
    pub initial_backoff: Duration,
    /// Maximum backoff duration
    pub max_backoff: Duration,
    /// Multiplier for exponential backoff
    pub backoff_multiplier: f64,
    /// Whether to retry on rate limit errors
    pub retry_on_rate_limit: bool,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_retries: 3,
            initial_backoff: Duration::from_secs(2),  // Increased from 500ms to 2s
            max_backoff: Duration::from_secs(60),
            backoff_multiplier: 2.0,
            retry_on_rate_limit: true,
        }
    }
}

impl RetryConfig {
    /// Create a new retry configuration
    pub fn new() -> Self {
        Self::default()
    }

    /// Set the maximum number of retries
    pub fn with_max_retries(mut self, max_retries: u32) -> Self {
        self.max_retries = max_retries;
        self
    }

    /// Set the initial backoff duration
    pub fn with_initial_backoff(mut self, duration: Duration) -> Self {
        self.initial_backoff = duration;
        self
    }

    /// Set the maximum backoff duration
    pub fn with_max_backoff(mut self, duration: Duration) -> Self {
        self.max_backoff = duration;
        self
    }

    /// Set the backoff multiplier
    pub fn with_backoff_multiplier(mut self, multiplier: f64) -> Self {
        self.backoff_multiplier = multiplier;
        self
    }

    /// Calculate the backoff duration for a given attempt
    pub fn backoff_duration(&self, attempt: u32) -> Duration {
        if attempt == 0 {
            return Duration::from_secs(0);
        }

        let backoff_secs = self.initial_backoff.as_secs_f64()
            * self.backoff_multiplier.powi(attempt as i32 - 1);

        let backoff = Duration::from_secs_f64(backoff_secs);

        backoff.min(self.max_backoff)
    }
}

/// Strategy for determining if a request should be retried
pub trait RetryStrategy {
    /// Determine if the request should be retried based on the error
    fn should_retry(&self, error: &reqwest::Error) -> bool;
}

/// Default retry strategy
pub struct DefaultRetryStrategy;

impl RetryStrategy for DefaultRetryStrategy {
    fn should_retry(&self, error: &reqwest::Error) -> bool {
        // Retry on network errors
        if error.is_timeout() || error.is_connect() {
            return true;
        }

        // Retry on server errors (5xx)
        if let Some(status) = error.status() {
            if status.is_server_error() {
                return true;
            }

            // Retry on rate limit (429)
            if status.as_u16() == 429 {
                return true;
            }

            // Retry on 408 Request Timeout
            if status.as_u16() == 408 {
                return true;
            }
        }

        false
    }
}

/// Execute a request with retry logic
pub async fn with_retry<F, Fut, T, E>(
    config: &RetryConfig,
    _strategy: &impl RetryStrategy,
    mut operation: F,
) -> Result<T, RetryError>
where
    F: FnMut() -> Fut,
    Fut: std::future::Future<Output = Result<T, E>>,
    E: std::fmt::Display,
{
    let mut attempt = 0;

    loop {
        match operation().await {
            Ok(result) => return Ok(result),
            Err(e) => {
                attempt += 1;

                if attempt > config.max_retries {
                    return Err(RetryError::MaxRetriesExceeded);
                }

                // Calculate backoff and wait
                let backoff = config.backoff_duration(attempt);

                eprintln!(
                    "Request failed (attempt {}/{}): {}. Retrying in {:?}...",
                    attempt, config.max_retries, e, backoff
                );

                sleep(backoff).await;
            }
        }
    }
}

/// Execute an HTTP request with retry logic
pub async fn with_http_retry<F, Fut>(
    config: &RetryConfig,
    mut operation: F,
) -> Result<reqwest::Response, RetryError>
where
    F: FnMut() -> Fut,
    Fut: std::future::Future<Output = Result<reqwest::Response, reqwest::Error>>,
{
    let strategy = DefaultRetryStrategy;
    let mut attempt = 0;

    loop {
        match operation().await {
            Ok(response) => return Ok(response),
            Err(e) => {
                if !strategy.should_retry(&e) {
                    return Err(RetryError::RequestFailed(e.to_string()));
                }

                attempt += 1;

                if attempt > config.max_retries {
                    return Err(RetryError::MaxRetriesExceeded);
                }

                // Check for rate limit headers
                let backoff = if let Some(status) = e.status() {
                    if status.as_u16() == 429 {
                        // For rate limits, use a longer backoff
                        config.max_backoff
                    } else {
                        config.backoff_duration(attempt)
                    }
                } else {
                    config.backoff_duration(attempt)
                };

                eprintln!(
                    "HTTP request failed (attempt {}/{}): {}. Retrying in {:?}...",
                    attempt, config.max_retries, e, backoff
                );

                sleep(backoff).await;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = RetryConfig::default();
        assert_eq!(config.max_retries, 3);
        assert_eq!(config.initial_backoff, Duration::from_secs(2));
    }

    #[test]
    fn test_backoff_calculation() {
        let config = RetryConfig::default();

        assert_eq!(config.backoff_duration(0), Duration::from_secs(0));
        assert_eq!(config.backoff_duration(1), Duration::from_secs(2));
        assert_eq!(config.backoff_duration(2), Duration::from_secs(4));
        assert_eq!(config.backoff_duration(3), Duration::from_secs(8));
    }

    #[test]
    fn test_backoff_max() {
        let config = RetryConfig::default()
            .with_max_backoff(Duration::from_secs(5));

        // Should be capped at max_backoff
        assert!(config.backoff_duration(10) <= Duration::from_secs(5));
    }

    #[tokio::test]
    async fn test_retry_success() {
        let config = RetryConfig::default();
        let strategy = DefaultRetryStrategy;

        let attempts = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let attempts_clone = attempts.clone();
        let result = with_retry(&config, &strategy, || {
            let attempts = attempts_clone.clone();
            async move {
                let attempt_count = attempts.fetch_add(1, std::sync::atomic::Ordering::SeqCst) + 1;
                if attempt_count < 2 {
                    Err("temporary error")
                } else {
                    Ok("success")
                }
            }
        }).await;

        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "success");
        assert_eq!(attempts.load(std::sync::atomic::Ordering::SeqCst), 2);
    }

    #[tokio::test]
    async fn test_retry_max_exceeded() {
        let config = RetryConfig::default().with_max_retries(2);
        let strategy = DefaultRetryStrategy;

        let result = with_retry(&config, &strategy, || async {
            Err::<(), _>("persistent error")
        }).await;

        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), RetryError::MaxRetriesExceeded));
    }
}
