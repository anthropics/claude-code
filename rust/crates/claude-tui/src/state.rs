//! TUI State Management

use std::collections::VecDeque;

use claude_core::{
    ContentBlock, Message, MessageRole, TokenUsage, ToolProgress, ToolResult, ToolUseId,
};

/// Current view
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum View {
    /// Main chat view
    #[default]
    Chat,
    /// Session history view
    History,
    /// Settings view
    Settings,
    /// Help view
    Help,
}

/// Input mode
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum InputMode {
    /// Normal mode - navigation
    #[default]
    Normal,
    /// Editing mode - typing message
    Editing,
    /// Command mode - typing command
    Command,
}

/// TUI State
pub struct TuiState {
    /// Current view
    pub current_view: View,
    /// Input mode
    pub input_mode: InputMode,
    /// Input buffer
    pub input_buffer: String,
    /// Cursor position in input
    pub cursor_position: usize,
    /// Message history
    pub messages: Vec<DisplayMessage>,
    /// Scroll offset for messages
    pub scroll_offset: usize,
    /// History for input
    pub history: InputHistory,
    /// Whether we're processing a query
    pub is_processing: bool,
    /// Current streaming message
    pub streaming_content: Option<String>,
    /// Active tool uses
    pub active_tools: Vec<ActiveTool>,
    /// Show help
    pub show_help: bool,
    /// Show usage stats
    pub show_usage: bool,
    /// Debug mode
    pub debug_mode: bool,
    /// Terminal size
    pub size: (u16, u16),
    /// Total usage
    pub total_usage: TokenUsage,
    /// Status message
    pub status_message: Option<String>,
    /// Status message timeout
    pub status_timeout: Option<std::time::Instant>,
}

/// Display message (extends core Message with UI state)
#[derive(Debug, Clone)]
pub struct DisplayMessage {
    /// Message ID
    pub id: Option<claude_core::MessageId>,
    /// Role
    pub role: MessageRole,
    /// Content blocks
    pub content: Vec<ContentBlock>,
    /// Rendered text lines
    pub rendered_lines: Vec<String>,
    /// Timestamp
    pub timestamp: Option<chrono::DateTime<chrono::Utc>>,
    /// Whether collapsed
    pub collapsed: bool,
    /// Whether this is an error
    pub is_error: bool,
}

/// Active tool execution
#[derive(Debug, Clone)]
pub struct ActiveTool {
    /// Tool use ID
    pub id: ToolUseId,
    /// Tool name
    pub name: String,
    /// Tool input
    pub input: serde_json::Value,
    /// Current progress
    pub progress: Vec<ToolProgress>,
    /// Start time
    pub start_time: std::time::Instant,
    /// Whether completed
    pub completed: bool,
    /// Result if completed
    pub result: Option<ToolResult>,
}

/// Input history
#[derive(Debug, Clone, Default)]
pub struct InputHistory {
    /// History entries
    entries: VecDeque<String>,
    /// Current position (None = at end)
    position: Option<usize>,
    /// Max entries
    max_entries: usize,
    /// Temporary buffer for new input
    temp_buffer: Option<String>,
}

impl InputHistory {
    /// Create new history
    pub fn new() -> Self {
        Self {
            entries: VecDeque::new(),
            position: None,
            max_entries: 1000,
            temp_buffer: None,
        }
    }
    
    /// Add entry
    pub fn add(&mut self, entry: String) {
        // Don't add duplicates of the most recent entry
        if self.entries.front().map(|e| e.as_str()) != Some(&entry) {
            self.entries.push_front(entry);
            if self.entries.len() > self.max_entries {
                self.entries.pop_back();
            }
        }
        self.position = None;
        self.temp_buffer = None;
    }
    
    /// Get previous entry
    pub fn previous(&mut self) -> Option<&str> {
        if self.entries.is_empty() {
            return None;
        }
        
        match self.position {
            None => {
                self.position = Some(0);
            }
            Some(pos) if pos + 1 < self.entries.len() => {
                self.position = Some(pos + 1);
            }
            _ => {}
        }
        
        self.position.and_then(|p| self.entries.get(p)).map(String::as_str)
    }
    
    /// Get next entry
    pub fn next(&mut self) -> Option<&str> {
        match self.position {
            Some(0) => {
                self.position = None;
                self.temp_buffer.as_deref()
            }
            Some(pos) => {
                self.position = Some(pos - 1);
                self.position.and_then(|p| self.entries.get(p)).map(String::as_str)
            }
            None => None,
        }
    }
    
    /// Set temp buffer
    pub fn set_temp(&mut self, buffer: String) {
        if self.position.is_none() {
            self.temp_buffer = Some(buffer);
        }
    }
}

impl TuiState {
    /// Create new TUI state
    pub fn new() -> Self {
        Self {
            current_view: View::Chat,
            input_mode: InputMode::Normal,
            input_buffer: String::new(),
            cursor_position: 0,
            messages: Vec::new(),
            scroll_offset: 0,
            history: InputHistory::new(),
            is_processing: false,
            streaming_content: None,
            active_tools: Vec::new(),
            show_help: false,
            show_usage: false,
            debug_mode: false,
            size: (80, 24),
            total_usage: TokenUsage::default(),
            status_message: None,
            status_timeout: None,
        }
    }
    
    /// Set terminal size
    pub fn set_size(&mut self, width: u16, height: u16) {
        self.size = (width, height);
    }
    
    /// Add user message
    pub fn add_user_message(&mut self, text: &str) {
        let msg = DisplayMessage {
            id: Some(claude_core::MessageId::new()),
            role: MessageRole::User,
            content: vec![ContentBlock::Text { text: text.to_string() }],
            rendered_lines: vec![format!("> {}", text)],
            timestamp: Some(chrono::Utc::now()),
            collapsed: false,
            is_error: false,
        };
        self.messages.push(msg);
        self.history.add(text.to_string());
        self.scroll_to_bottom();
    }
    
    /// Add assistant message
    pub fn add_assistant_message(&mut self, message: Message) {
        // Complete any streaming
        self.streaming_content = None;
        
        let msg = DisplayMessage {
            id: message.id.clone(),
            role: message.role,
            content: message.content.clone(),
            rendered_lines: self.render_content(&message.content),
            timestamp: message.timestamp,
            collapsed: false,
            is_error: false,
        };
        self.messages.push(msg);
        self.scroll_to_bottom();
    }
    
    /// Add system message
    pub fn add_system_message(&mut self, text: &str) {
        let msg = DisplayMessage {
            id: None,
            role: MessageRole::System,
            content: vec![ContentBlock::Text { text: text.to_string() }],
            rendered_lines: vec![format!("[{}]", text)],
            timestamp: Some(chrono::Utc::now()),
            collapsed: false,
            is_error: false,
        };
        self.messages.push(msg);
    }
    
    /// Add error message
    pub fn add_error(&mut self, error: &str) {
        let msg = DisplayMessage {
            id: None,
            role: MessageRole::Assistant,
            content: vec![ContentBlock::Text { text: error.to_string() }],
            rendered_lines: vec![format!("Error: {}", error)],
            timestamp: Some(chrono::Utc::now()),
            collapsed: false,
            is_error: true,
        };
        self.messages.push(msg);
    }
    
    /// Append streaming token
    pub fn append_streaming_token(&mut self, token: &str) {
        if let Some(ref mut content) = self.streaming_content {
            content.push_str(token);
        } else {
            self.streaming_content = Some(token.to_string());
        }
        self.scroll_to_bottom();
    }
    
    /// Add tool use
    pub fn add_tool_use(&mut self, id: ToolUseId, name: String, input: serde_json::Value) {
        let tool = ActiveTool {
            id,
            name,
            input,
            progress: Vec::new(),
            start_time: std::time::Instant::now(),
            completed: false,
            result: None,
        };
        self.active_tools.push(tool);
    }
    
    /// Update tool progress
    pub fn update_tool_progress(&mut self, id: ToolUseId, progress: ToolProgress) {
        if let Some(tool) = self.active_tools.iter_mut().find(|t| t.id == id) {
            tool.progress.push(progress);
        }
    }
    
    /// Complete tool use
    pub fn complete_tool_use(&mut self, id: ToolUseId, result: ToolResult) {
        if let Some(tool) = self.active_tools.iter_mut().find(|t| t.id == id) {
            tool.completed = true;
            tool.result = Some(result);
        }
    }
    
    /// Clear messages
    pub fn clear_messages(&mut self) {
        self.messages.clear();
        self.scroll_offset = 0;
        self.streaming_content = None;
        self.active_tools.clear();
    }
    
    /// Scroll messages
    pub fn scroll_messages(&mut self, delta: i32) {
        let max_scroll = self.messages.len().saturating_sub(1);
        if delta < 0 {
            self.scroll_offset = self.scroll_offset.saturating_sub(delta.abs() as usize);
        } else {
            self.scroll_offset = (self.scroll_offset + delta as usize).min(max_scroll);
        }
    }
    
    /// Scroll to bottom
    pub fn scroll_to_bottom(&mut self) {
        self.scroll_offset = self.messages.len().saturating_sub(1);
    }
    
    /// Cancel current operation
    pub fn cancel_current(&mut self) {
        self.is_processing = false;
        self.streaming_content = None;
        self.status_message = Some("Cancelled".to_string());
        self.status_timeout = Some(std::time::Instant::now() + std::time::Duration::from_secs(2));
    }
    
    /// Cycle view
    pub fn cycle_view(&mut self) {
        self.current_view = match self.current_view {
            View::Chat => View::History,
            View::History => View::Settings,
            View::Settings => View::Help,
            View::Help => View::Chat,
        };
    }
    
    /// Update usage
    pub fn update_usage(&mut self, usage: TokenUsage) {
        self.total_usage.accumulate(&usage);
    }
    
    /// On tick (for animations)
    pub fn on_tick(&mut self) {
        // Clear status message if timed out
        if let Some(timeout) = self.status_timeout {
            if std::time::Instant::now() > timeout {
                self.status_message = None;
                self.status_timeout = None;
            }
        }
    }
    
    /// Render content to lines
    fn render_content(&self, content: &[ContentBlock]) -> Vec<String> {
        let mut lines = Vec::new();
        for block in content {
            match block {
                ContentBlock::Text { text } => {
                    lines.extend(text.lines().map(String::from));
                }
                ContentBlock::ToolUse { id, name, input } => {
                    lines.push(format!("▶ {} ({}) {}", name, id.0, input));
                }
                ContentBlock::ToolResult { tool_use_id, content, is_error } => {
                    let prefix = if is_error == &Some(true) { "✗" } else { "✓" };
                    lines.push(format!("{} {}: {}", prefix, tool_use_id.0, content.as_text()));
                }
                _ => {}
            }
        }
        lines
    }
}

impl Default for TuiState {
    fn default() -> Self {
        Self::new()
    }
}

