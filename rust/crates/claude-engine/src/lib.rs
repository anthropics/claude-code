//! Claude Engine - Core orchestration and query processing

pub mod engine;
pub mod events;
pub mod state;
pub mod streaming;
pub mod tool_orchestrator;

pub use engine::QueryEngine;
pub use events::{EngineEvent, EventHandler};
pub use state::AppState;
pub use streaming::{StreamConsumer, StreamingHandler, StringConsumer};
pub use tool_orchestrator::{OrchestrationStrategy, ToolOrchestrator, ToolRegistry};

