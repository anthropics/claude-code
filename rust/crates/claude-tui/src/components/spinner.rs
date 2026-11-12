//! Spinner component for loading states

use ratatui::{
    buffer::Buffer,
    layout::Rect,
    style::Style,
    text::Span,
    widgets::Widget,
};

/// Spinner animation
pub struct Spinner {
    /// Current frame
    frame: usize,
    /// Style
    style: Style,
}

impl Spinner {
    /// Spinner frames
    const FRAMES: &'static [&'static str] = &[
        "⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"
    ];
    
    /// Create new spinner
    pub fn new() -> Self {
        Self {
            frame: 0,
            style: Style::default(),
        }
    }
    
    /// With frame
    pub fn frame(mut self, frame: usize) -> Self {
        self.frame = frame;
        self
    }
    
    /// With style
    pub fn style(mut self, style: Style) -> Self {
        self.style = style;
        self
    }
    
    /// Get current character
    pub fn current(&self) -> &'static str {
        Self::FRAMES[self.frame % Self::FRAMES.len()]
    }
    
    /// Next frame
    pub fn next(&mut self) {
        self.frame = (self.frame + 1) % Self::FRAMES.len();
    }
}

impl Default for Spinner {
    fn default() -> Self {
        Self::new()
    }
}

impl Widget for Spinner {
    fn render(self, area: Rect, buf: &mut Buffer) {
        let span = Span::styled(self.current().to_string(), self.style);
        buf.set_span(area.x, area.y, &span, area.width);
    }
}

