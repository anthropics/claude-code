//! TUI Application

use anyhow::Result;
use crossterm::{
    event::{DisableMouseCapture, EnableMouseCapture},
    terminal::{self, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{
    backend::{Backend, CrosstermBackend},
    Terminal,
};
use std::io;
use std::time::Duration;
use tokio::sync::mpsc;
use tracing::{debug, error, info};

use crate::{
    events::{Event, EventHandler},
    layout::Layout,
    rendering::Renderer,
    state::{InputMode, TuiState, View},
};

/// TUI Application
pub struct TuiApp {
    /// Application state
    state: TuiState,
    /// Event handler
    event_handler: EventHandler,
    /// Command sender (to engine)
    cmd_tx: mpsc::UnboundedSender<String>,
    /// Response receiver (from engine)
    resp_rx: mpsc::UnboundedReceiver<EngineResponse>,
    /// Renderer
    renderer: Renderer,
}

/// Engine response
#[derive(Debug, Clone)]
pub enum EngineResponse {
    /// Streaming token
    Token(String),
    /// Complete message
    Message(claude_core::Message),
    /// Tool use started
    ToolUseStarted {
        id: claude_core::ToolUseId,
        name: String,
        input: serde_json::Value,
    },
    /// Tool use completed
    ToolUseCompleted {
        id: claude_core::ToolUseId,
        result: claude_core::ToolResult,
    },
    /// Tool progress
    ToolProgress {
        id: claude_core::ToolUseId,
        progress: claude_core::ToolProgress,
    },
    /// Error
    Error(String),
    /// Clear screen
    Clear,
    /// Usage update
    Usage(claude_core::TokenUsage),
}

impl TuiApp {
    /// Create new TUI app
    pub fn new(
        cmd_tx: mpsc::UnboundedSender<String>,
        resp_rx: mpsc::UnboundedReceiver<EngineResponse>,
    ) -> Self {
        Self {
            state: TuiState::new(),
            event_handler: EventHandler::new(Duration::from_millis(16)), // ~60 FPS
            cmd_tx,
            resp_rx,
            renderer: Renderer::new(),
        }
    }
    
    /// Run the application
    pub async fn run(&mut self) -> Result<()> {
        info!("Starting TUI application");
        
        // Setup terminal
        terminal::enable_raw_mode()?;
        let mut stdout = io::stdout();
        crossterm::execute!(stdout, EnterAlternateScreen, EnableMouseCapture)?;
        let backend = CrosstermBackend::new(stdout);
        let mut terminal = Terminal::new(backend)?;
        
        // Main loop
        let result = self.main_loop(&mut terminal).await;
        
        // Cleanup
        terminal::disable_raw_mode()?;
        crossterm::execute!(
            terminal.backend_mut(),
            LeaveAlternateScreen,
            DisableMouseCapture
        )?;
        terminal.show_cursor()?;
        
        result
    }
    
    /// Main event loop
    async fn main_loop<B: Backend>(&mut self, terminal: &mut Terminal<B>) -> Result<()> {
        let mut last_tick = tokio::time::Instant::now();
        let tick_rate = Duration::from_millis(16);
        
        loop {
            // Draw UI
            terminal.draw(|f| {
                self.renderer.render(f, &self.state);
            })?;
            
            // Handle events
            tokio::select! {
                // Crossterm events
                event = self.event_handler.next() => {
                    match event {
                        Some(Event::Key(key)) => {
                            if self.handle_key_event(key).await? {
                                return Ok(());
                            }
                        }
                        Some(Event::Mouse(mouse)) => {
                            self.handle_mouse_event(mouse).await?;
                        }
                        Some(Event::Resize(w, h)) => {
                            self.state.set_size(w, h);
                        }
                        Some(Event::Tick) => {
                            self.state.on_tick();
                        }
                        None => {}
                    }
                }
                
                // Engine responses
                Some(resp) = self.resp_rx.recv() => {
                    self.handle_engine_response(resp).await?;
                }
                
                // Tick for animations
                _ = tokio::time::sleep_until(last_tick + tick_rate) => {
                    last_tick = tokio::time::Instant::now();
                    self.state.on_tick();
                }
            }
        }
    }
    
    /// Handle key event
    async fn handle_key_event(&mut self, key: crossterm::event::KeyEvent) -> Result<bool> {
        use crossterm::event::{KeyCode, KeyModifiers};
        
        debug!("Key event: {:?}", key);
        
        match self.state.input_mode {
            InputMode::Normal => {
                match key.code {
                    KeyCode::Char('q') if key.modifiers.contains(KeyModifiers::CONTROL) => {
                        return Ok(true); // Quit
                    }
                    KeyCode::Char('c') if key.modifiers.contains(KeyModifiers::CONTROL) => {
                        // Cancel current operation
                        self.state.cancel_current();
                    }
                    KeyCode::Char('l') if key.modifiers.contains(KeyModifiers::CONTROL) => {
                        self.state.clear_messages();
                    }
                    KeyCode::Char('/') => {
                        self.state.show_help = !self.state.show_help;
                    }
                    KeyCode::Char('i') => {
                        self.state.input_mode = InputMode::Editing;
                    }
                    KeyCode::Char(':') => {
                        self.state.input_mode = InputMode::Command;
                        self.state.input_buffer = ":".to_string();
                        self.state.cursor_position = 1;
                    }
                    KeyCode::Up => {
                        self.state.scroll_messages(-3);
                    }
                    KeyCode::Down => {
                        self.state.scroll_messages(3);
                    }
                    KeyCode::PageUp => {
                        self.state.scroll_messages(-10);
                    }
                    KeyCode::PageDown => {
                        self.state.scroll_messages(10);
                    }
                    KeyCode::Tab => {
                        self.state.cycle_view();
                    }
                    KeyCode::Esc => {
                        self.state.show_help = false;
                    }
                    _ => {}
                }
            }
            
            InputMode::Editing => {
                match key.code {
                    KeyCode::Enter => {
                        let input = self.state.input_buffer.clone();
                        if !input.is_empty() {
                            self.state.add_user_message(&input);
                            self.cmd_tx.send(input)?;
                            self.state.input_buffer.clear();
                            self.state.cursor_position = 0;
                            self.state.is_processing = true;
                        }
                        self.state.input_mode = InputMode::Normal;
                    }
                    KeyCode::Esc => {
                        self.state.input_mode = InputMode::Normal;
                    }
                    KeyCode::Char(c) => {
                        self.state.input_buffer.insert(self.state.cursor_position, c);
                        self.state.cursor_position += 1;
                    }
                    KeyCode::Backspace => {
                        if self.state.cursor_position > 0 {
                            self.state.cursor_position -= 1;
                            self.state.input_buffer.remove(self.state.cursor_position);
                        }
                    }
                    KeyCode::Delete => {
                        if self.state.cursor_position < self.state.input_buffer.len() {
                            self.state.input_buffer.remove(self.state.cursor_position);
                        }
                    }
                    KeyCode::Left => {
                        if self.state.cursor_position > 0 {
                            self.state.cursor_position -= 1;
                        }
                    }
                    KeyCode::Right => {
                        if self.state.cursor_position < self.state.input_buffer.len() {
                            self.state.cursor_position += 1;
                        }
                    }
                    KeyCode::Home => {
                        self.state.cursor_position = 0;
                    }
                    KeyCode::End => {
                        self.state.cursor_position = self.state.input_buffer.len();
                    }
                    KeyCode::Up => {
                        // History navigation
                        if let Some(prev) = self.state.history.previous() {
                            self.state.input_buffer = prev.to_string();
                            self.state.cursor_position = self.state.input_buffer.len();
                        }
                    }
                    KeyCode::Down => {
                        // History navigation
                        if let Some(next) = self.state.history.next() {
                            self.state.input_buffer = next.to_string();
                            self.state.cursor_position = self.state.input_buffer.len();
                        } else {
                            self.state.input_buffer.clear();
                            self.state.cursor_position = 0;
                        }
                    }
                    _ => {}
                }
            }
            
            InputMode::Command => {
                match key.code {
                    KeyCode::Enter => {
                        let cmd = self.state.input_buffer.clone();
                        self.execute_command(&cmd).await?;
                        self.state.input_buffer.clear();
                        self.state.cursor_position = 0;
                        self.state.input_mode = InputMode::Normal;
                    }
                    KeyCode::Esc => {
                        self.state.input_mode = InputMode::Normal;
                        self.state.input_buffer.clear();
                        self.state.cursor_position = 0;
                    }
                    KeyCode::Char(c) => {
                        self.state.input_buffer.insert(self.state.cursor_position, c);
                        self.state.cursor_position += 1;
                    }
                    KeyCode::Backspace => {
                        if self.state.cursor_position > 0 {
                            self.state.cursor_position -= 1;
                            self.state.input_buffer.remove(self.state.cursor_position);
                        }
                    }
                    KeyCode::Left => {
                        if self.state.cursor_position > 0 {
                            self.state.cursor_position -= 1;
                        }
                    }
                    KeyCode::Right => {
                        if self.state.cursor_position < self.state.input_buffer.len() {
                            self.state.cursor_position += 1;
                        }
                    }
                    _ => {}
                }
            }
        }
        
        Ok(false)
    }
    
    /// Handle mouse event
    async fn handle_mouse_event(&mut self, _mouse: crossterm::event::MouseEvent) -> Result<()> {
        // Mouse handling for clickable elements
        Ok(())
    }
    
    /// Handle engine response
    async fn handle_engine_response(&mut self, resp: EngineResponse) -> Result<()> {
        match resp {
            EngineResponse::Token(token) => {
                self.state.append_streaming_token(&token);
            }
            EngineResponse::Message(msg) => {
                self.state.add_assistant_message(msg);
                self.state.is_processing = false;
            }
            EngineResponse::ToolUseStarted { id, name, input } => {
                self.state.add_tool_use(id, name, input);
            }
            EngineResponse::ToolUseCompleted { id, result } => {
                self.state.complete_tool_use(id, result);
            }
            EngineResponse::ToolProgress { id, progress } => {
                self.state.update_tool_progress(id, progress);
            }
            EngineResponse::Error(err) => {
                self.state.add_error(&err);
                self.state.is_processing = false;
            }
            EngineResponse::Clear => {
                self.state.clear_messages();
            }
            EngineResponse::Usage(usage) => {
                self.state.update_usage(usage);
            }
        }
        Ok(())
    }
    
    /// Execute a command
    async fn execute_command(&mut self, cmd: &str) -> Result<()> {
        let parts: Vec<&str> = cmd.split_whitespace().collect();
        if parts.is_empty() {
            return Ok(());
        }
        
        match parts[0] {
            ":q" | ":quit" => {
                // Handled in key handler
            }
            ":clear" | ":c" => {
                self.state.clear_messages();
                self.cmd_tx.send("/clear".to_string())?;
            }
            ":help" | ":h" => {
                self.state.show_help = true;
            }
            ":compact" => {
                self.cmd_tx.send("/compact".to_string())?;
            }
            ":cost" => {
                self.state.show_usage = true;
            }
            ":debug" => {
                self.state.debug_mode = !self.state.debug_mode;
            }
            ":model" => {
                if parts.len() > 1 {
                    self.cmd_tx.send(format!("/model {}", parts[1]))?;
                }
            }
            _ => {
                self.state.add_system_message(&format!("Unknown command: {}", cmd));
            }
        }
        
        Ok(())
    }
}

