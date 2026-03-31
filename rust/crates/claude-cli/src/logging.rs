//! Logging initialization

use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

/// Initialize logging
pub fn init(level: &str) -> anyhow::Result<()> {
    let filter = EnvFilter::try_new(format!("claude_code={}", level))?;
    
    tracing_subscriber::registry()
        .with(filter)
        .with(tracing_subscriber::fmt::layer())
        .init();
    
    Ok(())
}

