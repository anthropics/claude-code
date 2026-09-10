//! Advanced file operations with multi-file editing
//!
//! Provides batch operations, multi-file previews, tree view,
//! and search/replace across multiple files.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::fs;
use regex::Regex;
use thiserror::Error;
use tracing::{debug, error, info, instrument, warn};
use tokio::sync::mpsc;
use ratatui::{
    backend::Backend,
    layout::{Constraint, Direction, Layout, Rect, Margin},
    style::{Color, Modifier, Style},
    text::{Line, Span, Text},
    widgets::{Block, Borders, Clear, List, ListItem, Paragraph, Scrollbar, ScrollbarOrientation, ScrollbarState, Wrap},
    Frame,
};

/// Advanced file operations errors
#[derive(Debug, Error)]
pub enum FileOpsError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("Path not found: {0}")]
    PathNotFound(PathBuf),
    
    #[error("Invalid pattern: {0}")]
    InvalidPattern(String),
    
    #[error("Permission denied: {0}")]
    PermissionDenied(PathBuf),
    
    #[error("File too large: {0}")]
    FileTooLarge(PathBuf),
    
    #[error("Encoding error: {0}")]
    Encoding(String),
    
    #[error("Operation cancelled")]
    Cancelled,
}

/// Multi-file edit preview state
pub struct MultiFileEditPreview {
    edits: Vec<FileEdit>,
    selected_edit: usize,
    scroll_offset: usize,
    view_mode: PreviewMode,
    total_added: usize,
    total_removed: usize,
    files_affected: usize,
}

#[derive(Clone, Copy, PartialEq)]
pub enum PreviewMode {
    Summary,
    FileList,
    DiffView,
    SideBySide,
}

/// A single file edit operation
pub struct FileEdit {
    pub path: PathBuf,
    pub original_content: String,
    pub new_content: String,
    pub diff: Vec<DiffHunk>,
    pub is_applied: bool,
    pub is_selected: bool,
    pub errors: Vec<String>,
    pub file_type: FileType,
    pub encoding: Option<String>,
    pub has_bom: bool,
}

/// File type detection
#[derive(Clone, Copy, PartialEq)]
pub enum FileType {
    Text,
    Binary,
    Image,
    Unknown,
}

/// Diff hunk for preview
pub struct DiffHunk {
    pub old_start: usize,
    pub old_count: usize,
    pub new_start: usize,
    pub new_count: usize,
    pub lines: Vec<DiffLine>,
}

/// A single diff line
pub struct DiffLine {
    pub line_type: DiffLineType,
    pub content: String,
    pub old_line_num: Option<usize>,
    pub new_line_num: Option<usize>,
}

#[derive(Clone, Copy, PartialEq)]
pub enum DiffLineType {
    Context,
    Added,
    Removed,
    Header,
}

impl MultiFileEditPreview {
    pub fn new() -> Self {
        Self {
            edits: Vec::new(),
            selected_edit: 0,
            scroll_offset: 0,
            view_mode: PreviewMode::Summary,
            total_added: 0,
            total_removed: 0,
            files_affected: 0,
        }
    }
    
    /// Add an edit to the preview
    pub fn add_edit(&mut self, edit: FileEdit) {
        // Count changes
        for hunk in &edit.diff {
            for line in &hunk.lines {
                match line.line_type {
                    DiffLineType::Added => self.total_added += 1,
                    DiffLineType::Removed => self.total_removed += 1,
                    _ => {}
                }
            }
        }
        
        self.files_affected += 1;
        self.edits.push(edit);
    }
    
    /// Create edits from search/replace across multiple files
    #[instrument]
    pub fn create_from_search_replace(
        &mut self,
        files: &[PathBuf],
        pattern: &str,
        replacement: &str,
        use_regex: bool,
        case_sensitive: bool,
    ) -> Result<(), FileOpsError> {
        info!("Creating multi-file edits for {} files", files.len());
        
        let regex = if use_regex {
            Some(if case_sensitive {
                Regex::new(pattern).map_err(|e| FileOpsError::InvalidPattern(e.to_string()))?
            } else {
                Regex::new(&format!("(?i){}", pattern))
                    .map_err(|e| FileOpsError::InvalidPattern(e.to_string()))?
            })
        } else {
            None
        };
        
        for file in files {
            let content = match fs::read_to_string(file) {
                Ok(c) => c,
                Err(e) => {
                    warn!("Skipping {}: {}", file.display(), e);
                    continue;
                }
            };
            
            // Detect encoding/BOM
            let (content, encoding, has_bom) = Self::detect_encoding(&content);
            
            // Perform replacement
            let new_content = if let Some(ref regex) = regex {
                regex.replace_all(&content, replacement).to_string()
            } else {
                if case_sensitive {
                    content.replace(pattern, replacement)
                } else {
                    content.replace(&pattern.to_lowercase(), &replacement.to_lowercase())
                }
            };
            
            // Only add if there were changes
            if content != new_content {
                let diff = Self::compute_diff(&content, &new_content);
                
                self.add_edit(FileEdit {
                    path: file.clone(),
                    original_content: content.to_string(),
                    new_content,
                    diff,
                    is_applied: false,
                    is_selected: true,
                    errors: Vec::new(),
                    file_type: FileType::Text,
                    encoding,
                    has_bom,
                });
            }
        }
        
        info!("Created {} edits", self.edits.len());
        Ok(())
    }
    
    /// Detect file encoding and BOM
    fn detect_encoding(content: &str) -> (String, Option<String>, bool) {
        let bytes = content.as_bytes();
        
        // Check for BOM
        if bytes.starts_with(&[0xef, 0xbb, 0xbf]) {
            (content[3..].to_string(), Some("UTF-8".to_string()), true)
        } else if bytes.starts_with(&[0xff, 0xfe]) {
            // UTF-16 LE
            (content.to_string(), Some("UTF-16 LE".to_string()), true)
        } else if bytes.starts_with(&[0xfe, 0xff]) {
            // UTF-16 BE
            (content.to_string(), Some("UTF-16 BE".to_string()), true)
        } else {
            (content.to_string(), Some("UTF-8".to_string()), false)
        }
    }
    
    /// Compute diff between two strings
    fn compute_diff(old: &str, new: &str) -> Vec<DiffHunk> {
        use similar::{Algorithm, TextDiff};
        
        let diff = TextDiff::configure()
            .algorithm(Algorithm::Myers)
            .diff_lines(old, new);
        
        let mut hunks = Vec::new();
        let mut current_hunk: Option<DiffHunk> = None;
        let mut old_line = 1usize;
        let mut new_line = 1usize;
        
        for change in diff.iter_all_changes() {
            let line_type = match change.tag() {
                similar::ChangeTag::Equal => DiffLineType::Context,
                similar::ChangeTag::Delete => DiffLineType::Removed,
                similar::ChangeTag::Insert => DiffLineType::Added,
            };
            
            // Start new hunk if needed
            if current_hunk.is_none() || 
               (line_type != DiffLineType::Context && current_hunk.as_ref().unwrap().lines.len() > 3) {
                if let Some(hunk) = current_hunk.take() {
                    hunks.push(hunk);
                }
                
                current_hunk = Some(DiffHunk {
                    old_start: old_line,
                    old_count: 0,
                    new_start: new_line,
                    new_count: 0,
                    lines: Vec::new(),
                });
            }
            
            if let Some(ref mut hunk) = current_hunk {
                let line_content = change.value().to_string();
                
                let (old_num, new_num) = match line_type {
                    DiffLineType::Context => {
                        let o = old_line;
                        let n = new_line;
                        old_line += 1;
                        new_line += 1;
                        (Some(o), Some(n))
                    }
                    DiffLineType::Removed => {
                        let o = old_line;
                        old_line += 1;
                        hunk.old_count += 1;
                        (Some(o), None)
                    }
                    DiffLineType::Added => {
                        let n = new_line;
                        new_line += 1;
                        hunk.new_count += 1;
                        (None, Some(n))
                    }
                    _ => (None, None),
                };
                
                hunk.lines.push(DiffLine {
                    line_type,
                    content: line_content,
                    old_line_num: old_num,
                    new_line_num: new_num,
                });
            }
        }
        
        if let Some(hunk) = current_hunk {
            hunks.push(hunk);
        }
        
        hunks
    }
    
    /// Render the preview UI
    pub fn render<B: Backend>(&self, frame: &mut Frame<B>, area: Rect) {
        match self.view_mode {
            PreviewMode::Summary => self.render_summary(frame, area),
            PreviewMode::FileList => self.render_file_list(frame, area),
            PreviewMode::DiffView => self.render_diff_view(frame, area),
            PreviewMode::SideBySide => self.render_side_by_side(frame, area),
        }
    }
    
    /// Render summary view
    fn render_summary<B: Backend>(&self, frame: &mut Frame<B>, area: Rect) {
        let chunks = Layout::default()
            .direction(Direction::Vertical)
            .constraints([
                Constraint::Length(8),
                Constraint::Min(0),
                Constraint::Length(3),
            ])
            .split(area);
        
        // Summary statistics
        let summary_lines = vec![
            Line::from(vec![
                Span::styled("Multi-File Edit Preview", Style::default().add_modifier(Modifier::BOLD)),
            ]),
            Line::from(""),
            Line::from(vec![
                Span::raw("Files affected: "),
                Span::styled(self.files_affected.to_string(), Style::default().fg(Color::Yellow)),
            ]),
            Line::from(vec![
                Span::raw("Lines added: "),
                Span::styled(format!("+{}", self.total_added), Style::default().fg(Color::Green)),
            ]),
            Line::from(vec![
                Span::raw("Lines removed: "),
                Span::styled(format!("-{}", self.total_removed), Style::default().fg(Color::Red)),
            ]),
            Line::from(vec![
                Span::raw("Net change: "),
                Span::styled(
                    format!("{:+}", self.total_added as i64 - self.total_removed as i64),
                    Style::default().fg(if self.total_added >= self.total_removed {
                        Color::Green
                    } else {
                        Color::Red
                    })
                ),
            ]),
        ];
        
        let summary = Paragraph::new(Text::from(summary_lines))
            .block(Block::default().title("Summary").borders(Borders::ALL));
        
        frame.render_widget(summary, chunks[0]);
        
        // File list preview
        let file_items: Vec<Line> = self.edits.iter().enumerate().map(|(i, edit)| {
            let status = if edit.is_applied {
                ("✓", Color::Green)
            } else if edit.is_selected {
                ("●", Color::Yellow)
            } else {
                ("○", Color::Gray)
            };
            
            let added = edit.diff.iter().map(|h| 
                h.lines.iter().filter(|l| l.line_type == DiffLineType::Added).count()
            ).sum::<usize>();
            
            let removed = edit.diff.iter().map(|h|
                h.lines.iter().filter(|l| l.line_type == DiffLineType::Removed).count()
            ).sum::<usize>();
            
            Line::from(vec![
                Span::raw(format!("{} ", status.0)),
                Span::styled(edit.path.to_string_lossy().to_string(), 
                    Style::default().fg(if i == self.selected_edit { Color::Cyan } else { Color::White })),
                Span::raw(" "),
                Span::styled(format!("(+{}/-{})", added, removed), Style::default().fg(Color::DarkGray)),
            ])
        }).collect();
        
        let files = Paragraph::new(Text::from(file_items))
            .block(Block::default()
                .title(format!("Files ({}/{}) - j/k to navigate, space to toggle", 
                    self.selected_edit + 1, self.edits.len()))
                .borders(Borders::ALL))
            .scroll((self.scroll_offset as u16, 0));
        
        frame.render_widget(files, chunks[1]);
        
        // Help text
        let help = Paragraph::new(
            "Enter: view diff | a: apply all | s: apply selected | d: discard | q: quit"
        )
        .block(Block::default().borders(Borders::ALL));
        
        frame.render_widget(help, chunks[2]);
    }
    
    /// Render file list view
    fn render_file_list<B: Backend>(&self, frame: &mut Frame<B>, area: Rect) {
        let items: Vec<ListItem> = self.edits.iter().enumerate().map(|(i, edit)| {
            let prefix = if i == self.selected_edit { "> " } else { "  " };
            let check = if edit.is_selected { "[x]" } else { "[ ]" };
            
            let status_color = if edit.is_applied {
                Color::Green
            } else if edit.errors.is_empty() {
                Color::Yellow
            } else {
                Color::Red
            };
            
            ListItem::new(Line::from(vec![
                Span::raw(prefix),
                Span::raw(check),
                Span::raw(" "),
                Span::styled(
                    edit.path.to_string_lossy().to_string(),
                    Style::default().fg(status_color)
                ),
            ]))
        }).collect();
        
        let list = List::new(items)
            .block(Block::default().title("Files").borders(Borders::ALL))
            .highlight_style(Style::default().add_modifier(Modifier::REVERSED));
        
        frame.render_widget(list, area);
    }
    
    /// Render diff view for selected file
    fn render_diff_view<B: Backend>(&self, frame: &mut Frame<B>, area: Rect) {
        if let Some(edit) = self.edits.get(self.selected_edit) {
            let chunks = Layout::default()
                .direction(Direction::Vertical)
                .constraints([Constraint::Length(3), Constraint::Min(0)])
                .split(area);
            
            // Header
            let header = Paragraph::new(vec![
                Line::from(vec![
                    Span::styled("File: ", Style::default().add_modifier(Modifier::BOLD)),
                    Span::raw(edit.path.to_string_lossy().to_string()),
                ]),
                Line::from(vec![
                    Span::styled("Status: ", Style::default().add_modifier(Modifier::BOLD)),
                    Span::styled(
                        if edit.is_applied { "Applied" } else { "Pending" },
                        Style::default().fg(if edit.is_applied { Color::Green } else { Color::Yellow })
                    ),
                ]),
            ])
            .block(Block::default().borders(Borders::ALL));
            
            frame.render_widget(header, chunks[0]);
            
            // Diff content
            let mut diff_lines = Vec::new();
            
            for hunk in &edit.diff {
                // Hunk header
                diff_lines.push(Line::from(vec![
                    Span::styled(
                        format!("@@ -{},{} +{},{} @@", 
                            hunk.old_start, hunk.old_count,
                            hunk.new_start, hunk.new_count),
                        Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)
                    ),
                ]));
                
                // Lines
                for line in &hunk.lines {
                    let style = match line.line_type {
                        DiffLineType::Added => Style::default().bg(Color::Rgb(40, 80, 40)),
                        DiffLineType::Removed => Style::default().bg(Color::Rgb(80, 40, 40)),
                        DiffLineType::Context => Style::default(),
                        DiffLineType::Header => Style::default().fg(Color::Cyan),
                    };
                    
                    let prefix = match line.line_type {
                        DiffLineType::Added => "+",
                        DiffLineType::Removed => "-",
                        _ => " ",
                    };
                    
                    let line_num = format!("{:4} {:4} |",
                        line.old_line_num.map(|n| n.to_string()).unwrap_or_default(),
                        line.new_line_num.map(|n| n.to_string()).unwrap_or_default()
                    );
                    
                    diff_lines.push(Line::from(vec![
                        Span::styled(line_num, Style::default().fg(Color::DarkGray)),
                        Span::styled(prefix.to_string(), style),
                        Span::styled(line.content.clone(), style),
                    ]));
                }
                
                diff_lines.push(Line::from(""));
            }
            
            let diff = Paragraph::new(Text::from(diff_lines))
                .block(Block::default()
                    .title("Diff - j/k to scroll, a to apply, d to discard")
                    .borders(Borders::ALL))
                .scroll((self.scroll_offset as u16, 0));
            
            frame.render_widget(diff, chunks[1]);
            
            // Scrollbar
            let total_lines: usize = edit.diff.iter().map(|h| h.lines.len() + 2).sum();
            let scrollbar = Scrollbar::default()
                .orientation(ScrollbarOrientation::VerticalRight);
            
            let mut scrollbar_state = ScrollbarState::default()
                .content_length(total_lines)
                .position(self.scroll_offset);
            
            frame.render_stateful_widget(
                scrollbar,
                chunks[1].inner(&Margin { horizontal: 0, vertical: 1 }),
                &mut scrollbar_state,
            );
        }
    }
    
    /// Render side-by-side diff
    fn render_side_by_side<B: Backend>(&self, frame: &mut Frame<B>, area: Rect) {
        if let Some(edit) = self.edits.get(self.selected_edit) {
            let chunks = Layout::default()
                .direction(Direction::Horizontal)
                .constraints([Constraint::Percentage(50), Constraint::Percentage(50)])
                .split(area);
            
            // Original (left)
            let old_lines: Vec<Line> = edit.original_content
                .lines()
                .enumerate()
                .skip(self.scroll_offset)
                .take(chunks[0].height as usize)
                .map(|(i, line)| {
                    let is_modified = edit.diff.iter().any(|h| {
                        h.lines.iter().any(|l| {
                            l.line_type == DiffLineType::Removed && l.old_line_num == Some(i + 1)
                        })
                    });
                    
                    Line::from(vec![
                        Span::styled(
                            format!("{:4} | ", i + 1),
                            Style::default().fg(Color::DarkGray)
                        ),
                        Span::styled(
                            line.to_string(),
                            if is_modified {
                                Style::default().bg(Color::Rgb(80, 40, 40))
                            } else {
                                Style::default()
                            }
                        ),
                    ])
                })
                .collect();
            
            let old_widget = Paragraph::new(Text::from(old_lines))
                .block(Block::default().title("Original").borders(Borders::ALL));
            
            frame.render_widget(old_widget, chunks[0]);
            
            // New (right)
            let new_lines: Vec<Line> = edit.new_content
                .lines()
                .enumerate()
                .skip(self.scroll_offset)
                .take(chunks[1].height as usize)
                .map(|(i, line)| {
                    let is_modified = edit.diff.iter().any(|h| {
                        h.lines.iter().any(|l| {
                            l.line_type == DiffLineType::Added && l.new_line_num == Some(i + 1)
                        })
                    });
                    
                    Line::from(vec![
                        Span::styled(
                            format!("{:4} | ", i + 1),
                            Style::default().fg(Color::DarkGray)
                        ),
                        Span::styled(
                            line.to_string(),
                            if is_modified {
                                Style::default().bg(Color::Rgb(40, 80, 40))
                            } else {
                                Style::default()
                            }
                        ),
                    ])
                })
                .collect();
            
            let new_widget = Paragraph::new(Text::from(new_lines))
                .block(Block::default().title("Modified").borders(Borders::ALL));
            
            frame.render_widget(new_widget, chunks[1]);
        }
    }
    
    /// Handle input
    pub fn handle_input(&mut self, key: crossterm::event::KeyEvent) -> PreviewAction {
        use crossterm::event::KeyCode;
        
        match self.view_mode {
            PreviewMode::Summary => {
                match key.code {
                    KeyCode::Char('j') | KeyCode::Down => {
                        if self.selected_edit < self.edits.len().saturating_sub(1) {
                            self.selected_edit += 1;
                        }
                        PreviewAction::None
                    }
                    KeyCode::Char('k') | KeyCode::Up => {
                        if self.selected_edit > 0 {
                            self.selected_edit -= 1;
                        }
                        PreviewAction::None
                    }
                    KeyCode::Char(' ') => {
                        if let Some(edit) = self.edits.get_mut(self.selected_edit) {
                            edit.is_selected = !edit.is_selected;
                        }
                        PreviewAction::None
                    }
                    KeyCode::Enter => {
                        self.view_mode = PreviewMode::DiffView;
                        self.scroll_offset = 0;
                        PreviewAction::None
                    }
                    KeyCode::Char('a') => {
                        PreviewAction::ApplyAll
                    }
                    KeyCode::Char('s') => {
                        PreviewAction::ApplySelected(self.selected_edit)
                    }
                    KeyCode::Char('d') => {
                        PreviewAction::DiscardAll
                    }
                    KeyCode::Char('l') => {
                        self.view_mode = PreviewMode::FileList;
                        PreviewAction::None
                    }
                    KeyCode::Char('q') => PreviewAction::Quit,
                    _ => PreviewAction::None,
                }
            }
            PreviewMode::DiffView => {
                match key.code {
                    KeyCode::Char('j') | KeyCode::Down => {
                        self.scroll_offset += 1;
                        PreviewAction::None
                    }
                    KeyCode::Char('k') | KeyCode::Up => {
                        if self.scroll_offset > 0 {
                            self.scroll_offset -= 1;
                        }
                        PreviewAction::None
                    }
                    KeyCode::Char('a') => {
                        PreviewAction::ApplySelected(self.selected_edit)
                    }
                    KeyCode::Char('d') => {
                        if let Some(edit) = self.edits.get_mut(self.selected_edit) {
                            edit.is_selected = false;
                        }
                        PreviewAction::None
                    }
                    KeyCode::Char('h') => {
                        self.view_mode = PreviewMode::Summary;
                        PreviewAction::None
                    }
                    KeyCode::Char('s') => {
                        self.view_mode = PreviewMode::SideBySide;
                        PreviewAction::None
                    }
                    KeyCode::Esc | KeyCode::Char('q') => {
                        self.view_mode = PreviewMode::Summary;
                        PreviewAction::None
                    }
                    _ => PreviewAction::None,
                }
            }
            PreviewMode::SideBySide => {
                match key.code {
                    KeyCode::Char('j') | KeyCode::Down => {
                        self.scroll_offset += 1;
                        PreviewAction::None
                    }
                    KeyCode::Char('k') | KeyCode::Up => {
                        if self.scroll_offset > 0 {
                            self.scroll_offset -= 1;
                        }
                        PreviewAction::None
                    }
                    KeyCode::Char('d') => {
                        self.view_mode = PreviewMode::DiffView;
                        PreviewAction::None
                    }
                    KeyCode::Esc | KeyCode::Char('q') => {
                        self.view_mode = PreviewMode::Summary;
                        PreviewAction::None
                    }
                    _ => PreviewAction::None,
                }
            }
            PreviewMode::FileList => {
                match key.code {
                    KeyCode::Char('q') | KeyCode::Esc => {
                        self.view_mode = PreviewMode::Summary;
                        PreviewAction::None
                    }
                    _ => PreviewAction::None,
                }
            }
        }
    }
    
    /// Apply selected edits
    #[instrument(skip(self))]
    pub fn apply_edits(&mut self) -> Result<ApplyResult, FileOpsError> {
        let mut applied = Vec::new();
        let mut failed = Vec::new();
        
        for edit in self.edits.iter_mut() {
            if !edit.is_selected || edit.is_applied {
                continue;
            }
            
            match fs::write(&edit.path, &edit.new_content) {
                Ok(_) => {
                    edit.is_applied = true;
                    applied.push(edit.path.clone());
                    info!("Applied edit to: {:?}", edit.path);
                }
                Err(e) => {
                    edit.errors.push(e.to_string());
                    failed.push((edit.path.clone(), e.to_string()));
                    error!("Failed to apply edit to {:?}: {}", edit.path, e);
                }
            }
        }
        
        Ok(ApplyResult { applied, failed })
    }
    
    /// Get statistics
    pub fn stats(&self) -> (usize, usize, usize) {
        let selected = self.edits.iter().filter(|e| e.is_selected).count();
        let applied = self.edits.iter().filter(|e| e.is_applied).count();
        let total = self.edits.len();
        (selected, applied, total)
    }
}

/// Result of applying edits
pub struct ApplyResult {
    pub applied: Vec<PathBuf>,
    pub failed: Vec<(PathBuf, String)>,
}

/// Actions from preview UI
#[derive(Clone, Debug)]
pub enum PreviewAction {
    None,
    ApplyAll,
    ApplySelected(usize),
    DiscardAll,
    DiscardSelected(usize),
    ToggleSelection(usize),
    Quit,
}

