//! Layout management

use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    widgets::canvas::Canvas,
};

/// UI layout manager
pub struct UiLayout;

impl UiLayout {
    /// Create main layout
    pub fn main(area: Rect) -> Vec<Rect> {
        Layout::default()
            .direction(Direction::Vertical)
            .constraints([
                Constraint::Min(5),      // Messages
                Constraint::Length(3),   // Input
                Constraint::Length(1),   // Status
            ])
            .split(area)
    }
    
    /// Create chat layout
    pub fn chat(area: Rect) -> Vec<Rect> {
        if area.height > 20 {
            // Split horizontally for side panel
            Layout::default()
                .direction(Direction::Horizontal)
                .constraints([
                    Constraint::Min(40),       // Main chat
                    Constraint::Length(30),  // Side panel (tools)
                ])
                .split(area)
        } else {
            vec![area]
        }
    }
    
    /// Create message list layout
    pub fn messages(area: Rect) -> Rect {
        area
    }
    
    /// Create sidebar layout
    pub fn sidebar(area: Rect) -> Vec<Rect> {
        Layout::default()
            .direction(Direction::Vertical)
            .constraints([
                Constraint::Length(8),  // Active tools
                Constraint::Min(5),     // Tool history
            ])
            .split(area)
    }
}

/// Center a rect within another
pub fn center_rect(width: u16, height: u16, container: Rect) -> Rect {
    let x = (container.width.saturating_sub(width)) / 2;
    let y = (container.height.saturating_sub(height)) / 2;
    
    Rect::new(
        container.x + x,
        container.y + y,
        width.min(container.width),
        height.min(container.height),
    )
}

