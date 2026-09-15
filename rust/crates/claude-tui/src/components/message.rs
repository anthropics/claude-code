//! Message display component

use claude_core::{ContentBlock, Message, MessageRole};
use ratatui::{
    buffer::Buffer,
    layout::Rect,
    style::{Modifier, Style},
    text::{Line, Span, Text},
    widgets::{Paragraph, Widget, Wrap},
};

use crate::theme::Theme;

/// Message component
pub struct MessageComponent<'a> {
    message: &'a Message,
    theme: &'a Theme,
    collapsed: bool,
    width: u16,
}

impl<'a> MessageComponent<'a> {
    /// Create new message component
    pub fn new(message: &'a Message, theme: &'a Theme, width: u16) -> Self {
        Self {
            message,
            theme,
            collapsed: false,
            width,
        }
    }
    
    /// Set collapsed
    pub fn collapsed(mut self, collapsed: bool) -> Self {
        self.collapsed = collapsed;
        self
    }
    
    /// Get content height
    pub fn height(&self) -> u16 {
        if self.collapsed {
            1
        } else {
            let text = self.render_text();
            let wrapped_height = textwrap::wrap(&text, self.width as usize).len() as u16;
            wrapped_height + 1 // +1 for header
        }
    }
}

impl<'a> Widget for MessageComponent<'a> {
    fn render(self, area: Rect, buf: &mut Buffer) {
        let header_style = match self.message.role {
            MessageRole::User => self.theme.user_message(),
            MessageRole::Assistant => self.theme.assistant_message(),
            MessageRole::System => self.theme.muted(),
        };
        
        let header = match self.message.role {
            MessageRole::User => "> ",
            MessageRole::Assistant => "◆ ",
            MessageRole::System => "ℹ ",
        };
        
        // Render header
        let header_line = Line::from(vec![
            Span::styled(header, header_style.add_modifier(Modifier::BOLD)),
        ]);
        buf.set_line(area.x, area.y, &header_line, area.width);
        
        if self.collapsed {
            return;
        }
        
        // Render content
        let content = self.render_text();
        let text = Text::from(content);
        let paragraph = Paragraph::new(text)
            .wrap(Wrap { trim: false });
        
        let content_area = Rect::new(area.x, area.y + 1, area.width, area.height.saturating_sub(1));
        paragraph.render(content_area, buf);
    }
}

impl<'a> MessageComponent<'a> {
    fn render_text(&self) -> String {
        let mut result = String::new();
        
        for block in &self.message.content {
            match block {
                ContentBlock::Text { text } => {
                    if !result.is_empty() {
                        result.push('\n');
                    }
                    result.push_str(text);
                }
                ContentBlock::ToolUse { id, name, input } => {
                    if !result.is_empty() {
                        result.push('\n');
                    }
                    result.push_str(&format!("▶ Using {} ({})\n", name, id.0));
                    result.push_str(&format!("  Input: {}\n", input));
                }
                ContentBlock::ToolResult { tool_use_id, content, is_error } => {
                    if !result.is_empty() {
                        result.push('\n');
                    }
                    let symbol = if is_error == &Some(true) { "✗" } else { "✓" };
                    result.push_str(&format!("{} {}: {}\n", symbol, tool_use_id.0, content.as_text()));
                }
                _ => {}
            }
        }
        
        result
    }
}

