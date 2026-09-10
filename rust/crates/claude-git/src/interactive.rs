//! Interactive Git staging and diff viewer
//!
//! Provides TUI components for:
//! - Interactive staging (hunk-by-hunk, line-by-line)
//! - Visual diff with syntax highlighting
//! - Merge conflict resolution
//! - Branch visualization

use git2::{Diff, DiffOptions, Repository, StatusOptions};
use ratatui::{
    backend::Backend,
    layout::{Constraint, Direction, Layout, Margin, Rect},
    style::{Color, Modifier, Style},
    symbols::bar::{FULL, HALF, EMPTY},
    text::{Line, Span, Text},
    widgets::{Block, Borders, Clear, Paragraph, Scrollbar, ScrollbarOrientation, ScrollbarState, Wrap},
    Frame,
};
use std::collections::HashMap;
use std::path::PathBuf;
use syntect::{
    easy::HighlightLines,
    highlighting::{ThemeSet, Style as SyntectStyle},
    parsing::SyntaxSet,
    util::LinesWithEndings,
};
use tracing::{debug, error, info, instrument};

/// Interactive staging state
pub struct InteractiveStaging {
    files: Vec<StagedFile>,
    selected_file: usize,
    selected_hunk: usize,
    selected_line: usize,
    view_mode: StagingViewMode,
    scroll_offset: usize,
    syntax_set: SyntaxSet,
    theme_set: ThemeSet,
}

#[derive(Clone, Copy, PartialEq)]
pub enum StagingViewMode {
    FileList,
    HunkView,
    LineView,
    DiffView,
}

/// Represents a file with staged/unstaged changes
pub struct StagedFile {
    pub path: PathBuf,
    pub status: FileStatus,
    pub hunks: Vec<Hunk>,
    pub is_collapsed: bool,
    pub selected: bool,
}

#[derive(Clone, Copy, PartialEq)]
pub enum FileStatus {
    Added,
    Modified,
    Deleted,
    Renamed,
    Copied,
    Untracked,
    Conflict,
}

/// A hunk of changes
pub struct Hunk {
    pub old_start: u32,
    pub old_lines: u32,
    pub new_start: u32,
    pub new_lines: u32,
    pub lines: Vec<DiffLine>,
    pub is_staged: bool,
    pub is_collapsed: bool,
}

/// A single diff line
pub struct DiffLine {
    pub line_type: LineType,
    pub content: String,
    pub old_line_num: Option<u32>,
    pub new_line_num: Option<u32>,
    pub is_selected: bool,
}

#[derive(Clone, Copy, PartialEq)]
pub enum LineType {
    Context,
    Added,
    Removed,
    Header,
}

impl InteractiveStaging {
    pub fn new() -> Self {
        Self {
            files: Vec::new(),
            selected_file: 0,
            selected_hunk: 0,
            selected_line: 0,
            view_mode: StagingViewMode::FileList,
            scroll_offset: 0,
            syntax_set: SyntaxSet::load_defaults_newlines(),
            theme_set: ThemeSet::load_defaults(),
        }
    }
    
    /// Load changes from git repository
    #[instrument(skip(self, repo))]
    pub fn load_from_repo(&mut self, repo: &Repository) -> Result<(), git2::Error> {
        info!("Loading interactive staging state from repository");
        
        let mut status_opts = StatusOptions::new();
        status_opts.include_untracked(true)
            .include_ignored(false)
            .renames_head_to_index(true)
            .renames_index_to_workdir(true);
        
        let statuses = repo.statuses(Some(&mut status_opts))?;
        
        self.files.clear();
        
        for entry in statuses.iter() {
            let path = entry.path().unwrap_or("unknown");
            let status = entry.status();
            
            let file_status = if status.is_conflicted() {
                FileStatus::Conflict
            } else if status.is_index_new() || status.is_wt_new() {
                FileStatus::Added
            } else if status.is_index_deleted() || status.is_wt_deleted() {
                FileStatus::Deleted
            } else if status.is_index_renamed() || status.is_wt_renamed() {
                FileStatus::Renamed
            } else {
                FileStatus::Modified
            };
            
            let mut file = StagedFile {
                path: PathBuf::from(path),
                status: file_status,
                hunks: Vec::new(),
                is_collapsed: false,
                selected: false,
            };
            
            // Load diff for this file
            self.load_file_diff(repo, &mut file)?;
            
            self.files.push(file);
        }
        
        info!("Loaded {} files with changes", self.files.len());
        Ok(())
    }
    
    /// Load diff hunks for a file
    fn load_file_diff(&self, repo: &Repository, file: &mut StagedFile) -> Result<(), git2::Error> {
        let head = repo.head()?;
        let head_tree = head.peel_to_tree()?;
        
        let mut diff_opts = DiffOptions::new();
        diff_opts.pathspec(file.path.to_string_lossy().as_ref());
        
        let diff = repo.diff_tree_to_workdir_with_index(
            Some(&head_tree),
            Some(&mut diff_opts),
        )?;
        
        // Parse diff into hunks
        diff.print(git2::DiffFormat::Patch, |delta, hunk, line| {
            if let Some(h) = hunk {
                let hunk_info = Hunk {
                    old_start: h.old_start(),
                    old_lines: h.old_lines(),
                    new_start: h.new_start(),
                    new_lines: h.new_lines(),
                    lines: Vec::new(),
                    is_staged: false,
                    is_collapsed: false,
                };
                
                if file.hunks.is_empty() || file.hunks.last().unwrap().old_start != h.old_start() {
                    file.hunks.push(hunk_info);
                }
                
                if let Some(current_hunk) = file.hunks.last_mut() {
                    let line_type = match line.origin() {
                        '+' => LineType::Added,
                        '-' => LineType::Removed,
                        ' ' => LineType::Context,
                        _ => LineType::Header,
                    };
                    
                    let content = String::from_utf8_lossy(line.content()).to_string();
                    
                    current_hunk.lines.push(DiffLine {
                        line_type,
                        content,
                        old_line_num: None, // Would calculate from hunk info
                        new_line_num: None,
                        is_selected: false,
                    });
                }
            }
            true
        })?;
        
        Ok(())
    }
    
    /// Render the staging UI
    pub fn render<B: Backend>(&self, frame: &mut Frame<B>, area: Rect) {
        match self.view_mode {
            StagingViewMode::FileList => self.render_file_list(frame, area),
            StagingViewMode::DiffView => self.render_diff_view(frame, area),
            StagingViewMode::HunkView => self.render_hunk_view(frame, area),
            StagingViewMode::LineView => self.render_line_view(frame, area),
        }
    }
    
    /// Render file list view
    fn render_file_list<B: Backend>(&self, frame: &mut Frame<B>, area: Rect) {
        let chunks = Layout::default()
            .direction(Direction::Horizontal)
            .constraints([Constraint::Percentage(40), Constraint::Percentage(60)])
            .split(area);
        
        // Left panel - file list
        let items: Vec<Line> = self.files.iter().enumerate().map(|(i, file)| {
            let status_icon = match file.status {
                FileStatus::Added => "+",
                FileStatus::Modified => "M",
                FileStatus::Deleted => "D",
                FileStatus::Renamed => "R",
                FileStatus::Copied => "C",
                FileStatus::Untracked => "?",
                FileStatus::Conflict => "!",
            };
            
            let status_color = match file.status {
                FileStatus::Added => Color::Green,
                FileStatus::Modified => Color::Yellow,
                FileStatus::Deleted => Color::Red,
                FileStatus::Conflict => Color::Magenta,
                _ => Color::Gray,
            };
            
            let prefix = if i == self.selected_file { "> " } else { "  " };
            let check = if file.selected { "[x]" } else { "[ ]" };
            
            Line::from(vec![
                Span::raw(prefix),
                Span::raw(check),
                Span::raw(" "),
                Span::styled(status_icon, Style::default().fg(status_color)),
                Span::raw(" "),
                Span::raw(file.path.to_string_lossy()),
            ])
        }).collect();
        
        let list = Paragraph::new(Text::from(items))
            .block(Block::default()
                .title("Files (j/k to navigate, space to stage, d for diff)")
                .borders(Borders::ALL))
            .wrap(Wrap { trim: false });
        
        frame.render_widget(list, chunks[0]);
        
        // Right panel - preview of selected file
        if let Some(file) = self.files.get(self.selected_file) {
            let preview = self.render_file_preview(file);
            frame.render_widget(preview, chunks[1]);
        }
    }
    
    /// Render file preview
    fn render_file_preview(&self, file: &StagedFile) -> Paragraph {
        let mut lines = vec![
            Line::from(vec![
                Span::raw("File: "),
                Span::styled(
                    file.path.to_string_lossy().to_string(),
                    Style::default().add_modifier(Modifier::BOLD)
                ),
            ]),
            Line::from(""),
        ];
        
        // Show hunk summary
        for (i, hunk) in file.hunks.iter().enumerate() {
            let added = hunk.lines.iter().filter(|l| l.line_type == LineType::Added).count();
            let removed = hunk.lines.iter().filter(|l| l.line_type == LineType::Removed).count();
            
            lines.push(Line::from(vec![
                Span::raw(format!("Hunk {}: ", i + 1)),
                Span::styled(format!("+{}", added), Style::default().fg(Color::Green)),
                Span::raw(" "),
                Span::styled(format!("-{}", removed), Style::default().fg(Color::Red)),
            ]));
        }
        
        Paragraph::new(Text::from(lines))
            .block(Block::default()
                .title("Preview")
                .borders(Borders::ALL))
    }
    
    /// Render diff view with syntax highlighting
    fn render_diff_view<B: Backend>(&self, frame: &mut Frame<B>, area: Rect) {
        if let Some(file) = self.files.get(self.selected_file) {
            let diff_content = self.render_diff_with_syntax_highlight(file);
            
            let diff_widget = Paragraph::new(diff_content)
                .block(Block::default()
                    .title(format!("Diff: {}", file.path.to_string_lossy()))
                    .borders(Borders::ALL))
                .scroll((self.scroll_offset as u16, 0));
            
            frame.render_widget(diff_widget, area);
            
            // Add scrollbar
            let scrollbar = Scrollbar::default()
                .orientation(ScrollbarOrientation::VerticalRight)
                .begin_symbol(Some("↑"))
                .end_symbol(Some("↓"));
            
            let mut scrollbar_state = ScrollbarState::default()
                .content_length(file.hunks.iter().map(|h| h.lines.len()).sum::<usize>())
                .position(self.scroll_offset);
            
            frame.render_stateful_widget(
                scrollbar,
                area.inner(&Margin {
                    horizontal: 0,
                    vertical: 1,
                }),
                &mut scrollbar_state,
            );
        }
    }
    
    /// Render diff with syntax highlighting
    fn render_diff_with_syntax_highlight(&self, file: &StagedFile) -> Text {
        let mut lines = Vec::new();
        
        // Try to detect syntax
        let extension = file.path.extension()
            .and_then(|e| e.to_str())
            .unwrap_or("");
        
        let syntax = self.syntax_set.find_syntax_by_extension(extension)
            .or_else(|| self.syntax_set.find_syntax_by_extension("rs"))
            .unwrap_or_else(|| self.syntax_set.find_syntax_plain_text());
        
        let theme = &self.theme_set.themes["base16-ocean.dark"];
        let mut highlighter = HighlightLines::new(syntax, theme);
        
        for hunk in &file.hunks {
            // Hunk header
            lines.push(Line::from(vec![
                Span::styled(
                    format!("@@ -{},{} +{},{} @@", 
                        hunk.old_start, hunk.old_lines,
                        hunk.new_start, hunk.new_lines),
                    Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)
                ),
            ]));
            
            for line in &hunk.lines {
                let style = match line.line_type {
                    LineType::Added => Style::default().bg(Color::Rgb(40, 80, 40)),
                    LineType::Removed => Style::default().bg(Color::Rgb(80, 40, 40)),
                    LineType::Header => Style::default().fg(Color::Cyan),
                    LineType::Context => Style::default(),
                };
                
                let prefix = match line.line_type {
                    LineType::Added => "+",
                    LineType::Removed => "-",
                    _ => " ",
                };
                
                // Apply syntax highlighting to content (strip prefix for highlighting)
                let content = &line.content;
                let highlighted = if line.line_type == LineType::Context || line.line_type == LineType::Added {
                    // Try to highlight
                    let regions = highlighter.highlight_line(content, &self.syntax_set).unwrap_or_default();
                    let mut spans = vec![Span::styled(prefix.to_string(), style)];
                    
                    for (syntect_style, text) in regions {
                        let color = Self::syntect_to_ratatui_color(&syntect_style);
                        spans.push(Span::styled(
                            text.to_string(),
                            Style::default().fg(color)
                        ));
                    }
                    
                    Line::from(spans)
                } else {
                    Line::from(vec![
                        Span::styled(prefix.to_string(), style),
                        Span::raw(content.clone()),
                    ])
                };
                
                lines.push(highlighted);
            }
            
            lines.push(Line::from(""));
        }
        
        Text::from(lines)
    }
    
    /// Convert syntect color to ratatui color
    fn syntect_to_ratatui_color(style: &SyntectStyle) -> Color {
        Color::Rgb(style.foreground.r, style.foreground.g, style.foreground.b)
    }
    
    /// Render hunk view for staging individual hunks
    fn render_hunk_view<B: Backend>(&self, frame: &mut Frame<B>, area: Rect) {
        if let Some(file) = self.files.get(self.selected_file) {
            if let Some(hunk) = file.hunks.get(self.selected_hunk) {
                let mut lines = Vec::new();
                
                // Hunk header
                let staged_indicator = if hunk.is_staged { "[STAGED]" } else { "[UNSTAGED]" };
                lines.push(Line::from(vec![
                    Span::styled(
                        format!("Hunk {} {}", self.selected_hunk + 1, staged_indicator),
                        Style::default().add_modifier(Modifier::BOLD)
                    ),
                ]));
                lines.push(Line::from(""));
                lines.push(Line::from("Press 's' to stage/unstage this hunk"));
                lines.push(Line::from("Press 'j/k' to navigate lines, 'space' to select lines"));
                lines.push(Line::from(""));
                
                // Show lines
                for (i, line) in hunk.lines.iter().enumerate() {
                    let is_selected = i == self.selected_line;
                    let check = if line.is_selected { "[x]" } else { "[ ]" };
                    
                    let line_style = match line.line_type {
                        LineType::Added => Style::default().fg(Color::Green),
                        LineType::Removed => Style::default().fg(Color::Red),
                        LineType::Context => Style::default().fg(Color::Gray),
                        LineType::Header => Style::default().fg(Color::Cyan),
                    };
                    
                    let prefix = if is_selected { "> " } else { "  " };
                    let content_prefix = match line.line_type {
                        LineType::Added => "+",
                        LineType::Removed => "-",
                        _ => " ",
                    };
                    
                    lines.push(Line::from(vec![
                        Span::raw(prefix),
                        Span::raw(check),
                        Span::raw(" "),
                        Span::styled(content_prefix.to_string(), line_style),
                        Span::styled(line.content.clone(), line_style),
                    ]));
                }
                
                let hunk_widget = Paragraph::new(Text::from(lines))
                    .block(Block::default()
                        .title(format!("Staging: {}", file.path.to_string_lossy()))
                        .borders(Borders::ALL));
                
                frame.render_widget(hunk_widget, area);
            }
        }
    }
    
    /// Render line-by-line staging view
    fn render_line_view<B: Backend>(&self, frame: &mut Frame<B>, area: Rect) {
        // Similar to hunk view but with more granular control
        self.render_hunk_view(frame, area);
    }
    
    /// Handle input events
    pub fn handle_input(&mut self, key: crossterm::event::KeyEvent) -> StagingAction {
        use crossterm::event::KeyCode;
        
        match self.view_mode {
            StagingViewMode::FileList => {
                match key.code {
                    KeyCode::Char('j') | KeyCode::Down => {
                        if self.selected_file < self.files.len().saturating_sub(1) {
                            self.selected_file += 1;
                        }
                        StagingAction::None
                    }
                    KeyCode::Char('k') | KeyCode::Up => {
                        if self.selected_file > 0 {
                            self.selected_file -= 1;
                        }
                        StagingAction::None
                    }
                    KeyCode::Char(' ') => {
                        if let Some(file) = self.files.get_mut(self.selected_file) {
                            file.selected = !file.selected;
                        }
                        StagingAction::ToggleFile(self.selected_file)
                    }
                    KeyCode::Char('d') => {
                        self.view_mode = StagingViewMode::DiffView;
                        StagingAction::None
                    }
                    KeyCode::Char('h') => {
                        if let Some(file) = self.files.get_mut(self.selected_file) {
                            file.is_collapsed = !file.is_collapsed;
                        }
                        StagingAction::None
                    }
                    KeyCode::Enter => {
                        self.view_mode = StagingViewMode::HunkView;
                        StagingAction::None
                    }
                    KeyCode::Char('q') => StagingAction::Quit,
                    _ => StagingAction::None,
                }
            }
            StagingViewMode::DiffView => {
                match key.code {
                    KeyCode::Char('j') | KeyCode::Down => {
                        self.scroll_offset += 1;
                        StagingAction::None
                    }
                    KeyCode::Char('k') | KeyCode::Up => {
                        if self.scroll_offset > 0 {
                            self.scroll_offset -= 1;
                        }
                        StagingAction::None
                    }
                    KeyCode::Char('q') | KeyCode::Esc => {
                        self.view_mode = StagingViewMode::FileList;
                        StagingAction::None
                    }
                    _ => StagingAction::None,
                }
            }
            StagingViewMode::HunkView => {
                match key.code {
                    KeyCode::Char('j') | KeyCode::Down => {
                        if let Some(file) = self.files.get(self.selected_file) {
                            if let Some(hunk) = file.hunks.get(self.selected_hunk) {
                                if self.selected_line < hunk.lines.len().saturating_sub(1) {
                                    self.selected_line += 1;
                                }
                            }
                        }
                        StagingAction::None
                    }
                    KeyCode::Char('k') | KeyCode::Up => {
                        if self.selected_line > 0 {
                            self.selected_line -= 1;
                        }
                        StagingAction::None
                    }
                    KeyCode::Char('s') => {
                        if let Some(file) = self.files.get_mut(self.selected_file) {
                            if let Some(hunk) = file.hunks.get_mut(self.selected_hunk) {
                                hunk.is_staged = !hunk.is_staged;
                                return StagingAction::StageHunk(
                                    self.selected_file,
                                    self.selected_hunk,
                                    hunk.is_staged,
                                );
                            }
                        }
                        StagingAction::None
                    }
                    KeyCode::Char(' ') => {
                        if let Some(file) = self.files.get_mut(self.selected_file) {
                            if let Some(hunk) = file.hunks.get_mut(self.selected_hunk) {
                                if let Some(line) = hunk.lines.get_mut(self.selected_line) {
                                    line.is_selected = !line.is_selected;
                                }
                            }
                        }
                        StagingAction::None
                    }
                    KeyCode::Char('q') | KeyCode::Esc => {
                        self.view_mode = StagingViewMode::FileList;
                        StagingAction::None
                    }
                    _ => StagingAction::None,
                }
            }
            StagingViewMode::LineView => {
                // Same as hunk view for now
                self.handle_line_view_input(key)
            }
        }
    }
    
    fn handle_line_view_input(&mut self, key: crossterm::event::KeyEvent) -> StagingAction {
        use crossterm::event::KeyCode;
        
        match key.code {
            KeyCode::Char('q') | KeyCode::Esc => {
                self.view_mode = StagingViewMode::HunkView;
                StagingAction::None
            }
            _ => StagingAction::None,
        }
    }
    
    /// Stage selected files/hunks
    pub fn stage_selected(&self) -> Vec<StageOperation> {
        let mut operations = Vec::new();
        
        for (file_idx, file) in self.files.iter().enumerate() {
            if file.selected {
                operations.push(StageOperation::StageFile(file.path.clone()));
            } else {
                // Check individual hunks
                for (hunk_idx, hunk) in file.hunks.iter().enumerate() {
                    if hunk.is_staged {
                        operations.push(StageOperation::StageHunk {
                            file: file.path.clone(),
                            hunk_index: hunk_idx,
                            lines: hunk.lines.iter()
                                .enumerate()
                                .filter(|(_, l)| l.is_selected)
                                .map(|(i, _)| i)
                                .collect(),
                        });
                    }
                }
            }
        }
        
        operations
    }
}

/// Actions that can be taken from the staging UI
#[derive(Clone, Debug)]
pub enum StagingAction {
    None,
    ToggleFile(usize),
    StageHunk(usize, usize, bool), // file_idx, hunk_idx, is_staged
    StageLines(usize, usize, Vec<usize>), // file_idx, hunk_idx, line_indices
    Quit,
}

/// Staging operations to apply
#[derive(Clone, Debug)]
pub enum StageOperation {
    StageFile(PathBuf),
    UnstageFile(PathBuf),
    StageHunk {
        file: PathBuf,
        hunk_index: usize,
        lines: Vec<usize>,
    },
}

