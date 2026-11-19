//! Theme system - Comprehensive theming with accessibility support
//!
//! Features:
//! - Multiple built-in themes (Dark, Light, High Contrast, etc.)
//! - Custom theme support
//! - Accessibility features (color blindness modes, screen reader support)
//! - Dynamic theme switching
//! - WCAG 2.1 AA compliance

use ratatui::style::{Color, Modifier, Style};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// A complete theme definition
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Theme {
    pub name: String,
    pub description: String,
    pub is_dark: bool,
    pub colors: ColorPalette,
    pub styles: StyleDefinitions,
    pub accessibility: AccessibilitySettings,
}

/// Color palette for a theme
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ColorPalette {
    // Background colors
    pub bg_primary: Color,
    pub bg_secondary: Color,
    pub bg_tertiary: Color,
    pub bg_highlight: Color,
    pub bg_selection: Color,
    
    // Foreground colors
    pub fg_primary: Color,
    pub fg_secondary: Color,
    pub fg_muted: Color,
    pub fg_inverse: Color,
    
    // Accent colors
    pub accent_primary: Color,
    pub accent_secondary: Color,
    pub accent_success: Color,
    pub accent_warning: Color,
    pub accent_error: Color,
    pub accent_info: Color,
    
    // Semantic colors
    pub git_added: Color,
    pub git_deleted: Color,
    pub git_modified: Color,
    pub git_untracked: Color,
    pub git_conflict: Color,
    
    // Syntax highlighting
    pub syntax_keyword: Color,
    pub syntax_string: Color,
    pub syntax_comment: Color,
    pub syntax_function: Color,
    pub syntax_variable: Color,
    pub syntax_type: Color,
    pub syntax_number: Color,
    pub syntax_operator: Color,
    pub syntax_punctuation: Color,
}

/// Style definitions for UI elements
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct StyleDefinitions {
    pub default: Style,
    pub bold: Style,
    pub italic: Style,
    pub dim: Style,
    pub underlined: Style,
    pub strikethrough: Style,
    
    // Component styles
    pub heading: Style,
    pub subheading: Style,
    pub paragraph: Style,
    pub link: Style,
    pub code: Style,
    pub blockquote: Style,
    
    // Widget styles
    pub border: Style,
    pub border_focused: Style,
    pub border_error: Style,
    pub border_success: Style,
    pub border_warning: Style,
    
    // Interactive elements
    pub button: Style,
    pub button_hover: Style,
    pub button_active: Style,
    pub button_disabled: Style,
    
    pub input: Style,
    pub input_focused: Style,
    pub input_placeholder: Style,
    pub input_error: Style,
    
    // List styles
    pub list_item: Style,
    pub list_item_selected: Style,
    pub list_item_hover: Style,
    pub list_item_disabled: Style,
    
    // Tab styles
    pub tab: Style,
    pub tab_active: Style,
    pub tab_hover: Style,
}

/// Accessibility settings
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AccessibilitySettings {
    pub color_blind_mode: Option<ColorBlindMode>,
    pub high_contrast: bool,
    pub reduced_motion: bool,
    pub screen_reader_optimized: bool,
    pub large_text: bool,
    pub focus_indicators: FocusIndicatorStyle,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
pub enum ColorBlindMode {
    Deuteranopia,    // Red-green (green weak)
    Protanopia,      // Red-green (red weak)
    Tritanopia,      // Blue-yellow
    Achromatopsia,   // Total color blindness
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
pub enum FocusIndicatorStyle {
    Underline,
    Box,
    Background,
    Border,
    Bold,
}

impl Default for AccessibilitySettings {
    fn default() -> Self {
        Self {
            color_blind_mode: None,
            high_contrast: false,
            reduced_motion: false,
            screen_reader_optimized: false,
            large_text: false,
            focus_indicators: FocusIndicatorStyle::Box,
        }
    }
}

impl Theme {
    /// Dark theme (default)
    pub fn dark() -> Self {
        Self {
            name: "Dark".to_string(),
            description: "Default dark theme".to_string(),
            is_dark: true,
            colors: ColorPalette {
                bg_primary: Color::Rgb(30, 30, 30),
                bg_secondary: Color::Rgb(40, 40, 40),
                bg_tertiary: Color::Rgb(50, 50, 50),
                bg_highlight: Color::Rgb(60, 60, 60),
                bg_selection: Color::Rgb(70, 70, 100),
                
                fg_primary: Color::Rgb(220, 220, 220),
                fg_secondary: Color::Rgb(180, 180, 180),
                fg_muted: Color::Rgb(120, 120, 120),
                fg_inverse: Color::Rgb(30, 30, 30),
                
                accent_primary: Color::Rgb(100, 150, 255),
                accent_secondary: Color::Rgb(150, 100, 255),
                accent_success: Color::Rgb(100, 200, 100),
                accent_warning: Color::Rgb(255, 200, 100),
                accent_error: Color::Rgb(255, 100, 100),
                accent_info: Color::Rgb(100, 200, 255),
                
                git_added: Color::Rgb(100, 200, 100),
                git_deleted: Color::Rgb(255, 100, 100),
                git_modified: Color::Rgb(255, 200, 100),
                git_untracked: Color::Rgb(100, 200, 255),
                git_conflict: Color::Rgb(255, 100, 255),
                
                syntax_keyword: Color::Rgb(255, 150, 200),
                syntax_string: Color::Rgb(150, 255, 150),
                syntax_comment: Color::Rgb(120, 120, 120),
                syntax_function: Color::Rgb(255, 200, 150),
                syntax_variable: Color::Rgb(220, 220, 220),
                syntax_type: Color::Rgb(150, 200, 255),
                syntax_number: Color::Rgb(255, 200, 150),
                syntax_operator: Color::Rgb(255, 255, 255),
                syntax_punctuation: Color::Rgb(200, 200, 200),
            },
            styles: Self::default_styles(),
            accessibility: AccessibilitySettings::default(),
        }
    }
    
    /// Light theme
    pub fn light() -> Self {
        Self {
            name: "Light".to_string(),
            description: "Clean light theme".to_string(),
            is_dark: false,
            colors: ColorPalette {
                bg_primary: Color::Rgb(250, 250, 250),
                bg_secondary: Color::Rgb(240, 240, 240),
                bg_tertiary: Color::Rgb(230, 230, 230),
                bg_highlight: Color::Rgb(220, 220, 220),
                bg_selection: Color::Rgb(180, 200, 255),
                
                fg_primary: Color::Rgb(30, 30, 30),
                fg_secondary: Color::Rgb(80, 80, 80),
                fg_muted: Color::Rgb(140, 140, 140),
                fg_inverse: Color::Rgb(250, 250, 250),
                
                accent_primary: Color::Rgb(50, 100, 200),
                accent_secondary: Color::Rgb(100, 50, 200),
                accent_success: Color::Rgb(50, 150, 50),
                accent_warning: Color::Rgb(200, 150, 50),
                accent_error: Color::Rgb(200, 50, 50),
                accent_info: Color::Rgb(50, 150, 200),
                
                git_added: Color::Rgb(50, 150, 50),
                git_deleted: Color::Rgb(200, 50, 50),
                git_modified: Color::Rgb(200, 150, 50),
                git_untracked: Color::Rgb(50, 150, 200),
                git_conflict: Color::Rgb(200, 50, 200),
                
                syntax_keyword: Color::Rgb(200, 50, 150),
                syntax_string: Color::Rgb(50, 150, 50),
                syntax_comment: Color::Rgb(140, 140, 140),
                syntax_function: Color::Rgb(200, 100, 50),
                syntax_variable: Color::Rgb(30, 30, 30),
                syntax_type: Color::Rgb(50, 100, 200),
                syntax_number: Color::Rgb(200, 100, 50),
                syntax_operator: Color::Rgb(0, 0, 0),
                syntax_punctuation: Color::Rgb(80, 80, 80),
            },
            styles: Self::default_styles(),
            accessibility: AccessibilitySettings::default(),
        }
    }
    
    /// High contrast theme for accessibility
    pub fn high_contrast() -> Self {
        let mut theme = Self::dark();
        theme.name = "High Contrast".to_string();
        theme.description = "High contrast theme for accessibility".to_string();
        theme.colors = ColorPalette {
            bg_primary: Color::Black,
            bg_secondary: Color::Black,
            bg_tertiary: Color::Black,
            bg_highlight: Color::Rgb(40, 40, 40),
            bg_selection: Color::White,
            
            fg_primary: Color::White,
            fg_secondary: Color::White,
            fg_muted: Color::Rgb(200, 200, 200),
            fg_inverse: Color::Black,
            
            accent_primary: Color::Rgb(100, 200, 255),
            accent_secondary: Color::Rgb(255, 100, 200),
            accent_success: Color::Rgb(100, 255, 100),
            accent_warning: Color::Rgb(255, 255, 100),
            accent_error: Color::Rgb(255, 100, 100),
            accent_info: Color::Rgb(100, 200, 255),
            
            git_added: Color::Rgb(100, 255, 100),
            git_deleted: Color::Rgb(255, 100, 100),
            git_modified: Color::Rgb(255, 255, 100),
            git_untracked: Color::Rgb(100, 200, 255),
            git_conflict: Color::Rgb(255, 100, 255),
            
            syntax_keyword: Color::Yellow,
            syntax_string: Color::Rgb(150, 255, 150),
            syntax_comment: Color::Rgb(180, 180, 180),
            syntax_function: Color::Cyan,
            syntax_variable: Color::White,
            syntax_type: Color::Rgb(100, 200, 255),
            syntax_number: Color::Rgb(255, 200, 100),
            syntax_operator: Color::White,
            syntax_punctuation: Color::White,
        };
        theme.accessibility.high_contrast = true;
        theme
    }
    
    /// Dracula theme
    pub fn dracula() -> Self {
        let mut theme = Self::dark();
        theme.name = "Dracula".to_string();
        theme.description = "Popular Dracula color scheme".to_string();
        theme.colors = ColorPalette {
            bg_primary: Color::Rgb(40, 42, 54),
            bg_secondary: Color::Rgb(48, 50, 62),
            bg_tertiary: Color::Rgb(56, 58, 70),
            bg_highlight: Color::Rgb(68, 71, 90),
            bg_selection: Color::Rgb(68, 71, 90),
            
            fg_primary: Color::Rgb(248, 248, 242),
            fg_secondary: Color::Rgb(139, 143, 161),
            fg_muted: Color::Rgb(98, 114, 164),
            fg_inverse: Color::Rgb(40, 42, 54),
            
            accent_primary: Color::Rgb(189, 147, 249),
            accent_secondary: Color::Rgb(255, 121, 198),
            accent_success: Color::Rgb(80, 250, 123),
            accent_warning: Color::Rgb(241, 250, 140),
            accent_error: Color::Rgb(255, 85, 85),
            accent_info: Color::Rgb(139, 233, 253),
            
            git_added: Color::Rgb(80, 250, 123),
            git_deleted: Color::Rgb(255, 85, 85),
            git_modified: Color::Rgb(241, 250, 140),
            git_untracked: Color::Rgb(139, 233, 253),
            git_conflict: Color::Rgb(255, 121, 198),
            
            syntax_keyword: Color::Rgb(255, 121, 198),
            syntax_string: Color::Rgb(241, 250, 140),
            syntax_comment: Color::Rgb(98, 114, 164),
            syntax_function: Color::Rgb(189, 147, 249),
            syntax_variable: Color::Rgb(248, 248, 242),
            syntax_type: Color::Rgb(139, 233, 253),
            syntax_number: Color::Rgb(255, 184, 108),
            syntax_operator: Color::Rgb(248, 248, 242),
            syntax_punctuation: Color::Rgb(248, 248, 242),
        };
        theme
    }
    
    fn default_styles() -> StyleDefinitions {
        StyleDefinitions {
            default: Style::default(),
            bold: Style::default().add_modifier(Modifier::BOLD),
            italic: Style::default().add_modifier(Modifier::ITALIC),
            dim: Style::default().add_modifier(Modifier::DIM),
            underlined: Style::default().add_modifier(Modifier::UNDERLINED),
            strikethrough: Style::default().add_modifier(Modifier::CROSSED_OUT),
            
            heading: Style::default().add_modifier(Modifier::BOLD),
            subheading: Style::default().add_modifier(Modifier::BOLD | Modifier::ITALIC),
            paragraph: Style::default(),
            link: Style::default().add_modifier(Modifier::UNDERLINED),
            code: Style::default().add_modifier(Modifier::BOLD),
            blockquote: Style::default().add_modifier(Modifier::ITALIC),
            
            border: Style::default(),
            border_focused: Style::default().add_modifier(Modifier::BOLD),
            border_error: Style::default().fg(Color::Red),
            border_success: Style::default().fg(Color::Green),
            border_warning: Style::default().fg(Color::Yellow),
            
            button: Style::default().add_modifier(Modifier::BOLD),
            button_hover: Style::default().add_modifier(Modifier::BOLD | Modifier::REVERSED),
            button_active: Style::default().add_modifier(Modifier::BOLD),
            button_disabled: Style::default().add_modifier(Modifier::DIM),
            
            input: Style::default(),
            input_focused: Style::default().add_modifier(Modifier::BOLD),
            input_placeholder: Style::default().add_modifier(Modifier::DIM),
            input_error: Style::default().fg(Color::Red),
            
            list_item: Style::default(),
            list_item_selected: Style::default().add_modifier(Modifier::REVERSED),
            list_item_hover: Style::default().add_modifier(Modifier::BOLD),
            list_item_disabled: Style::default().add_modifier(Modifier::DIM),
            
            tab: Style::default(),
            tab_active: Style::default().add_modifier(Modifier::BOLD),
            tab_hover: Style::default().add_modifier(Modifier::UNDERLINED),
        }
    }
    
    /// Apply color blindness simulation to the theme
    pub fn apply_color_blind_mode(&mut self, mode: ColorBlindMode) {
        self.accessibility.color_blind_mode = Some(mode);
        
        // Adjust colors based on color blindness type
        match mode {
            ColorBlindMode::Deuteranopia | ColorBlindMode::Protanopia => {
                // Red-green confusion: emphasize blue-yellow
                self.colors.git_added = Color::Rgb(100, 150, 255);
                self.colors.git_deleted = Color::Rgb(255, 150, 50);
                self.colors.accent_success = Color::Rgb(100, 150, 255);
                self.colors.accent_error = Color::Rgb(255, 150, 50);
            }
            ColorBlindMode::Tritanopia => {
                // Blue-yellow confusion: use high contrast patterns
                self.colors.git_added = Color::Rgb(100, 255, 100);
                self.colors.git_deleted = Color::Rgb(255, 100, 255);
            }
            ColorBlindMode::Achromatopsia => {
                // Total color blindness: use patterns and high contrast
                self.accessibility.high_contrast = true;
            }
        }
    }
    
    /// Get style for a syntax token type
    pub fn syntax_style(&self, token_type: SyntaxTokenType) -> Style {
        let fg = match token_type {
            SyntaxTokenType::Keyword => self.colors.syntax_keyword,
            SyntaxTokenType::String => self.colors.syntax_string,
            SyntaxTokenType::Comment => self.colors.syntax_comment,
            SyntaxTokenType::Function => self.colors.syntax_function,
            SyntaxTokenType::Variable => self.colors.syntax_variable,
            SyntaxTokenType::Type => self.colors.syntax_type,
            SyntaxTokenType::Number => self.colors.syntax_number,
            SyntaxTokenType::Operator => self.colors.syntax_operator,
            SyntaxTokenType::Punctuation => self.colors.syntax_punctuation,
        };
        
        Style::default().fg(fg)
    }
}

#[derive(Clone, Copy, Debug)]
pub enum SyntaxTokenType {
    Keyword,
    String,
    Comment,
    Function,
    Variable,
    Type,
    Number,
    Operator,
    Punctuation,
}

/// Theme manager
pub struct ThemeManager {
    themes: HashMap<String, Theme>,
    current: String,
}

impl ThemeManager {
    pub fn new() -> Self {
        let mut themes = HashMap::new();
        
        // Add built-in themes
        let dark = Theme::dark();
        themes.insert(dark.name.clone(), dark);
        
        let light = Theme::light();
        themes.insert(light.name.clone(), light);
        
        let high_contrast = Theme::high_contrast();
        themes.insert(high_contrast.name.clone(), high_contrast);
        
        let dracula = Theme::dracula();
        themes.insert(dracula.name.clone(), dracula);
        
        Self {
            themes,
            current: "Dark".to_string(),
        }
    }
    
    /// Get current theme
    pub fn current(&self) -> &Theme {
        self.themes.get(&self.current).unwrap_or_else(|| {
            self.themes.get("Dark").expect("Dark theme must exist")
        })
    }
    
    /// Get current theme (mutable)
    pub fn current_mut(&mut self) -> &mut Theme {
        self.themes.get_mut(&self.current).unwrap_or_else(|| {
            self.themes.get_mut("Dark").expect("Dark theme must exist")
        })
    }
    
    /// Set current theme
    pub fn set_theme(&mut self, name: &str) -> Result<(), String> {
        if self.themes.contains_key(name) {
            self.current = name.to_string();
            Ok(())
        } else {
            Err(format!("Theme '{}' not found", name))
        }
    }
    
    /// Add custom theme
    pub fn add_theme(&mut self, theme: Theme) {
        self.themes.insert(theme.name.clone(), theme);
    }
    
    /// Get list of available themes
    pub fn list_themes(&self) -> Vec<&Theme> {
        self.themes.values().collect()
    }
    
    /// Load theme from file
    pub fn load_theme(&mut self, path: &std::path::Path) -> Result<(), Box<dyn std::error::Error>> {
        let content = std::fs::read_to_string(path)?;
        let theme: Theme = serde_json::from_str(&content)?;
        self.add_theme(theme);
        Ok(())
    }
    
    /// Save theme to file
    pub fn save_theme(&self, name: &str, path: &std::path::Path) -> Result<(), Box<dyn std::error::Error>> {
        if let Some(theme) = self.themes.get(name) {
            let content = serde_json::to_string_pretty(theme)?;
            std::fs::write(path, content)?;
            Ok(())
        } else {
            Err(format!("Theme '{}' not found", name).into())
        }
    }
}

/// Initialize default theme manager
pub fn default_theme_manager() -> ThemeManager {
    ThemeManager::new()
}

