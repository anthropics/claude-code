//! Additional widgets

use ratatui::{
    buffer::Buffer,
    layout::Rect,
    style::Style,
    text::{Line, Span},
    widgets::{Block, Borders, Paragraph, Widget, Wrap},
};

/// Scrollable list widget
pub struct ScrollableList<'a> {
    items: Vec<Line<'a>>,
    scroll_offset: usize,
    style: Style,
    block: Option<Block<'a>>,
}

impl<'a> ScrollableList<'a> {
    /// Create new scrollable list
    pub fn new(items: Vec<Line<'a>>) -> Self {
        Self {
            items,
            scroll_offset: 0,
            style: Style::default(),
            block: None,
        }
    }
    
    /// With scroll offset
    pub fn scroll(mut self, offset: usize) -> Self {
        self.scroll_offset = offset;
        self
    }
    
    /// With style
    pub fn style(mut self, style: Style) -> Self {
        self.style = style;
        self
    }
    
    /// With block
    pub fn block(mut self, block: Block<'a>) -> Self {
        self.block = Some(block);
        self
    }
}

impl<'a> Widget for ScrollableList<'a> {
    fn render(self, area: Rect, buf: &mut Buffer) {
        let inner = self.block.as_ref().map(|b| b.inner(area)).unwrap_or(area);
        
        // Render block
        if let Some(block) = self.block {
            block.render(area, buf);
        }
        
        // Render visible items
        let visible_items: Vec<Line> = self.items.iter()
            .skip(self.scroll_offset)
            .take(inner.height as usize)
            .cloned()
            .collect();
        
        let text = ratatui::text::Text::from(visible_items);
        let paragraph = Paragraph::new(text)
            .style(self.style)
            .wrap(Wrap { trim: false });
        
        paragraph.render(inner, buf);
    }
}

/// Status bar widget
pub struct StatusBar<'a> {
    left: Vec<Span<'a>>,
    right: Vec<Span<'a>>,
    style: Style,
}

impl<'a> StatusBar<'a> {
    /// Create new status bar
    pub fn new() -> Self {
        Self {
            left: Vec::new(),
            right: Vec::new(),
            style: Style::default(),
        }
    }
    
    /// Add left span
    pub fn left(mut self, span: Span<'a>) -> Self {
        self.left.push(span);
        self
    }
    
    /// Add right span
    pub fn right(mut self, span: Span<'a>) -> Self {
        self.right.push(span);
        self
    }
    
    /// With style
    pub fn style(mut self, style: Style) -> Self {
        self.style = style;
        self
    }
}

impl<'a> Widget for StatusBar<'a> {
    fn render(self, area: Rect, buf: &mut Buffer) {
        let left_text: String = self.left.iter().map(|s| s.content.to_string()).collect::<Vec<_>>().join("");
        let right_text: String = self.right.iter().map(|s| s.content.to_string()).collect::<Vec<_>>().join("");
        
        let left_width = left_text.len() as u16;
        let right_width = right_text.len() as u16;
        let available = area.width.saturating_sub(left_width + right_width + 2);
        
        let line = Line::from(vec![
            Span::from(left_text),
            Span::from(" ".repeat(available as usize)),
            Span::from(right_text),
        ]);
        
        buf.set_line(area.x, area.y, &line, area.width);
    }
}

