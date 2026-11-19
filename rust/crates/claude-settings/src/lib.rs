//! Settings UI - Rich configuration interface
//!
//! Provides a TUI-based settings manager with forms,
//! validation, categories, and search.

use ratatui::{
    backend::Backend,
    layout::{Constraint, Direction, Layout, Margin, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span, Text},
    widgets::{Block, Borders, Clear, List, ListItem, Paragraph, Scrollbar, ScrollbarOrientation, ScrollbarState, Tabs, Wrap},
    Frame,
};
use crossterm::event::{KeyCode, KeyEvent};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{debug, error, info, instrument};

/// Settings manager state
pub struct SettingsUI {
    categories: Vec<SettingCategory>,
    current_category: usize,
    settings: HashMap<String, SettingValue>,
    selected_index: usize,
    scroll_offset: usize,
    mode: SettingsMode,
    search_query: String,
    dirty: bool,
    message: Option<(String, MessageType)>,
    message_time: Option<std::time::Instant>,
}

#[derive(Clone, Copy, PartialEq)]
pub enum SettingsMode {
    Browse,
    Edit,
    Search,
    ConfirmExit,
}

#[derive(Clone, Copy, PartialEq)]
pub enum MessageType {
    Info,
    Success,
    Warning,
    Error,
}

/// A category of settings
pub struct SettingCategory {
    pub name: String,
    pub icon: char,
    pub description: String,
    pub settings: Vec<SettingDefinition>,
}

/// Definition of a single setting
pub struct SettingDefinition {
    pub key: String,
    pub name: String,
    pub description: String,
    pub setting_type: SettingType,
    pub default_value: SettingValue,
    pub validation: Option<SettingValidation>,
    pub category: String,
}

/// Types of settings
pub enum SettingType {
    String { max_length: Option<usize>, multiline: bool },
    Integer { min: Option<i64>, max: Option<i64> },
    Float { min: Option<f64>, max: Option<f64>, precision: usize },
    Boolean,
    Choice { options: Vec<String> },
    MultipleChoice { options: Vec<String> },
    Path { must_exist: bool, is_directory: bool },
    Color,
    KeyBinding,
    List { item_type: Box<SettingType> },
    Map { key_type: Box<SettingType>, value_type: Box<SettingType> },
}

/// A setting value
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(untagged)]
pub enum SettingValue {
    String(String),
    Integer(i64),
    Float(f64),
    Boolean(bool),
    Choice(String),
    MultipleChoice(Vec<String>),
    Path(String),
    Color(String),
    KeyBinding(String),
    List(Vec<SettingValue>),
    Map(HashMap<String, SettingValue>),
    Null,
}

/// Validation rules
pub struct SettingValidation {
    pub required: bool,
    pub regex_pattern: Option<String>,
    pub custom_validator: Option<Box<dyn Fn(&SettingValue) -> Result<(), String>>>,
}

impl SettingsUI {
    /// Create new settings UI with default categories
    pub fn new() -> Self {
        let categories = vec![
            Self::create_general_category(),
            Self::create_editor_category(),
            Self::create_git_category(),
            Self::create_appearance_category(),
            Self::create_advanced_category(),
        ];
        
        Self {
            categories,
            current_category: 0,
            settings: HashMap::new(),
            selected_index: 0,
            scroll_offset: 0,
            mode: SettingsMode::Browse,
            search_query: String::new(),
            dirty: false,
            message: None,
            message_time: None,
        }
    }
    
    fn create_general_category() -> SettingCategory {
        SettingCategory {
            name: "General".to_string(),
            icon: '⚙',
            description: "General application settings".to_string(),
            settings: vec![
                SettingDefinition {
                    key: "auto_save".to_string(),
                    name: "Auto Save".to_string(),
                    description: "Automatically save files when idle".to_string(),
                    setting_type: SettingType::Boolean,
                    default_value: SettingValue::Boolean(true),
                    validation: None,
                    category: "general".to_string(),
                },
                SettingDefinition {
                    key: "auto_save_delay".to_string(),
                    name: "Auto Save Delay".to_string(),
                    description: "Delay in seconds before auto-saving".to_string(),
                    setting_type: SettingType::Integer { min: Some(1), max: Some(300) },
                    default_value: SettingValue::Integer(30),
                    validation: None,
                    category: "general".to_string(),
                },
                SettingDefinition {
                    key: "confirm_exit".to_string(),
                    name: "Confirm Exit".to_string(),
                    description: "Show confirmation when exiting with unsaved changes".to_string(),
                    setting_type: SettingType::Boolean,
                    default_value: SettingValue::Boolean(true),
                    validation: None,
                    category: "general".to_string(),
                },
                SettingDefinition {
                    key: "restore_session".to_string(),
                    name: "Restore Session".to_string(),
                    description: "Restore previous session on startup".to_string(),
                    setting_type: SettingType::Boolean,
                    default_value: SettingValue::Boolean(true),
                    validation: None,
                    category: "general".to_string(),
                },
                SettingDefinition {
                    key: "working_directory".to_string(),
                    name: "Working Directory".to_string(),
                    description: "Default working directory".to_string(),
                    setting_type: SettingType::Path { must_exist: true, is_directory: true },
                    default_value: SettingValue::Path(String::new()),
                    validation: None,
                    category: "general".to_string(),
                },
            ],
        }
    }
    
    fn create_editor_category() -> SettingCategory {
        SettingCategory {
            name: "Editor".to_string(),
            icon: '📝',
            description: "Text editor preferences".to_string(),
            settings: vec![
                SettingDefinition {
                    key: "tab_size".to_string(),
                    name: "Tab Size".to_string(),
                    description: "Number of spaces per tab".to_string(),
                    setting_type: SettingType::Integer { min: Some(1), max: Some(16) },
                    default_value: SettingValue::Integer(4),
                    validation: None,
                    category: "editor".to_string(),
                },
                SettingDefinition {
                    key: "use_spaces".to_string(),
                    name: "Use Spaces".to_string(),
                    description: "Use spaces instead of tabs".to_string(),
                    setting_type: SettingType::Boolean,
                    default_value: SettingValue::Boolean(true),
                    validation: None,
                    category: "editor".to_string(),
                },
                SettingDefinition {
                    key: "word_wrap".to_string(),
                    name: "Word Wrap".to_string(),
                    description: "Wrap long lines".to_string(),
                    setting_type: SettingType::Choice { 
                        options: vec!["off".to_string(), "on".to_string(), "word".to_string(), "column".to_string()]
                    },
                    default_value: SettingValue::Choice("on".to_string()),
                    validation: None,
                    category: "editor".to_string(),
                },
                SettingDefinition {
                    key: "rulers".to_string(),
                    name: "Rulers".to_string(),
                    description: "Column numbers to show rulers at".to_string(),
                    setting_type: SettingType::List { 
                        item_type: Box::new(SettingType::Integer { min: Some(1), max: Some(1000) })
                    },
                    default_value: SettingValue::List(vec![SettingValue::Integer(80), SettingValue::Integer(120)]),
                    validation: None,
                    category: "editor".to_string(),
                },
                SettingDefinition {
                    key: "format_on_save".to_string(),
                    name: "Format on Save".to_string(),
                    description: "Automatically format code when saving".to_string(),
                    setting_type: SettingType::Boolean,
                    default_value: SettingValue::Boolean(true),
                    validation: None,
                    category: "editor".to_string(),
                },
                SettingDefinition {
                    key: "trim_trailing_whitespace".to_string(),
                    name: "Trim Trailing Whitespace".to_string(),
                    description: "Remove trailing whitespace on save".to_string(),
                    setting_type: SettingType::Boolean,
                    default_value: SettingValue::Boolean(true),
                    validation: None,
                    category: "editor".to_string(),
                },
                SettingDefinition {
                    key: "insert_final_newline".to_string(),
                    name: "Insert Final Newline".to_string(),
                    description: "Ensure file ends with a newline".to_string(),
                    setting_type: SettingType::Boolean,
                    default_value: SettingValue::Boolean(true),
                    validation: None,
                    category: "editor".to_string(),
                },
            ],
        }
    }
    
    fn create_git_category() -> SettingCategory {
        SettingCategory {
            name: "Git".to_string(),
            icon: '🔀',
            description: "Git integration settings".to_string(),
            settings: vec![
                SettingDefinition {
                    key: "git.confirm_sync".to_string(),
                    name: "Confirm Sync".to_string(),
                    description: "Confirm before push/pull".to_string(),
                    setting_type: SettingType::Boolean,
                    default_value: SettingValue::Boolean(true),
                    validation: None,
                    category: "git".to_string(),
                },
                SettingDefinition {
                    key: "git.confirm_force_push".to_string(),
                    name: "Confirm Force Push".to_string(),
                    description: "Extra confirmation for force push".to_string(),
                    setting_type: SettingType::Boolean,
                    default_value: SettingValue::Boolean(true),
                    validation: None,
                    category: "git".to_string(),
                },
                SettingDefinition {
                    key: "git.enable_smart_commit".to_string(),
                    name: "Smart Commit".to_string(),
                    description: "Automatically stage all changes when committing".to_string(),
                    setting_type: SettingType::Boolean,
                    default_value: SettingValue::Boolean(true),
                    validation: None,
                    category: "git".to_string(),
                },
                SettingDefinition {
                    key: "git.default_branch_name".to_string(),
                    name: "Default Branch Name".to_string(),
                    description: "Default name for new branches".to_string(),
                    setting_type: SettingType::String { max_length: Some(50), multiline: false },
                    default_value: SettingValue::String("main".to_string()),
                    validation: None,
                    category: "git".to_string(),
                },
                SettingDefinition {
                    key: "git.sign_commits".to_string(),
                    name: "Sign Commits".to_string(),
                    description: "Sign commits with GPG".to_string(),
                    setting_type: SettingType::Boolean,
                    default_value: SettingValue::Boolean(false),
                    validation: None,
                    category: "git".to_string(),
                },
            ],
        }
    }
    
    fn create_appearance_category() -> SettingCategory {
        SettingCategory {
            name: "Appearance".to_string(),
            icon: '🎨',
            description: "Visual appearance settings".to_string(),
            settings: vec![
                SettingDefinition {
                    key: "theme".to_string(),
                    name: "Theme".to_string(),
                    description: "Color theme".to_string(),
                    setting_type: SettingType::Choice { 
                        options: vec![
                            "Dark".to_string(),
                            "Light".to_string(),
                            "High Contrast".to_string(),
                            "Dracula".to_string(),
                            "Monokai".to_string(),
                            "Solarized Dark".to_string(),
                            "Solarized Light".to_string(),
                        ]
                    },
                    default_value: SettingValue::Choice("Dark".to_string()),
                    validation: None,
                    category: "appearance".to_string(),
                },
                SettingDefinition {
                    key: "font_size".to_string(),
                    name: "Font Size".to_string(),
                    description: "Editor font size".to_string(),
                    setting_type: SettingType::Integer { min: Some(8), max: Some(32) },
                    default_value: SettingValue::Integer(14),
                    validation: None,
                    category: "appearance".to_string(),
                },
                SettingDefinition {
                    key: "line_height".to_string(),
                    name: "Line Height".to_string(),
                    description: "Line height multiplier".to_string(),
                    setting_type: SettingType::Float { min: Some(1.0), max: Some(3.0), precision: 1 },
                    default_value: SettingValue::Float(1.5),
                    validation: None,
                    category: "appearance".to_string(),
                },
                SettingDefinition {
                    key: "show_line_numbers".to_string(),
                    name: "Line Numbers".to_string(),
                    description: "Show line numbers".to_string(),
                    setting_type: SettingType::Choice { 
                        options: vec!["on".to_string(), "off".to_string(), "relative".to_string()]
                    },
                    default_value: SettingValue::Choice("on".to_string()),
                    validation: None,
                    category: "appearance".to_string(),
                },
                SettingDefinition {
                    key: "highlight_current_line".to_string(),
                    name: "Highlight Current Line".to_string(),
                    description: "Highlight the current line".to_string(),
                    setting_type: SettingType::Boolean,
                    default_value: SettingValue::Boolean(true),
                    validation: None,
                    category: "appearance".to_string(),
                },
                SettingDefinition {
                    key: "show_whitespace".to_string(),
                    name: "Show Whitespace".to_string(),
                    description: "Show whitespace characters".to_string(),
                    setting_type: SettingType::Boolean,
                    default_value: SettingValue::Boolean(false),
                    validation: None,
                    category: "appearance".to_string(),
                },
            ],
        }
    }
    
    fn create_advanced_category() -> SettingCategory {
        SettingCategory {
            name: "Advanced".to_string(),
            icon: '⚡',
            description: "Advanced configuration".to_string(),
            settings: vec![
                SettingDefinition {
                    key: "max_file_size_mb".to_string(),
                    name: "Max File Size (MB)".to_string(),
                    description: "Maximum file size to open in editor".to_string(),
                    setting_type: SettingType::Integer { min: Some(1), max: Some(1000) },
                    default_value: SettingValue::Integer(50),
                    validation: None,
                    category: "advanced".to_string(),
                },
                SettingDefinition {
                    key: "enable_experimental".to_string(),
                    name: "Enable Experimental Features".to_string(),
                    description: "Enable experimental features".to_string(),
                    setting_type: SettingType::Boolean,
                    default_value: SettingValue::Boolean(false),
                    validation: None,
                    category: "advanced".to_string(),
                },
                SettingDefinition {
                    key: "log_level".to_string(),
                    name: "Log Level".to_string(),
                    description: "Logging verbosity".to_string(),
                    setting_type: SettingType::Choice { 
                        options: vec![
                            "error".to_string(),
                            "warn".to_string(),
                            "info".to_string(),
                            "debug".to_string(),
                            "trace".to_string(),
                        ]
                    },
                    default_value: SettingValue::Choice("info".to_string()),
                    validation: None,
                    category: "advanced".to_string(),
                },
                SettingDefinition {
                    key: "telemetry".to_string(),
                    name: "Telemetry".to_string(),
                    description: "Send anonymous usage data".to_string(),
                    setting_type: SettingType::Boolean,
                    default_value: SettingValue::Boolean(true),
                    validation: None,
                    category: "advanced".to_string(),
                },
                SettingDefinition {
                    key: "auto_update".to_string(),
                    name: "Auto Update".to_string(),
                    description: "Automatically check for updates".to_string(),
                    setting_type: SettingType::Boolean,
                    default_value: SettingValue::Boolean(true),
                    validation: None,
                    category: "advanced".to_string(),
                },
            ],
        }
    }
    
    /// Load settings from file
    pub fn load(&mut self, path: &std::path::Path) -> Result<(), Box<dyn std::error::Error>> {
        if path.exists() {
            let content = std::fs::read_to_string(path)?;
            let loaded: HashMap<String, SettingValue> = serde_json::from_str(&content)?;
            self.settings = loaded;
            info!("Loaded settings from {:?}", path);
        }
        Ok(())
    }
    
    /// Save settings to file
    pub fn save(&self, path: &std::path::Path) -> Result<(), Box<dyn std::error::Error>> {
        let content = serde_json::to_string_pretty(&self.settings)?;
        std::fs::write(path, content)?;
        info!("Saved settings to {:?}", path);
        Ok(())
    }
    
    /// Get a setting value
    pub fn get(&self, key: &str) -> Option<&SettingValue> {
        self.settings.get(key).or_else(|| {
            // Return default if not set
            for category in &self.categories {
                for setting in &category.settings {
                    if setting.key == key {
                        return Some(&setting.default_value);
                    }
                }
            }
            None
        })
    }
    
    /// Set a setting value
    pub fn set(&mut self, key: String, value: SettingValue) {
        self.settings.insert(key, value);
        self.dirty = true;
    }
    
    /// Render the settings UI
    pub fn render<B: Backend>(&self, frame: &mut Frame<B>, area: Rect) {
        let chunks = Layout::default()
            .direction(Direction::Vertical)
            .constraints([Constraint::Length(3), Constraint::Min(0), Constraint::Length(3)])
            .split(area);
        
        // Header with tabs
        self.render_header(frame, chunks[0]);
        
        // Main content
        self.render_content(frame, chunks[1]);
        
        // Footer with help
        self.render_footer(frame, chunks[2]);
        
        // Show message if present
        if let Some((ref msg, msg_type)) = self.message {
            if self.message_time.map(|t| t.elapsed().as_secs() < 5).unwrap_or(false) {
                self.render_message(frame, area, msg, msg_type);
            }
        }
    }
    
    fn render_header<B: Backend>(&self, frame: &mut Frame<B>, area: Rect) {
        let titles: Vec<Line> = self.categories.iter().map(|c| {
            Line::from(vec![
                Span::raw(format!("{} ", c.icon)),
                Span::raw(c.name.clone()),
            ])
        }).collect();
        
        let tabs = Tabs::new(titles)
            .select(self.current_category)
            .block(Block::default().title("Settings").borders(Borders::ALL))
            .highlight_style(Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD))
            .divider(Span::raw(" | "));
        
        frame.render_widget(tabs, area);
    }
    
    fn render_content<B: Backend>(&self, frame: &mut Frame<B>, area: Rect) {
        let category = &self.categories[self.current_category];
        
        let items: Vec<ListItem> = category.settings.iter().enumerate()
            .filter(|(_, setting)| {
                // Apply search filter
                if self.mode == SettingsMode::Search && !self.search_query.is_empty() {
                    let query = self.search_query.to_lowercase();
                    setting.name.to_lowercase().contains(&query) ||
                    setting.description.to_lowercase().contains(&query)
                } else {
                    true
                }
            })
            .map(|(idx, setting)| {
                let is_selected = idx == self.selected_index;
                
                let value = self.settings.get(&setting.key)
                    .unwrap_or(&setting.default_value);
                
                let value_str = format!("{:?}", value);
                let value_str = if value_str.len() > 40 {
                    format!("{}...", &value_str[..37])
                } else {
                    value_str
                };
                
                let lines = vec![
                    Line::from(vec![
                        Span::styled(
                            setting.name.clone(),
                            if is_selected {
                                Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)
                            } else {
                                Style::default()
                            }
                        ),
                        Span::raw(" "),
                        Span::styled(
                            value_str,
                            Style::default().fg(Color::Green)
                        ),
                    ]),
                    Line::from(vec![
                        Span::styled(
                            format!("  {}", setting.description),
                            Style::default().fg(Color::DarkGray)
                        ),
                    ]),
                ];
                
                ListItem::new(Text::from(lines))
            })
            .collect();
        
        let list = List::new(items)
            .block(Block::default()
                .title(format!("{} - {}", category.name, category.description))
                .borders(Borders::ALL))
            .highlight_style(Style::default().bg(Color::Blue).fg(Color::White));
        
        frame.render_widget(list, area);
    }
    
    fn render_footer<B: Backend>(&self, frame: &mut Frame<B>, area: Rect) {
        let help_text = match self.mode {
            SettingsMode::Browse => {
                "Tab: next category | ↑↓: navigate | Enter: edit | /: search | s: save | q: quit"
            }
            SettingsMode::Edit => {
                "Type to edit | Enter: confirm | Esc: cancel"
            }
            SettingsMode::Search => {
                "Type to search | Enter: apply | Esc: clear"
            }
            SettingsMode::ConfirmExit => {
                "y: save and exit | n: discard and exit | c: cancel"
            }
        };
        
        let status = if self.dirty {
            Span::styled(" [Modified] ", Style::default().fg(Color::Yellow))
        } else {
            Span::raw("")
        };
        
        let footer = Paragraph::new(Line::from(vec![
            Span::raw(help_text),
            status,
        ]))
        .block(Block::default().borders(Borders::ALL));
        
        frame.render_widget(footer, area);
    }
    
    fn render_message<B: Backend>(&self, frame: &mut Frame<B>, area: Rect, msg: &str, msg_type: MessageType) {
        let color = match msg_type {
            MessageType::Info => Color::Blue,
            MessageType::Success => Color::Green,
            MessageType::Warning => Color::Yellow,
            MessageType::Error => Color::Red,
        };
        
        let popup_area = Self::centered_rect(60, 20, area);
        
        frame.render_widget(Clear, popup_area);
        
        let paragraph = Paragraph::new(msg.to_string())
            .block(Block::default()
                .title("Message")
                .borders(Borders::ALL)
                .border_style(Style::default().fg(color)))
            .alignment(ratatui::layout::Alignment::Center)
            .wrap(Wrap { trim: true });
        
        frame.render_widget(paragraph, popup_area);
    }
    
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
    
    /// Handle input
    pub fn handle_input(&mut self, key: KeyEvent) -> SettingsAction {
        match self.mode {
            SettingsMode::Browse => self.handle_browse_input(key),
            SettingsMode::Edit => self.handle_edit_input(key),
            SettingsMode::Search => self.handle_search_input(key),
            SettingsMode::ConfirmExit => self.handle_confirm_input(key),
        }
    }
    
    fn handle_browse_input(&mut self, key: KeyEvent) -> SettingsAction {
        match key.code {
            KeyCode::Tab | KeyCode::Char('l') | KeyCode::Right => {
                self.current_category = (self.current_category + 1) % self.categories.len();
                self.selected_index = 0;
                SettingsAction::None
            }
            KeyCode::BackTab | KeyCode::Char('h') | KeyCode::Left => {
                if self.current_category > 0 {
                    self.current_category -= 1;
                } else {
                    self.current_category = self.categories.len() - 1;
                }
                self.selected_index = 0;
                SettingsAction::None
            }
            KeyCode::Char('j') | KeyCode::Down => {
                let category = &self.categories[self.current_category];
                if self.selected_index < category.settings.len().saturating_sub(1) {
                    self.selected_index += 1;
                }
                SettingsAction::None
            }
            KeyCode::Char('k') | KeyCode::Up => {
                if self.selected_index > 0 {
                    self.selected_index -= 1;
                }
                SettingsAction::None
            }
            KeyCode::Enter => {
                self.mode = SettingsMode::Edit;
                SettingsAction::StartEdit
            }
            KeyCode::Char('/') => {
                self.mode = SettingsMode::Search;
                self.search_query.clear();
                SettingsAction::StartSearch
            }
            KeyCode::Char('s') => {
                SettingsAction::Save
            }
            KeyCode::Char('q') | KeyCode::Esc => {
                if self.dirty {
                    self.mode = SettingsMode::ConfirmExit;
                    SettingsAction::None
                } else {
                    SettingsAction::Quit
                }
            }
            _ => SettingsAction::None,
        }
    }
    
    fn handle_edit_input(&mut self, key: KeyEvent) -> SettingsAction {
        match key.code {
            KeyCode::Esc => {
                self.mode = SettingsMode::Browse;
                SettingsAction::CancelEdit
            }
            KeyCode::Enter => {
                self.mode = SettingsMode::Browse;
                SettingsAction::ConfirmEdit
            }
            _ => SettingsAction::None,
        }
    }
    
    fn handle_search_input(&mut self, key: KeyEvent) -> SettingsAction {
        match key.code {
            KeyCode::Esc => {
                self.mode = SettingsMode::Browse;
                self.search_query.clear();
                SettingsAction::None
            }
            KeyCode::Enter => {
                self.mode = SettingsMode::Browse;
                SettingsAction::ApplySearch
            }
            KeyCode::Char(c) => {
                self.search_query.push(c);
                SettingsAction::None
            }
            KeyCode::Backspace => {
                self.search_query.pop();
                SettingsAction::None
            }
            _ => SettingsAction::None,
        }
    }
    
    fn handle_confirm_input(&mut self, key: KeyEvent) -> SettingsAction {
        match key.code {
            KeyCode::Char('y') | KeyCode::Char('Y') => {
                SettingsAction::SaveAndQuit
            }
            KeyCode::Char('n') | KeyCode::Char('N') => {
                SettingsAction::Quit
            }
            KeyCode::Char('c') | KeyCode::Char('C') | KeyCode::Esc => {
                self.mode = SettingsMode::Browse;
                SettingsAction::None
            }
            _ => SettingsAction::None,
        }
    }
    
    /// Show a message
    pub fn show_message(&mut self, msg: String, msg_type: MessageType) {
        self.message = Some((msg, msg_type));
        self.message_time = Some(std::time::Instant::now());
    }
    
    /// Check if there are unsaved changes
    pub fn is_dirty(&self) -> bool {
        self.dirty
    }
}

/// Settings actions
#[derive(Clone, Debug)]
pub enum SettingsAction {
    None,
    Save,
    Quit,
    SaveAndQuit,
    StartEdit,
    ConfirmEdit,
    CancelEdit,
    StartSearch,
    ApplySearch,
}

