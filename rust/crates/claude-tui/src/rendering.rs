//! Rendering components

use ratatui::{
    backend::Backend,
    layout::{Alignment, Constraint, Direction, Layout, Margin, Rect},
    style::{Modifier, Style},
    text::{Line, Span, Text},
    widgets::{Block, Borders, Clear, List, ListItem, Paragraph, Wrap},
    Frame,
};

use crate::{
    state::{InputMode, TuiState, View},
    theme::Theme,
};

/// Renderer
pub struct Renderer {
    theme: Theme,
}

impl Renderer {
    /// Create new renderer
    pub fn new() -> Self {
        Self {
            theme: Theme::default(),
        }
    }
    
    /// Render full UI
    pub fn render<B: Backend>(&self, frame: &mut Frame<B>, state: &TuiState) {
        let size = frame.size();
        
        // Main layout
        let main_chunks = Layout::default()
            .direction(Direction::Vertical)
            .constraints([Constraint::Min(3), Constraint::Length(3), Constraint::Length(1)])
            .split(size);
        
        // Render based on current view
        match state.current_view {
            View::Chat => self.render_chat_view(frame, state, main_chunks[0]),
            View::History => self.render_history_view(frame, state, main_chunks[0]),
            View::Settings => self.render_settings_view(frame, state, main_chunks[0]),
            View::Help => self.render_help_view(frame, state, main_chunks[0]),
        }
        
        // Input area
        self.render_input(frame, state, main_chunks[1]);
        
        // Status bar
        self.render_status_bar(frame, state, main_chunks[2]);
        
        // Help overlay
        if state.show_help {
            self.render_help_overlay(frame, state);
        }
        
        // Usage overlay
        if state.show_usage {
            self.render_usage_overlay(frame, state);
        }
    }
    
    /// Render chat view
    fn render_chat_view<B: Backend>(&self, frame: &mut Frame<B>, state: &TuiState, area: Rect) {
        // Messages area
        let block = Block::default()
            .title(" Claude Code ")
            .title_alignment(Alignment::Center)
            .borders(Borders::ALL)
            .border_style(match state.input_mode {
                InputMode::Normal => self.theme.border(),
                _ => self.theme.border_focused(),
            });
        
        let inner = block.inner(area);
        frame.render_widget(block, area);
        
        // Build message text
        let mut lines: Vec<Line> = Vec::new();
        
        // Welcome message if no messages
        if state.messages.is_empty() && state.streaming_content.is_none() {
            lines.push(Line::from(""));
            lines.push(Line::from(vec![
                Span::styled("  Welcome to ", self.theme.muted()),
                Span::styled("Claude Code", self.theme.primary().add_modifier(Modifier::BOLD)),
            ]));
            lines.push(Line::from(""));
            lines.push(Line::styled("  Press ":to_owned() + "i" + " to start typing, or ":to_owned() + "?" + " for help.", self.theme.muted()));
        }
        
        // Render messages
        for msg in &state.messages {
            match msg.role {
                claude_core::MessageRole::User => {
                    lines.push(Line::from(""));
                    lines.push(Line::from(vec![
                        Span::styled("> ", self.theme.primary().add_modifier(Modifier::BOLD)),
                        Span::styled(msg.text_content(), self.theme.user_message()),
                    ]));
                }
                claude_core::MessageRole::Assistant => {
                    lines.push(Line::from(""));
                    let style = if msg.is_error {
                        self.theme.error()
                    } else {
                        self.theme.assistant_message()
                    };
                    for line in &msg.rendered_lines {
                        lines.push(Line::styled(line.clone(), style));
                    }
                }
                _ => {}
            }
        }
        
        // Render streaming content
        if let Some(ref streaming) = state.streaming_content {
            lines.push(Line::from(""));
            for line in streaming.lines() {
                lines.push(Line::styled(line.to_string(), self.theme.assistant_message()));
            }
            // Add cursor at end
            if let Some(last) = lines.last_mut() {
                last.spans.push(Span::styled("▌", self.theme.primary()));
            }
        }
        
        // Render processing indicator
        if state.is_processing && state.streaming_content.is_none() {
            let spinner = self.get_spinner(state);
            lines.push(Line::from(""));
            lines.push(Line::styled(
                format!(" {} Thinking...", spinner),
                self.theme.muted()
            ));
        }
        
        // Active tools
        if !state.active_tools.is_empty() {
            lines.push(Line::from(""));
            for tool in &state.active_tools {
                let status = if tool.completed { "✓" } else { "▶" };
                let elapsed = tool.start_time.elapsed().as_secs_f32();
                lines.push(Line::styled(
                    format!(" {} {} ({:.1}s)", status, tool.name, elapsed),
                    self.theme.tool_use()
                ));
                
                // Show latest progress
                if let Some(progress) = tool.progress.last() {
                    let percent = progress.percent.unwrap_or(0);
                    let bar = self.progress_bar(percent);
                    lines.push(Line::styled(
                        format!("   {} {}% {}", bar, percent, progress.status),
                        self.theme.muted()
                    ));
                }
            }
        }
        
        let text = Text::from(lines);
        let paragraph = Paragraph::new(text)
            .wrap(Wrap { trim: false })
            .scroll((state.scroll_offset as u16, 0));
        
        frame.render_widget(paragraph, inner);
    }
    
    /// Render input area
    fn render_input<B: Backend>(&self, frame: &mut Frame<B>, state: &TuiState, area: Rect) {
        let (title, style) = match state.input_mode {
            InputMode::Normal => (" Normal ", self.theme.border()),
            InputMode::Editing => (" Input ", self.theme.border_focused()),
            InputMode::Command => (" Command ", self.theme.warning()),
        };
        
        let block = Block::default()
            .title(title)
            .borders(Borders::ALL)
            .border_style(style);
        
        let inner = block.inner(area);
        frame.render_widget(block, area);
        
        // Render input text with cursor
        let input_text = if state.input_mode == InputMode::Normal {
            "Press i to start typing...".to_string()
        } else {
            state.input_buffer.clone()
        };
        
        let mut spans = vec![Span::raw(input_text.clone())];
        
        // Add cursor if editing
        if state.input_mode != InputMode::Normal && inner.width as usize > state.cursor_position {
            // Cursor is handled by the terminal
        }
        
        let line = Line::from(spans);
        let text = Text::from(line);
        let paragraph = Paragraph::new(text);
        
        frame.render_widget(paragraph, inner);
        
        // Set cursor position
        if state.input_mode != InputMode::Normal {
            let x = inner.x + state.cursor_position as u16;
            let y = inner.y;
            frame.set_cursor(x, y);
        }
    }
    
    /// Render status bar
    fn render_status_bar<B: Backend>(&self, frame: &mut Frame<B>, state: &TuiState, area: Rect) {
        let mut spans = Vec::new();
        
        // Mode indicator
        let mode_text = match state.input_mode {
            InputMode::Normal => " NORMAL ",
            InputMode::Editing => " INSERT ",
            InputMode::Command => " COMMAND ",
        };
        let mode_style = match state.input_mode {
            InputMode::Normal => self.theme.secondary(),
            InputMode::Editing => self.theme.primary(),
            InputMode::Command => self.theme.warning(),
        };
        spans.push(Span::styled(mode_text, mode_style.add_modifier(Modifier::REVERSED)));
        spans.push(Span::raw(" "));
        
        // Message count
        spans.push(Span::styled(
            format!("{} msgs ", state.messages.len()),
            self.theme.muted()
        ));
        
        // Processing indicator
        if state.is_processing {
            spans.push(Span::styled("● processing", self.theme.primary()));
        }
        
        // Status message
        if let Some(ref msg) = state.status_message {
            spans.push(Span::raw(" | "));
            spans.push(Span::styled(msg, self.theme.warning()));
        }
        
        // Cost estimate (right-aligned)
        let cost_text = format!("${:.4} ", state.total_usage.estimate_cost_usd());
        let cost_span = Span::styled(cost_text, self.theme.muted());
        
        let line = Line::from(spans);
        let text = Text::from(line);
        let paragraph = Paragraph::new(text);
        
        frame.render_widget(paragraph, area);
    }
    
    /// Render history view
    fn render_history_view<B: Backend>(&self, frame: &mut Frame<B>, state: &TuiState, area: Rect) {
        let block = Block::default()
            .title(" History ")
            .borders(Borders::ALL);
        
        let items: Vec<ListItem> = state.history.entries.iter()
            .map(|e| ListItem::new(e.as_str()))
            .collect();
        
        let list = List::new(items)
            .block(block)
            .highlight_style(self.theme.primary().add_modifier(Modifier::BOLD));
        
        frame.render_widget(list, area);
    }
    
    /// Render settings view
    fn render_settings_view<B: Backend>(&self, frame: &mut Frame<B>, _state: &TuiState, area: Rect) {
        let block = Block::default()
            .title(" Settings ")
            .borders(Borders::ALL);
        
        let text = Text::from(vec![
            Line::from("Settings view - coming soon"),
        ]);
        
        let paragraph = Paragraph::new(text).block(block);
        frame.render_widget(paragraph, area);
    }
    
    /// Render help view
    fn render_help_view<B: Backend>(&self, frame: &mut Frame<B>, _state: &TuiState, area: Rect) {
        let block = Block::default()
            .title(" Help ")
            .borders(Borders::ALL);
        
        let text = Text::from(vec![
            Line::from(vec![Span::styled("Keyboard Shortcuts:", self.theme.primary().add_modifier(Modifier::BOLD))]),
            Line::from(""),
            Line::from("  i           - Enter insert mode"),
            Line::from("  Esc         - Return to normal mode"),
            Line::from("  :           - Enter command mode"),
            Line::from("  Enter       - Send message / execute command"),
            Line::from("  ↑/↓         - Navigate history"),
            Line::from("  Ctrl+c      - Cancel current operation"),
            Line::from("  Ctrl+l      - Clear screen"),
            Line::from("  Ctrl+q      - Quit"),
            Line::from("  Tab         - Switch view"),
            Line::from(""),
            Line::from(vec![Span::styled("Commands:", self.theme.primary().add_modifier(Modifier::BOLD))]),
            Line::from(""),
            Line::from("  :clear      - Clear conversation"),
            Line::from("  :compact    - Compact conversation"),
            Line::from("  :cost       - Show usage/cost"),
            Line::from("  :debug      - Toggle debug mode"),
            Line::from("  :help       - Show this help"),
            Line::from("  :model      - Change model"),
            Line::from("  :quit       - Exit Claude Code"),
        ]);
        
        let paragraph = Paragraph::new(text).block(block);
        frame.render_widget(paragraph, area);
    }
    
    /// Render help overlay
    fn render_help_overlay<B: Backend>(&self, frame: &mut Frame<B>, state: &TuiState) {
        let area = centered_rect(60, 70, frame.size());
        
        frame.render_widget(Clear, area);
        
        let block = Block::default()
            .title(" Help ")
            .borders(Borders::ALL)
            .border_style(self.theme.primary());
        
        let mut lines = vec![
            Line::from(vec![Span::styled("Claude Code v", self.theme.primary()), Span::styled("0.1.0", self.theme.secondary())]),
            Line::from(""),
        ];
        
        // Add keyboard shortcuts
        let shortcuts = [
            ("i", "Enter insert mode"),
            ("Esc", "Return to normal mode"),
            (":", "Enter command mode"),
            ("Enter", "Send / execute"),
            ("↑/↓", "Navigate history"),
            ("Ctrl+c", "Cancel"),
            ("Ctrl+l", "Clear screen"),
            ("Ctrl+q", "Quit"),
            ("Tab", "Switch view"),
        ];
        
        for (key, desc) in shortcuts {
            lines.push(Line::from(vec![
                Span::styled(format!("  {:12}", key), self.theme.primary()),
                Span::raw(desc),
            ]));
        }
        
        lines.push(Line::from(""));
        lines.push(Line::styled("Press any key to close", self.theme.muted()));
        
        let text = Text::from(lines);
        let paragraph = Paragraph::new(text).block(block).wrap(Wrap { trim: false });
        
        frame.render_widget(paragraph, area);
    }
    
    /// Render usage overlay
    fn render_usage_overlay<B: Backend>(&self, frame: &mut Frame<B>, state: &TuiState) {
        let area = centered_rect(50, 40, frame.size());
        
        frame.render_widget(Clear, area);
        
        let block = Block::default()
            .title(" Usage ")
            .borders(Borders::ALL)
            .border_style(self.theme.primary());
        
        let usage = &state.total_usage;
        let cost = usage.estimate_cost_usd();
        
        let text = Text::from(vec![
            Line::from(vec![Span::styled("Token Usage:", self.theme.primary().add_modifier(Modifier::BOLD))]),
            Line::from(""),
            Line::from(format!("  Input tokens:  {}", usage.input_tokens)),
            Line::from(format!("  Output tokens: {}", usage.output_tokens)),
            Line::from(format!("  Total tokens:  {}", usage.total())),
            Line::from(""),
            Line::from(vec![Span::styled("Cost:", self.theme.primary().add_modifier(Modifier::BOLD))]),
            Line::from(format!("  ${:.6} USD", cost)),
            Line::from(""),
            Line::styled("Press any key to close", self.theme.muted()),
        ]);
        
        let paragraph = Paragraph::new(text).block(block);
        frame.render_widget(paragraph, area);
    }
    
    /// Get spinner character based on tick
    fn get_spinner(&self, state: &TuiState) -> &'static str {
        const SPINNERS: &[&str] = &["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
        // Use message count as a rough tick proxy
        let idx = state.messages.len() % SPINNERS.len();
        SPINNERS[idx]
    }
    
    /// Generate progress bar
    fn progress_bar(&self, percent: u8) -> String {
        let filled = (percent as usize) / 10;
        let empty = 10 - filled;
        format!("[{}{}]", "█".repeat(filled), "░".repeat(empty))
    }
}

/// Create a centered rect
fn centered_rect(percent_x: u16, percent_y: u16, r: Rect) -> Rect {
    let popup_layout = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Percentage((100 - percent_y) / 2),
            Constraint::Percentage(percent_y),
            Constraint::Percentage((100 - percent_y) / 2),
        ])
        .split(r);
    
    Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Percentage((100 - percent_x) / 2),
            Constraint::Percentage(percent_x),
            Constraint::Percentage((100 - percent_x) / 2),
        ])
        .split(popup_layout[1])[1]
}

