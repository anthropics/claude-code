//! Full terminal UI for Claude Code (ratatui-based)
//!
//! This replaces the React/Ink TypeScript UI with a native Rust implementation.

pub mod app;
pub mod components;
pub mod events;
pub mod input;
pub mod layout;
pub mod rendering;
pub mod state;
pub mod theme;
pub mod widgets;

pub use app::TuiApp;
pub use events::{Event, EventHandler};
pub use state::{InputMode, TuiState, View};
pub use theme::Theme;

