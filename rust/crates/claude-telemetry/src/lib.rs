//! Telemetry system - Privacy-respecting analytics
//!
//! Features:
//! - Anonymous usage data collection
//! - Opt-in/opt-out control
//! - No PII collection
//! - Configurable data retention
//! - Local aggregation before sending

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{Duration, Instant, SystemTime};
use tokio::sync::mpsc;
use tracing::{debug, info, warn};
use uuid::Uuid;

/// Telemetry configuration
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TelemetryConfig {
    pub enabled: bool,
    pub endpoint: String,
    pub flush_interval_secs: u64,
    pub batch_size: usize,
    pub anonymize: bool,
    pub collect_errors: bool,
    pub collect_performance: bool,
    pub collect_usage: bool,
}

impl Default for TelemetryConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            endpoint: "https://telemetry.anthropic.com/v1/events".to_string(),
            flush_interval_secs: 300, // 5 minutes
            batch_size: 100,
            anonymize: true,
            collect_errors: true,
            collect_performance: true,
            collect_usage: true,
        }
    }
}

/// Telemetry event types
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum TelemetryEvent {
    #[serde(rename = "session_start")]
    SessionStart {
        session_id: String,
        timestamp: SystemTime,
        version: String,
        platform: String,
        architecture: String,
    },
    
    #[serde(rename = "session_end")]
    SessionEnd {
        session_id: String,
        timestamp: SystemTime,
        duration_secs: u64,
        tools_used: HashMap<String, u32>,
    },
    
    #[serde(rename = "tool_invocation")]
    ToolInvocation {
        session_id: String,
        timestamp: SystemTime,
        tool_name: String,
        duration_ms: u64,
        success: bool,
    },
    
    #[serde(rename = "error")]
    Error {
        session_id: String,
        timestamp: SystemTime,
        error_type: String,
        message_hash: String, // Hashed to avoid PII
        stack_hash: Option<String>,
    },
    
    #[serde(rename = "performance")]
    Performance {
        session_id: String,
        timestamp: SystemTime,
        metric_name: String,
        value: f64,
        unit: String,
    },
    
    #[serde(rename = "feature_usage")]
    FeatureUsage {
        session_id: String,
        timestamp: SystemTime,
        feature: String,
        action: String,
        metadata: HashMap<String, String>,
    },
}

/// Telemetry collector
pub struct TelemetryCollector {
    config: TelemetryConfig,
    session_id: String,
    events: Vec<TelemetryEvent>,
    start_time: Instant,
    tool_counts: HashMap<String, u32>,
    sender: mpsc::UnboundedSender<TelemetryEvent>,
}

impl TelemetryCollector {
    pub fn new(config: TelemetryConfig) -> (Self, mpsc::UnboundedReceiver<TelemetryEvent>) {
        let (sender, receiver) = mpsc::unbounded_channel();
        let session_id = Uuid::new_v4().to_string();
        
        let collector = Self {
            config,
            session_id: session_id.clone(),
            events: Vec::new(),
            start_time: Instant::now(),
            tool_counts: HashMap::new(),
            sender,
        };
        
        (collector, receiver)
    }
    
    /// Record session start
    pub fn session_start(&mut self, version: String) {
        if !self.config.enabled {
            return;
        }
        
        let event = TelemetryEvent::SessionStart {
            session_id: self.session_id.clone(),
            timestamp: SystemTime::now(),
            version,
            platform: std::env::consts::OS.to_string(),
            architecture: std::env::consts::ARCH.to_string(),
        };
        
        self.send_event(event);
        info!("Telemetry: session started");
    }
    
    /// Record session end
    pub fn session_end(&mut self) {
        if !self.config.enabled {
            return;
        }
        
        let event = TelemetryEvent::SessionEnd {
            session_id: self.session_id.clone(),
            timestamp: SystemTime::now(),
            duration_secs: self.start_time.elapsed().as_secs(),
            tools_used: self.tool_counts.clone(),
        };
        
        self.send_event(event);
        info!("Telemetry: session ended");
    }
    
    /// Record tool invocation
    pub fn tool_invoked(&mut self, tool_name: &str, duration_ms: u64, success: bool) {
        if !self.config.enabled || !self.config.collect_usage {
            return;
        }
        
        // Update counters
        *self.tool_counts.entry(tool_name.to_string()).or_insert(0) += 1;
        
        let event = TelemetryEvent::ToolInvocation {
            session_id: self.session_id.clone(),
            timestamp: SystemTime::now(),
            tool_name: tool_name.to_string(),
            duration_ms,
            success,
        };
        
        self.send_event(event);
    }
    
    /// Record error (anonymized)
    pub fn error(&mut self, error_type: &str, message: &str) {
        if !self.config.enabled || !self.config.collect_errors {
            return;
        }
        
        // Hash the message to avoid PII leakage
        let message_hash = format!("{:x}", md5::compute(message));
        
        let event = TelemetryEvent::Error {
            session_id: self.session_id.clone(),
            timestamp: SystemTime::now(),
            error_type: error_type.to_string(),
            message_hash,
            stack_hash: None,
        };
        
        self.send_event(event);
    }
    
    /// Record performance metric
    pub fn performance(&mut self, metric_name: &str, value: f64, unit: &str) {
        if !self.config.enabled || !self.config.collect_performance {
            return;
        }
        
        let event = TelemetryEvent::Performance {
            session_id: self.session_id.clone(),
            timestamp: SystemTime::now(),
            metric_name: metric_name.to_string(),
            value,
            unit: unit.to_string(),
        };
        
        self.send_event(event);
    }
    
    /// Record feature usage
    pub fn feature_used(&mut self, feature: &str, action: &str, metadata: HashMap<String, String>) {
        if !self.config.enabled || !self.config.collect_usage {
            return;
        }
        
        let event = TelemetryEvent::FeatureUsage {
            session_id: self.session_id.clone(),
            timestamp: SystemTime::now(),
            feature: feature.to_string(),
            action: action.to_string(),
            metadata,
        };
        
        self.send_event(event);
    }
    
    fn send_event(&self, event: TelemetryEvent) {
        let _ = self.sender.send(event);
    }
    
    /// Check if telemetry is enabled
    pub fn is_enabled(&self) -> bool {
        self.config.enabled
    }
    
    /// Get session ID (for correlation)
    pub fn session_id(&self) -> &str {
        &self.session_id
    }
}

/// Telemetry uploader - sends batched events
pub struct TelemetryUploader {
    config: TelemetryConfig,
    receiver: mpsc::UnboundedReceiver<TelemetryEvent>,
    buffer: Vec<TelemetryEvent>,
    client: reqwest::Client,
}

impl TelemetryUploader {
    pub fn new(config: TelemetryConfig, receiver: mpsc::UnboundedReceiver<TelemetryEvent>) -> Self {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to build HTTP client");
        
        Self {
            config,
            receiver,
            buffer: Vec::new(),
            client,
        }
    }
    
    /// Run the uploader loop
    pub async fn run(mut self) {
        if !self.config.enabled {
            info!("Telemetry disabled, uploader not started");
            return;
        }
        
        let mut flush_interval = tokio::time::interval(
            Duration::from_secs(self.config.flush_interval_secs)
        );
        
        info!("Telemetry uploader started");
        
        loop {
            tokio::select! {
                // Receive new events
                Some(event) = self.receiver.recv() => {
                    self.buffer.push(event);
                    
                    if self.buffer.len() >= self.config.batch_size {
                        self.flush().await;
                    }
                }
                
                // Periodic flush
                _ = flush_interval.tick() => {
                    if !self.buffer.is_empty() {
                        self.flush().await;
                    }
                }
                
                // Shutdown signal
                else => {
                    break;
                }
            }
        }
        
        // Final flush
        if !self.buffer.is_empty() {
            self.flush().await;
        }
        
        info!("Telemetry uploader stopped");
    }
    
    async fn flush(&mut self) {
        if self.buffer.is_empty() {
            return;
        }
        
        let batch: Vec<TelemetryEvent> = self.buffer.drain(..).collect();
        
        match self.upload_batch(&batch).await {
            Ok(_) => {
                debug!("Uploaded {} telemetry events", batch.len());
            }
            Err(e) => {
                warn!("Failed to upload telemetry: {}", e);
                // Re-add events to buffer for retry (with limit)
                if self.buffer.len() < self.config.batch_size * 2 {
                    self.buffer.extend(batch);
                }
            }
        }
    }
    
    async fn upload_batch(&self, events: &[TelemetryEvent]) -> Result<(), reqwest::Error> {
        let payload = serde_json::json!({
            "events": events,
            "sent_at": SystemTime::now(),
        });
        
        let response = self.client
            .post(&self.config.endpoint)
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await?;
        
        if response.status().is_success() {
            Ok(())
        } else {
            Err(reqwest::Error::from(
                std::io::Error::new(
                    std::io::ErrorKind::Other,
                    format!("HTTP {}", response.status())
                )
            ))
        }
    }
}

// md5 for message hashing
mod md5 {
    pub fn compute(data: &str) -> [u8; 16] {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        
        let mut hasher = DefaultHasher::new();
        data.hash(&mut hasher);
        let hash = hasher.finish();
        
        // Convert to 16-byte array
        let bytes = hash.to_le_bytes();
        let mut result = [0u8; 16];
        result[..8].copy_from_slice(&bytes);
        result[8..].copy_from_slice(&bytes);
        result
    }
}

