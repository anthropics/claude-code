//! Merge conflict resolution UI
//!
//! Provides an interface for resolving git merge conflicts
//! with side-by-side diff view and interactive selection.

use git2::{Repository, Index, IndexEntry, IndexTime};
use ratatui::{
    backend::Backend,
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span, Text},
    widgets::{Block, Borders, Clear, List, ListItem, Paragraph, Wrap},
    Frame,
};
use std::collections::HashMap;
use std::path::PathBuf;
use tracing::{debug, error, info, instrument};

/// Merge conflict resolution state
pub struct ConflictResolver {
    conflicts: Vec<MergeConflict>,
    selected_conflict: usize,
    resolution_mode: ResolutionMode,
    scroll_offset: usize,
}

#[derive(Clone, Copy, PartialEq)]
pub enum ResolutionMode {
    List,
    Resolve,
    Resolved,
}

/// A single merge conflict
pub struct MergeConflict {
    pub path: PathBuf,
    pub ancestor: Option<ConflictHunk>,
    pub ours: Option<ConflictHunk>,
    pub theirs: Option<ConflictHunk>,
    pub content: String,
    pub markers: Vec<ConflictMarker>,
    pub resolution: ConflictResolution,
}

/// A hunk from one side of the conflict
pub struct ConflictHunk {
    pub content: String,
    pub start_line: usize,
    pub end_line: usize,
}

/// Conflict markers in the file
#[derive(Clone)]
pub struct ConflictMarker {
    pub marker_type: MarkerType,
    pub line_number: usize,
    pub label: Option<String>,
}

#[derive(Clone, PartialEq)]
pub enum MarkerType {
    OursStart,      // <<<<<<<
    Base,           // |||||||
    TheirsStart,    // =======
    End,            // >>>>>>>
}

/// Resolution choice for a conflict
#[derive(Clone, PartialEq)]
pub enum ConflictResolution {
    Unresolved,
    Ours,
    Theirs,
    Both,
    Custom(String),
}

impl ConflictResolver {
    pub fn new() -> Self {
        Self {
            conflicts: Vec::new(),
            selected_conflict: 0,
            resolution_mode: ResolutionMode::List,
            scroll_offset: 0,
        }
    }
    
    /// Load conflicts from repository
    #[instrument(skip(self, repo))]
    pub fn load_from_repo(&mut self, repo: &Repository) -> Result<(), git2::Error> {
        info!("Loading merge conflicts from repository");
        
        let index = repo.index()?;
        let entries: Vec<IndexEntry> = index.iter().collect();
        
        self.conflicts.clear();
        
        for entry in entries {
            if entry.conflicts() {
                let path = PathBuf::from(std::str::from_utf8(&entry.path).unwrap_or(""));
                
                // Try to read the conflicted file
                let content = std::fs::read_to_string(&path).unwrap_or_default();
                let markers = Self::parse_conflict_markers(&content);
                
                let conflict = MergeConflict {
                    path,
                    ancestor: None, // Would need to get from index stages
                    ours: None,
                    theirs: None,
                    content,
                    markers,
                    resolution: ConflictResolution::Unresolved,
                };
                
                self.conflicts.push(conflict);
            }
        }
        
        info!("Found {} conflicts", self.conflicts.len());
        Ok(())
    }
    
    /// Parse conflict markers from file content
    fn parse_conflict_markers(content: &str) -> Vec<ConflictMarker> {
        let mut markers = Vec::new();
        
        for (line_num, line) in content.lines().enumerate() {
            let trimmed = line.trim();
            
            if trimmed.starts_with("<<<<<<<") {
                let label = trimmed.strip_prefix("<<<<<<<").map(|s| s.trim().to_string());
                markers.push(ConflictMarker {
                    marker_type: MarkerType::OursStart,
                    line_number: line_num,
                    label,
                });
            } else if trimmed.starts_with("|||||||") {
                markers.push(ConflictMarker {
                    marker_type: MarkerType::Base,
                    line_number: line_num,
                    label: None,
                });
            } else if trimmed.starts_with("======") {
                markers.push(ConflictMarker {
                    marker_type: MarkerType::TheirsStart,
                    line_number: line_num,
                    label: None,
                });
            } else if trimmed.starts_with(">>>>>>>") {
                let label = trimmed.strip_prefix(">>>>>>>").map(|s| s.trim().to_string());
                markers.push(ConflictMarker {
                    marker_type: MarkerType::End,
                    line_number: line_num,
                    label,
                });
            }
        }
        
        markers
    }
    
    /// Extract hunks from conflict markers
    fn extract_hunks(content: &str, markers: &[ConflictMarker]) -> (Option<String>, Option<String>, Option<String>) {
        let lines: Vec<&str> = content.lines().collect();
        let mut ours = None;
        let mut base = None;
        let mut theirs = None;
        
        let mut current_section = None;
        let mut current_content = Vec::new();
        
        for (i, line) in lines.iter().enumerate() {
            // Check if this line is a marker
            let is_marker = markers.iter().any(|m| m.line_number == i);
            
            if is_marker {
                // Save previous section
                if let Some(section) = current_section {
                    let content = current_content.join("\n");
                    match section {
                        MarkerType::OursStart => ours = Some(content),
                        MarkerType::Base => base = Some(content),
                        MarkerType::TheirsStart => theirs = Some(content),
                        _ => {}
                    }
                }
                
                // Find which marker this is
                if let Some(marker) = markers.iter().find(|m| m.line_number == i) {
                    current_section = Some(marker.marker_type.clone());
                    current_content.clear();
                }
            } else if current_section.is_some() {
                current_content.push(*line);
            }
        }
        
        (base, ours, theirs)
    }
    
    /// Render the conflict resolution UI
    pub fn render<B: Backend>(&self, frame: &mut Frame<B>, area: Rect) {
        match self.resolution_mode {
            ResolutionMode::List => self.render_conflict_list(frame, area),
            ResolutionMode::Resolve => self.render_resolution_view(frame, area),
            ResolutionMode::Resolved => self.render_resolved_view(frame, area),
        }
    }
    
    /// Render list of conflicts
    fn render_conflict_list<B: Backend>(&self, frame: &mut Frame<B>, area: Rect) {
        let chunks = Layout::default()
            .direction(Direction::Vertical)
            .constraints([Constraint::Min(3), Constraint::Length(3)])
            .split(area);
        
        // Conflict list
        let items: Vec<ListItem> = self.conflicts.iter().enumerate().map(|(i, conflict)| {
            let status = match conflict.resolution {
                ConflictResolution::Unresolved => ("●", Color::Red),
                _ => ("✓", Color::Green),
            };
            
            let prefix = if i == self.selected_conflict { "> " } else { "  " };
            
            let line = Line::from(vec![
                Span::raw(prefix),
                Span::styled(status.0, Style::default().fg(status.1)),
                Span::raw(" "),
                Span::raw(conflict.path.to_string_lossy().to_string()),
            ]);
            
            ListItem::new(line)
        }).collect();
        
        let list = List::new(items)
            .block(Block::default()
                .title(format!("Merge Conflicts ({} unresolved)", 
                    self.conflicts.iter().filter(|c| matches!(c.resolution, ConflictResolution::Unresolved)).count()))
                .borders(Borders::ALL))
            .highlight_style(Style::default().add_modifier(Modifier::REVERSED));
        
        frame.render_widget(list, chunks[0]);
        
        // Help text
        let help = Paragraph::new("j/k: navigate | Enter: resolve | a: accept ours | t: accept theirs | b: accept both | q: quit")
            .block(Block::default().borders(Borders::ALL));
        
        frame.render_widget(help, chunks[1]);
    }
    
    /// Render side-by-side resolution view
    fn render_resolution_view<B: Backend>(&self, frame: &mut Frame<B>, area: Rect) {
        if let Some(conflict) = self.conflicts.get(self.selected_conflict) {
            let chunks = Layout::default()
                .direction(Direction::Vertical)
                .constraints([Constraint::Length(3), Constraint::Min(0), Constraint::Length(3)])
                .split(area);
            
            // Header
            let header = Paragraph::new(Text::from(vec![
                Line::from(vec![
                    Span::raw("Resolving: "),
                    Span::styled(
                        conflict.path.to_string_lossy().to_string(),
                        Style::default().add_modifier(Modifier::BOLD)
                    ),
                ]),
            ]))
            .block(Block::default().borders(Borders::ALL));
            
            frame.render_widget(header, chunks[0]);
            
            // Side-by-side diff
            let diff_chunks = Layout::default()
                .direction(Direction::Horizontal)
                .constraints([Constraint::Percentage(50), Constraint::Percentage(50)])
                .split(chunks[1]);
            
            // Ours (left)
            let ours_content = conflict.content.lines()
                .enumerate()
                .map(|(i, line)| {
                    let in_ours = conflict.markers.iter().any(|m| {
                        m.marker_type == MarkerType::OursStart && i > m.line_number
                    }) && conflict.markers.iter().any(|m| {
                        (m.marker_type == MarkerType::TheirsStart || m.marker_type == MarkerType::Base) 
                            && i < m.line_number
                    });
                    
                    let style = if in_ours {
                        Style::default().fg(Color::Green)
                    } else {
                        Style::default().fg(Color::DarkGray)
                    };
                    
                    Line::from(vec![
                        Span::styled(format!("{:4} | ", i + 1), Style::default().fg(Color::DarkGray)),
                        Span::styled(line.to_string(), style),
                    ])
                })
                .collect::<Vec<_>>();
            
            let ours_widget = Paragraph::new(Text::from(ours_content))
                .block(Block::default()
                    .title("Ours (Current Branch)")
                    .borders(Borders::ALL))
                .scroll((self.scroll_offset as u16, 0));
            
            frame.render_widget(ours_widget, diff_chunks[0]);
            
            // Theirs (right)
            let theirs_content = conflict.content.lines()
                .enumerate()
                .map(|(i, line)| {
                    let in_theirs = conflict.markers.iter().any(|m| {
                        m.marker_type == MarkerType::TheirsStart && i > m.line_number
                    }) && conflict.markers.iter().any(|m| {
                        m.marker_type == MarkerType::End && i < m.line_number
                    });
                    
                    let style = if in_theirs {
                        Style::default().fg(Color::Blue)
                    } else {
                        Style::default().fg(Color::DarkGray)
                    };
                    
                    Line::from(vec![
                        Span::styled(format!("{:4} | ", i + 1), Style::default().fg(Color::DarkGray)),
                        Span::styled(line.to_string(), style),
                    ])
                })
                .collect::<Vec<_>>();
            
            let theirs_widget = Paragraph::new(Text::from(theirs_content))
                .block(Block::default()
                    .title("Theirs (Incoming Branch)")
                    .borders(Borders::ALL))
                .scroll((self.scroll_offset as u16, 0));
            
            frame.render_widget(theirs_widget, diff_chunks[1]);
            
            // Footer with controls
            let footer = Paragraph::new(
                "j/k: scroll | 1: accept ours | 2: accept theirs | 3: accept both | 4: edit | n: next | p: previous | q: back to list"
            )
            .block(Block::default().borders(Borders::ALL));
            
            frame.render_widget(footer, chunks[2]);
        }
    }
    
    /// Render resolved conflict view
    fn render_resolved_view<B: Backend>(&self, frame: &mut Frame<B>, area: Rect) {
        if let Some(conflict) = self.conflicts.get(self.selected_conflict) {
            let content = match &conflict.resolution {
                ConflictResolution::Custom(text) => text.clone(),
                ConflictResolution::Ours => {
                    conflict.markers.windows(2)
                        .filter_map(|window| {
                            if window[0].marker_type == MarkerType::OursStart {
                                let start = window[0].line_number + 1;
                                let end = window[1].line_number;
                                let lines: Vec<&str> = conflict.content.lines().collect();
                                Some(lines[start..end].join("\n"))
                            } else {
                                None
                            }
                        })
                        .collect::<Vec<_>>()
                        .join("\n")
                }
                ConflictResolution::Theirs => {
                    conflict.markers.windows(2)
                        .filter_map(|window| {
                            if window[0].marker_type == MarkerType::TheirsStart {
                                let start = window[0].line_number + 1;
                                let end = window[1].line_number;
                                let lines: Vec<&str> = conflict.content.lines().collect();
                                Some(lines[start..end].join("\n"))
                            } else {
                                None
                            }
                        })
                        .collect::<Vec<_>>()
                        .join("\n")
                }
                _ => "(unresolved)".to_string(),
            };
            
            let widget = Paragraph::new(content)
                .block(Block::default()
                    .title("Resolved Content")
                    .borders(Borders::ALL))
                .wrap(Wrap { trim: false });
            
            frame.render_widget(widget, area);
        }
    }
    
    /// Handle input events
    pub fn handle_input(&mut self, key: crossterm::event::KeyEvent) -> ResolutionAction {
        use crossterm::event::KeyCode;
        
        match self.resolution_mode {
            ResolutionMode::List => {
                match key.code {
                    KeyCode::Char('j') | KeyCode::Down => {
                        if self.selected_conflict < self.conflicts.len().saturating_sub(1) {
                            self.selected_conflict += 1;
                        }
                        ResolutionAction::None
                    }
                    KeyCode::Char('k') | KeyCode::Up => {
                        if self.selected_conflict > 0 {
                            self.selected_conflict -= 1;
                        }
                        ResolutionAction::None
                    }
                    KeyCode::Enter => {
                        self.resolution_mode = ResolutionMode::Resolve;
                        self.scroll_offset = 0;
                        ResolutionAction::None
                    }
                    KeyCode::Char('a') => {
                        if let Some(conflict) = self.conflicts.get_mut(self.selected_conflict) {
                            conflict.resolution = ConflictResolution::Ours;
                        }
                        ResolutionAction::ResolveCurrent(ConflictResolution::Ours)
                    }
                    KeyCode::Char('t') => {
                        if let Some(conflict) = self.conflicts.get_mut(self.selected_conflict) {
                            conflict.resolution = ConflictResolution::Theirs;
                        }
                        ResolutionAction::ResolveCurrent(ConflictResolution::Theirs)
                    }
                    KeyCode::Char('b') => {
                        if let Some(conflict) = self.conflicts.get_mut(self.selected_conflict) {
                            conflict.resolution = ConflictResolution::Both;
                        }
                        ResolutionAction::ResolveCurrent(ConflictResolution::Both)
                    }
                    KeyCode::Char('q') => ResolutionAction::Quit,
                    _ => ResolutionAction::None,
                }
            }
            ResolutionMode::Resolve => {
                match key.code {
                    KeyCode::Char('j') | KeyCode::Down => {
                        self.scroll_offset += 1;
                        ResolutionAction::None
                    }
                    KeyCode::Char('k') | KeyCode::Up => {
                        if self.scroll_offset > 0 {
                            self.scroll_offset -= 1;
                        }
                        ResolutionAction::None
                    }
                    KeyCode::Char('1') => {
                        if let Some(conflict) = self.conflicts.get_mut(self.selected_conflict) {
                            conflict.resolution = ConflictResolution::Ours;
                        }
                        self.resolution_mode = ResolutionMode::Resolved;
                        ResolutionAction::ResolveCurrent(ConflictResolution::Ours)
                    }
                    KeyCode::Char('2') => {
                        if let Some(conflict) = self.conflicts.get_mut(self.selected_conflict) {
                            conflict.resolution = ConflictResolution::Theirs;
                        }
                        self.resolution_mode = ResolutionMode::Resolved;
                        ResolutionAction::ResolveCurrent(ConflictResolution::Theirs)
                    }
                    KeyCode::Char('3') => {
                        if let Some(conflict) = self.conflicts.get_mut(self.selected_conflict) {
                            conflict.resolution = ConflictResolution::Both;
                        }
                        self.resolution_mode = ResolutionMode::Resolved;
                        ResolutionAction::ResolveCurrent(ConflictResolution::Both)
                    }
                    KeyCode::Char('4') => {
                        // Edit mode - would open editor
                        ResolutionAction::EditCurrent
                    }
                    KeyCode::Char('n') => {
                        // Next conflict
                        if self.selected_conflict < self.conflicts.len().saturating_sub(1) {
                            self.selected_conflict += 1;
                            self.scroll_offset = 0;
                        }
                        ResolutionAction::None
                    }
                    KeyCode::Char('p') => {
                        // Previous conflict
                        if self.selected_conflict > 0 {
                            self.selected_conflict -= 1;
                            self.scroll_offset = 0;
                        }
                        ResolutionAction::None
                    }
                    KeyCode::Char('q') | KeyCode::Esc => {
                        self.resolution_mode = ResolutionMode::List;
                        ResolutionAction::None
                    }
                    _ => ResolutionAction::None,
                }
            }
            ResolutionMode::Resolved => {
                match key.code {
                    KeyCode::Char('q') | KeyCode::Esc => {
                        self.resolution_mode = ResolutionMode::Resolve;
                        ResolutionAction::None
                    }
                    _ => ResolutionAction::None,
                }
            }
        }
    }
    
    /// Apply all resolutions to the repository
    #[instrument(skip(self, repo))]
    pub fn apply_resolutions(&self, repo: &Repository) -> Result<(), git2::Error> {
        let mut index = repo.index()?;
        
        for conflict in &self.conflicts {
            match &conflict.resolution {
                ConflictResolution::Unresolved => {
                    // Skip unresolved
                    continue;
                }
                resolution => {
                    let content = match resolution {
                        ConflictResolution::Ours => {
                            // Get ours version from index stage 2
                            self.get_index_content(&index, &conflict.path, 2)?
                        }
                        ConflictResolution::Theirs => {
                            // Get theirs version from index stage 3
                            self.get_index_content(&index, &conflict.path, 3)?
                        }
                        ConflictResolution::Both => {
                            // Concatenate both versions
                            let ours = self.get_index_content(&index, &conflict.path, 2)?;
                            let theirs = self.get_index_content(&index, &conflict.path, 3)?;
                            format!("{}\n{}", ours, theirs)
                        }
                        ConflictResolution::Custom(content) => content.clone(),
                        _ => continue,
                    };
                    
                    // Write resolved content
                    std::fs::write(&conflict.path, content)?;
                    
                    // Add to index to mark as resolved
                    index.add_path(&conflict.path)?;
                    
                    info!("Resolved conflict in: {:?}", conflict.path);
                }
            }
        }
        
        index.write()?;
        Ok(())
    }
    
    /// Get content from specific index stage
    fn get_index_content(&self, index: &Index, path: &PathBuf, stage: u32) -> Result<String, git2::Error> {
        // This is a simplified version - would need proper index lookup
        // by path and stage number
        Ok(String::new())
    }
    
    /// Check if all conflicts are resolved
    pub fn all_resolved(&self) -> bool {
        self.conflicts.iter().all(|c| !matches!(c.resolution, ConflictResolution::Unresolved))
    }
}

/// Actions from conflict resolution UI
#[derive(Clone, Debug)]
pub enum ResolutionAction {
    None,
    ResolveCurrent(ConflictResolution),
    EditCurrent,
    Quit,
}

