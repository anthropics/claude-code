//! Input handling

use crossterm::event::{KeyCode, KeyEvent, KeyModifiers};

/// Input action
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum InputAction {
    /// No action
    None,
    /// Insert character
    Insert(char),
    /// Backspace
    Backspace,
    /// Delete
    Delete,
    /// Move cursor left
    CursorLeft,
    /// Move cursor right
    CursorRight,
    /// Move cursor to start
    CursorHome,
    /// Move cursor to end
    CursorEnd,
    /// Submit input
    Submit,
    /// Cancel/escape
    Cancel,
    /// Previous history
    HistoryPrevious,
    /// Next history
    HistoryNext,
    /// Clear line
    ClearLine,
}

/// Handle key event and convert to action
pub fn handle_key_event(key: KeyEvent) -> InputAction {
    match key.code {
        KeyCode::Char(c) => {
            if key.modifiers.contains(KeyModifiers::CONTROL) {
                match c {
                    'c' => InputAction::Cancel,
                    'a' => InputAction::CursorHome,
                    'e' => InputAction::CursorEnd,
                    'u' => InputAction::ClearLine,
                    _ => InputAction::None,
                }
            } else {
                InputAction::Insert(c)
            }
        }
        KeyCode::Enter => InputAction::Submit,
        KeyCode::Esc => InputAction::Cancel,
        KeyCode::Backspace => InputAction::Backspace,
        KeyCode::Delete => InputAction::Delete,
        KeyCode::Left => InputAction::CursorLeft,
        KeyCode::Right => InputAction::CursorRight,
        KeyCode::Home => InputAction::CursorHome,
        KeyCode::End => InputAction::CursorEnd,
        KeyCode::Up => InputAction::HistoryPrevious,
        KeyCode::Down => InputAction::HistoryNext,
        _ => InputAction::None,
    }
}

/// Input buffer
#[derive(Debug, Clone, Default)]
pub struct InputBuffer {
    /// Buffer content
    content: String,
    /// Cursor position
    cursor: usize,
}

impl InputBuffer {
    /// Create new buffer
    pub fn new() -> Self {
        Self::default()
    }
    
    /// Get content
    pub fn content(&self) -> &str {
        &self.content
    }
    
    /// Get cursor position
    pub fn cursor(&self) -> usize {
        self.cursor
    }
    
    /// Apply action
    pub fn apply(&mut self, action: InputAction) -> bool {
        match action {
            InputAction::Insert(c) => {
                self.content.insert(self.cursor, c);
                self.cursor += 1;
                true
            }
            InputAction::Backspace => {
                if self.cursor > 0 {
                    self.cursor -= 1;
                    self.content.remove(self.cursor);
                    true
                } else {
                    false
                }
            }
            InputAction::Delete => {
                if self.cursor < self.content.len() {
                    self.content.remove(self.cursor);
                    true
                } else {
                    false
                }
            }
            InputAction::CursorLeft => {
                if self.cursor > 0 {
                    self.cursor -= 1;
                }
                false
            }
            InputAction::CursorRight => {
                if self.cursor < self.content.len() {
                    self.cursor += 1;
                }
                false
            }
            InputAction::CursorHome => {
                self.cursor = 0;
                false
            }
            InputAction::CursorEnd => {
                self.cursor = self.content.len();
                false
            }
            InputAction::ClearLine => {
                self.content.clear();
                self.cursor = 0;
                true
            }
            _ => false,
        }
    }
    
    /// Clear buffer
    pub fn clear(&mut self) {
        self.content.clear();
        self.cursor = 0;
    }
    
    /// Set content
    pub fn set(&mut self, content: impl Into<String>) {
        self.content = content.into();
        self.cursor = self.content.len();
    }
    
    /// Take content (clears buffer)
    pub fn take(&mut self) -> String {
        let content = self.content.clone();
        self.clear();
        content
    }
}

