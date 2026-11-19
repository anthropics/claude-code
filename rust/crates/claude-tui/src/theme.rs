//! Theme and styling

use ratatui::style::{Color, Modifier, Style};

/// UI Theme
#[derive(Debug, Clone)]
pub struct Theme {
    /// Primary color (Anthropic blue)
    pub primary: Color,
    /// Secondary color
    pub secondary: Color,
    /// Accent color
    pub accent: Color,
    /// Success color
    pub success: Color,
    /// Error color
    pub error: Color,
    /// Warning color
    pub warning: Color,
    /// Background color
    pub background: Color,
    /// Foreground color
    pub foreground: Color,
    /// Muted foreground
    pub muted: Color,
    /// Border color
    pub border: Color,
    /// Highlight color
    pub highlight: Color,
}

impl Default for Theme {
    fn default() -> Self {
        Self::dark()
    }
}

impl Theme {
    /// Dark theme (default)
    pub fn dark() -> Self {
        Self {
            primary: Color::Rgb(212, 97, 54),      // Anthropic orange
            secondary: Color::Rgb(100, 149, 237),  // Cornflower blue
            accent: Color::Rgb(147, 112, 219),     // Medium purple
            success: Color::Rgb(80, 200, 120),     // Emerald
            error: Color::Rgb(220, 53, 69),        // Danger red
            warning: Color::Rgb(255, 193, 7),      // Warning yellow
            background: Color::Rgb(30, 30, 30),    // Dark gray
            foreground: Color::Rgb(240, 240, 240), // Light gray
            muted: Color::Rgb(150, 150, 150),      // Medium gray
            border: Color::Rgb(70, 70, 70),        // Border gray
            highlight: Color::Rgb(100, 100, 100),  // Highlight gray
        }
    }
    
    /// Light theme
    pub fn light() -> Self {
        Self {
            primary: Color::Rgb(212, 97, 54),
            secondary: Color::Rgb(70, 130, 180),
            accent: Color::Rgb(147, 112, 219),
            success: Color::Rgb(34, 139, 34),
            error: Color::Rgb(178, 34, 34),
            warning: Color::Rgb(218, 165, 32),
            background: Color::Rgb(255, 255, 255),
            foreground: Color::Rgb(30, 30, 30),
            muted: Color::Rgb(100, 100, 100),
            border: Color::Rgb(200, 200, 200),
            highlight: Color::Rgb(230, 230, 230),
        }
    }
    
    /// Get primary style
    pub fn primary(&self) -> Style {
        Style::default().fg(self.primary)
    }
    
    /// Get secondary style
    pub fn secondary(&self) -> Style {
        Style::default().fg(self.secondary)
    }
    
    /// Get muted style
    pub fn muted(&self) -> Style {
        Style::default().fg(self.muted)
    }
    
    /// Get error style
    pub fn error(&self) -> Style {
        Style::default().fg(self.error)
    }
    
    /// Get success style
    pub fn success(&self) -> Style {
        Style::default().fg(self.success)
    }
    
    /// Get warning style
    pub fn warning(&self) -> Style {
        Style::default().fg(self.warning)
    }
    
    /// Get user message style
    pub fn user_message(&self) -> Style {
        Style::default()
            .fg(self.foreground)
            .add_modifier(Modifier::BOLD)
    }
    
    /// Get assistant message style
    pub fn assistant_message(&self) -> Style {
        Style::default().fg(self.foreground)
    }
    
    /// Get tool use style
    pub fn tool_use(&self) -> Style {
        Style::default()
            .fg(self.secondary)
            .add_modifier(Modifier::ITALIC)
    }
    
    /// Get input style
    pub fn input(&self) -> Style {
        Style::default()
            .fg(self.foreground)
            .bg(self.highlight)
    }
    
    /// Get border style
    pub fn border(&self) -> Style {
        Style::default().fg(self.border)
    }
    
    /// Get focused border style
    pub fn border_focused(&self) -> Style {
        Style::default().fg(self.primary)
    }
}

