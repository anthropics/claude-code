//! Tool execution card component

use claude_core::{ToolProgress, ToolResult};
use ratatui::{
    buffer::Buffer,
    layout::Rect,
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, Paragraph, Widget},
};

use crate::theme::Theme;

/// Tool execution card
pub struct ToolCard<'a> {
    /// Tool name
    name: &'a str,
    /// Tool input (truncated)
    input: &'a str,
    /// Progress
    progress: Option<&'a ToolProgress>,
    /// Result
    result: Option<&'a ToolResult>,
    /// Elapsed time
    elapsed_secs: f32,
    /// Theme
    theme: &'a Theme,
}

impl<'a> ToolCard<'a> {
    /// Create new tool card
    pub fn new(name: &'a str, theme: &'a Theme) -> Self {
        Self {
            name,
            input: "",
            progress: None,
            result: None,
            elapsed_secs: 0.0,
            theme,
        }
    }
    
    /// With input
    pub fn input(mut self, input: &'a str) -> Self {
        self.input = input;
        self
    }
    
    /// With progress
    pub fn progress(mut self, progress: &'a ToolProgress) -> Self {
        self.progress = Some(progress);
        self
    }
    
    /// With result
    pub fn result(mut self, result: &'a ToolResult) -> Self {
        self.result = Some(result);
        self
    }
    
    /// With elapsed time
    pub fn elapsed(mut self, secs: f32) -> Self {
        self.elapsed_secs = secs;
        self
    }
    
    /// Get height
    pub fn height(&self) -> u16 {
        if self.result.is_some() {
            4
        } else {
            3
        }
    }
}

impl<'a> Widget for ToolCard<'a> {
    fn render(self, area: Rect, buf: &mut Buffer) {
        let status_icon = if self.result.is_some() {
            "✓"
        } else {
            "▶"
        };
        
        let status_style = if self.result.is_some() {
            self.theme.success()
        } else {
            self.theme.primary()
        };
        
        // Title line
        let title = Line::from(vec![
            Span::styled(format!("{} ", status_icon), status_style),
            Span::styled(self.name.to_string(), self.theme.tool_use().add_modifier(Modifier::BOLD)),
            Span::styled(
                format!(" ({:.1}s)", self.elapsed_secs),
                self.theme.muted()
            ),
        ]);
        buf.set_line(area.x, area.y, &title, area.width);
        
        // Input line (truncated)
        if !self.input.is_empty() {
            let input_truncated = if self.input.len() > area.width as usize - 4 {
                format!("{}...", &self.input[..area.width as usize - 7])
            } else {
                self.input.to_string()
            };
            let input_line = Line::styled(
                format!("  {}", input_truncated),
                self.theme.muted()
            );
            buf.set_line(area.x, area.y + 1, &input_line, area.width);
        }
        
        // Progress or result
        if let Some(progress) = self.progress {
            let bar = progress_bar(progress.percent.unwrap_or(0));
            let status = format!(
                "  {} {}% {}",
                bar,
                progress.percent.unwrap_or(0),
                progress.status
            );
            let line = Line::styled(status, self.theme.secondary());
            buf.set_line(area.x, area.y + 2, &line, area.width);
        } else if let Some(result) = self.result {
            let content = result.output.as_text();
            let content_truncated = if content.len() > area.width as usize - 4 {
                format!("  {}...", &content[..area.width as usize - 7])
            } else {
                format!("  {}", content)
            };
            let line = Line::styled(content_truncated, self.theme.muted());
            buf.set_line(area.x, area.y + 2, &line, area.width);
        }
    }
}

/// Generate progress bar
fn progress_bar(percent: u8) -> String {
    let filled = (percent as usize) / 10;
    let empty = 10 - filled;
    format!("[{}{}]", "█".repeat(filled), "░".repeat(empty))
}

