//! Branch visualization and graph
//!
//! Renders ASCII/Unicode git branch graphs similar to `git log --graph`
//! with interactive navigation.

use git2::{BranchType, Commit, Oid, Repository, Signature, Time};
use ratatui::{
    backend::Backend,
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    symbols::line::{HORIZONTAL, VERTICAL, BOTTOM_LEFT, TOP_LEFT, TOP_RIGHT, BOTTOM_RIGHT},
    text::{Line, Span, Text},
    widgets::{Block, Borders, Clear, List, ListItem, Paragraph, Scrollbar, ScrollbarOrientation, ScrollbarState},
    Frame,
};
use std::collections::{HashMap, HashSet, VecDeque};
use tracing::{debug, error, info, instrument};

/// Branch graph visualization state
pub struct BranchGraph {
    commits: Vec<GraphCommit>,
    branches: Vec<BranchInfo>,
    selected_commit: usize,
    scroll_offset: usize,
    graph_width: usize,
    show_remote_branches: bool,
    show_tags: bool,
}

/// A commit in the graph
pub struct GraphCommit {
    pub id: Oid,
    pub message: String,
    pub author: String,
    pub time: Time,
    pub parents: Vec<Oid>,
    pub children: Vec<Oid>,
    pub branch_labels: Vec<String>,
    pub tags: Vec<String>,
    pub graph_column: usize,
    pub graph_char: GraphChar,
    pub graph_lines: Vec<GraphLine>,
}

/// Characters for drawing the graph
pub enum GraphChar {
    Commit,           // ●
    Merge,            // ◆
    BranchPoint,      // ●
}

/// Lines to draw between commits
pub struct GraphLine {
    pub from_column: usize,
    pub to_column: usize,
    pub style: GraphLineStyle,
}

pub enum GraphLineStyle {
    Straight,         // │
    Merge,            // ╱ or ╲
    Branch,           // ├ or └
}

/// Branch information
pub struct BranchInfo {
    pub name: String,
    pub is_head: bool,
    pub upstream: Option<String>,
    pub ahead: usize,
    pub behind: usize,
    pub last_commit: Option<Oid>,
    pub color: Color,
}

impl BranchGraph {
    pub fn new() -> Self {
        Self {
            commits: Vec::new(),
            branches: Vec::new(),
            selected_commit: 0,
            scroll_offset: 0,
            graph_width: 20,
            show_remote_branches: true,
            show_tags: true,
        }
    }
    
    /// Load commits and build graph
    #[instrument(skip(self, repo))]
    pub fn load_from_repo(&mut self, repo: &Repository) -> Result<(), git2::Error> {
        info!("Loading branch graph from repository");
        
        self.load_branches(repo)?;
        self.load_commits(repo)?;
        self.build_graph_structure()?;
        self.assign_branch_labels();
        
        info!("Loaded {} commits, {} branches", self.commits.len(), self.branches.len());
        Ok(())
    }
    
    /// Load branch information
    fn load_branches(&mut self, repo: &Repository) -> Result<(), git2::Error> {
        self.branches.clear();
        
        let branch_colors = vec![
            Color::Red,
            Color::Green,
            Color::Yellow,
            Color::Blue,
            Color::Magenta,
            Color::Cyan,
            Color::LightRed,
            Color::LightGreen,
            Color::LightYellow,
        ];
        
        let mut color_idx = 0;
        
        // Local branches
        for branch in repo.branches(Some(BranchType::Local))? {
            let (branch, branch_type) = branch?;
            
            let name = branch.name()?.unwrap_or("unnamed").to_string();
            let is_head = branch.is_head();
            
            let upstream = branch.upstream().ok().and_then(|b| {
                b.name().ok().flatten().map(|s| s.to_string())
            });
            
            let (ahead, behind) = if let Ok(upstream) = branch.upstream() {
                if let (Some(local_oid), Some(upstream_oid)) = (
                    branch.get().peel_to_commit().ok().map(|c| c.id()),
                    upstream.get().peel_to_commit().ok().map(|c| c.id())
                ) {
                    repo.graph_ahead_behind(local_oid, upstream_oid).unwrap_or((0, 0))
                } else {
                    (0, 0)
                }
            } else {
                (0, 0)
            };
            
            let last_commit = branch.get().target();
            
            let color = branch_colors[color_idx % branch_colors.len()];
            color_idx += 1;
            
            self.branches.push(BranchInfo {
                name,
                is_head,
                upstream,
                ahead,
                behind,
                last_commit,
                color,
            });
        }
        
        // Remote branches if enabled
        if self.show_remote_branches {
            for branch in repo.branches(Some(BranchType::Remote))? {
                let (branch, _) = branch?;
                
                let name = branch.name()?.unwrap_or("unnamed").to_string();
                let last_commit = branch.get().target();
                let color = branch_colors[color_idx % branch_colors.len()];
                color_idx += 1;
                
                self.branches.push(BranchInfo {
                    name,
                    is_head: false,
                    upstream: None,
                    ahead: 0,
                    behind: 0,
                    last_commit,
                    color,
                });
            }
        }
        
        Ok(())
    }
    
    /// Load commits
    fn load_commits(&mut self, repo: &Repository) -> Result<(), git2::Error> {
        self.commits.clear();
        
        let mut revwalk = repo.revwalk()?;
        revwalk.push_head()?;
        
        // Collect all branch tips to include in graph
        for branch in &self.branches {
            if let Some(oid) = branch.last_commit {
                revwalk.push(oid)?;
            }
        }
        
        let mut seen = HashSet::new();
        let mut queue: VecDeque<Oid> = VecDeque::new();
        
        // Start from HEAD
        if let Ok(head) = repo.head() {
            if let Some(oid) = head.target() {
                queue.push_back(oid);
            }
        }
        
        // Process commits breadth-first
        while let Some(oid) = queue.pop_front() {
            if seen.contains(&oid) {
                continue;
            }
            seen.insert(oid);
            
            if let Ok(commit) = repo.find_commit(oid) {
                let parents: Vec<Oid> = commit.parent_ids().collect();
                
                for parent in &parents {
                    queue.push_back(*parent);
                }
                
                // Get tags for this commit
                let tags = self.get_tags_for_commit(repo, oid)?;
                
                let graph_commit = GraphCommit {
                    id: oid,
                    message: commit.message().unwrap_or("").lines().next().unwrap_or("").to_string(),
                    author: commit.author().name().unwrap_or("Unknown").to_string(),
                    time: commit.time(),
                    parents,
                    children: Vec::new(), // Will be populated later
                    branch_labels: Vec::new(), // Will be assigned later
                    tags,
                    graph_column: 0, // Will be calculated
                    graph_char: if parents.len() > 1 {
                        GraphChar::Merge
                    } else {
                        GraphChar::Commit
                    },
                    graph_lines: Vec::new(), // Will be built later
                };
                
                self.commits.push(graph_commit);
            }
        }
        
        // Reverse to get chronological order (oldest first)
        self.commits.reverse();
        
        Ok(())
    }
    
    /// Get tags pointing to a commit
    fn get_tags_for_commit(&self, repo: &Repository, oid: Oid) -> Result<Vec<String>, git2::Error> {
        let mut tags = Vec::new();
        
        repo.tag_foreach(|tag_oid, name| {
            if let Ok(tag) = repo.find_tag(tag_oid) {
                if tag.target_id() == oid {
                    let name = String::from_utf8_lossy(name)
                        .strip_prefix("refs/tags/")
                        .map(|s| s.to_string())
                        .unwrap_or_else(|| String::from_utf8_lossy(name).to_string());
                    tags.push(name);
                }
            }
            true
        })?;
        
        Ok(tags)
    }
    
    /// Build graph structure (columns, lines)
    fn build_graph_structure(&mut self) -> Result<(), git2::Error> {
        // Build parent-child relationships
        let mut id_to_idx: HashMap<Oid, usize> = HashMap::new();
        for (idx, commit) in self.commits.iter().enumerate() {
            id_to_idx.insert(commit.id, idx);
        }
        
        // Populate children
        for idx in 0..self.commits.len() {
            let parents = self.commits[idx].parents.clone();
            for parent in parents {
                if let Some(parent_idx) = id_to_idx.get(&parent) {
                    if !self.commits[*parent_idx].children.contains(&self.commits[idx].id) {
                        self.commits[*parent_idx].children.push(self.commits[idx].id);
                    }
                }
            }
        }
        
        // Calculate columns for each commit
        // This is a simplified algorithm - full implementation would be more complex
        let mut active_branches: Vec<Option<Oid>> = Vec::new();
        
        for idx in 0..self.commits.len() {
            let commit = &self.commits[idx];
            
            // Find if this commit continues an existing branch
            let mut found_column = None;
            for (col_idx, branch_tip) in active_branches.iter().enumerate() {
                if let Some(tip) = branch_tip {
                    if commit.children.contains(tip) {
                        found_column = Some(col_idx);
                        break;
                    }
                }
            }
            
            // Assign column
            let column = if let Some(col) = found_column {
                active_branches[col] = Some(commit.id);
                col
            } else {
                // New branch
                let new_col = active_branches.len();
                active_branches.push(Some(commit.id));
                new_col
            };
            
            self.commits[idx].graph_column = column;
            
            // If this is a merge, we need to handle the other parent
            if commit.parents.len() > 1 {
                // The merge parent would need a line from another column
                for parent in &commit.parents[1..] {
                    if let Some(parent_idx) = id_to_idx.get(parent) {
                        // Find an available column for the merge line
                        let merge_column = active_branches.len();
                        self.commits[idx].graph_lines.push(GraphLine {
                            from_column: column,
                            to_column: merge_column,
                            style: GraphLineStyle::Merge,
                        });
                        active_branches.push(Some(*parent));
                    }
                }
            }
            
            // Clean up completed branches
            for col in (0..active_branches.len()).rev() {
                if let Some(tip) = active_branches[col] {
                    if tip == commit.id && commit.children.is_empty() {
                        active_branches[col] = None;
                    }
                }
            }
        }
        
        // Calculate max width
        self.graph_width = self.commits.iter()
            .map(|c| c.graph_column)
            .max()
            .unwrap_or(0) + 1;
        
        Ok(())
    }
    
    /// Assign branch labels to commits
    fn assign_branch_labels(&mut self) {
        for branch in &self.branches {
            if let Some(commit_oid) = branch.last_commit {
                if let Some(commit) = self.commits.iter_mut().find(|c| c.id == commit_oid) {
                    commit.branch_labels.push(branch.name.clone());
                }
            }
        }
    }
    
    /// Render the branch graph
    pub fn render<B: Backend>(&self, frame: &mut Frame<B>, area: Rect) {
        let chunks = Layout::default()
            .direction(Direction::Horizontal)
            .constraints([Constraint::Length(self.graph_width as u16 + 2), Constraint::Min(20)])
            .split(area);
        
        // Graph visualization (left panel)
        self.render_graph(frame, chunks[0]);
        
        // Commit details (right panel)
        self.render_commit_details(frame, chunks[1]);
    }
    
    /// Render the ASCII graph
    fn render_graph<B: Backend>(&self, frame: &mut Frame<B>, area: Rect) {
        let visible_commits: Vec<_> = self.commits.iter()
            .skip(self.scroll_offset)
            .take(area.height as usize)
            .enumerate()
            .collect();
        
        let lines: Vec<Line> = visible_commits.iter().map(|(i, commit)| {
            let is_selected = self.scroll_offset + i == self.selected_commit;
            
            // Build graph characters for this line
            let mut graph_chars = vec![' '; self.graph_width * 2];
            
            // Draw the commit point
            let col = commit.graph_column * 2;
            graph_chars[col] = match commit.graph_char {
                GraphChar::Commit => if is_selected { '*' } else { '●' },
                GraphChar::Merge => if is_selected { '*' } else { '◆' },
                GraphChar::BranchPoint => if is_selected { '*' } else { '●' },
            };
            
            // Draw lines to parents and children
            for line in &commit.graph_lines {
                let from_col = line.from_column * 2;
                let to_col = line.to_column * 2;
                
                let line_char = match line.style {
                    GraphLineStyle::Straight => '│',
                    GraphLineStyle::Merge => if from_col < to_col { '╱' } else { '╲' },
                    GraphLineStyle::Branch => '├',
                };
                
                // Draw line between columns
                let start = from_col.min(to_col);
                let end = from_col.max(to_col);
                for c in start..=end {
                    if graph_chars[c] == ' ' {
                        graph_chars[c] = if c == from_col { line_char } else { '─' };
                    }
                }
            }
            
            // Build spans with colors
            let mut spans = vec![Span::raw(graph_chars.iter().collect::<String>())];
            
            // Add branch labels if any
            if !commit.branch_labels.is_empty() {
                let label = commit.branch_labels.join(", ");
                spans.push(Span::raw(" "));
                spans.push(Span::styled(
                    format!("({})", label),
                    Style::default().fg(Color::Cyan)
                ));
            }
            
            // Add tags
            if self.show_tags && !commit.tags.is_empty() {
                for tag in &commit.tags {
                    spans.push(Span::raw(" "));
                    spans.push(Span::styled(
                        format!("{}", tag),
                        Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)
                    ));
                }
            }
            
            Line::from(spans)
        }).collect();
        
        let graph = Paragraph::new(Text::from(lines))
            .block(Block::default()
                .title("Graph")
                .borders(Borders::ALL));
        
        frame.render_widget(graph, area);
    }
    
    /// Render commit details
    fn render_commit_details<B: Backend>(&self, frame: &mut Frame<B>, area: Rect) {
        let chunks = Layout::default()
            .direction(Direction::Vertical)
            .constraints([Constraint::Min(0), Constraint::Length(10)])
            .split(area);
        
        // Commit list
        let items: Vec<Line> = self.commits.iter()
            .skip(self.scroll_offset)
            .take(chunks[0].height as usize)
            .enumerate()
            .map(|(i, commit)| {
                let is_selected = self.scroll_offset + i == self.selected_commit;
                
                // Format time
                let time_str = chrono::DateTime::from_timestamp(
                    commit.time.seconds(),
                    0
                ).map(|dt| {
                    dt.format("%Y-%m-%d %H:%M").to_string()
                }).unwrap_or_else(|| "unknown".to_string());
                
                // Shorten commit id
                let id_short = format!("{:.7}", commit.id);
                
                // Truncate message
                let msg = if commit.message.len() > 50 {
                    format!("{}...", &commit.message[..50])
                } else {
                    commit.message.clone()
                };
                
                let prefix = if is_selected { "> " } else { "  " };
                
                Line::from(vec![
                    Span::raw(prefix),
                    Span::styled(id_short, Style::default().fg(Color::Yellow)),
                    Span::raw(" "),
                    Span::styled(time_str, Style::default().fg(Color::DarkGray)),
                    Span::raw(" "),
                    Span::styled(msg, if is_selected {
                        Style::default().add_modifier(Modifier::BOLD)
                    } else {
                        Style::default()
                    }),
                ])
            })
            .collect();
        
        let list = Paragraph::new(Text::from(items))
            .block(Block::default()
                .title(format!("Commits ({} total)", self.commits.len()))
                .borders(Borders::ALL))
            .scroll((self.scroll_offset as u16, 0));
        
        frame.render_widget(list, chunks[0]);
        
        // Selected commit details
        if let Some(commit) = self.commits.get(self.selected_commit) {
            let details = Paragraph::new(Text::from(vec![
                Line::from(vec![
                    Span::styled("Commit: ", Style::default().add_modifier(Modifier::BOLD)),
                    Span::raw(commit.id.to_string()),
                ]),
                Line::from(vec![
                    Span::styled("Author: ", Style::default().add_modifier(Modifier::BOLD)),
                    Span::raw(format!("{} <{}>", 
                        commit.author,
                        "")), // Would need email
                ]),
                Line::from(vec![
                    Span::styled("Date: ", Style::default().add_modifier(Modifier::BOLD)),
                    Span::raw(format!("{}", commit.time.seconds())),
                ]),
                Line::from(vec![
                    Span::styled("Parents: ", Style::default().add_modifier(Modifier::BOLD)),
                    Span::raw(format!("{} ({:?})", 
                        commit.parents.len(),
                        commit.parents.iter().map(|p| format!("{:.7}", p)).collect::<Vec<_>>())),
                ]),
                Line::from(""),
                Line::from(vec![
                    Span::styled("Message:", Style::default().add_modifier(Modifier::BOLD)),
                ]),
                Line::from(commit.message.clone()),
            ]))
            .block(Block::default()
                .title("Details")
                .borders(Borders::ALL));
            
            frame.render_widget(details, chunks[1]);
        }
        
        // Add scrollbar
        let scrollbar = Scrollbar::default()
            .orientation(ScrollbarOrientation::VerticalRight)
            .begin_symbol(Some("↑"))
            .end_symbol(Some("↓"));
        
        let mut scrollbar_state = ScrollbarState::default()
            .content_length(self.commits.len())
            .position(self.selected_commit);
        
        frame.render_stateful_widget(
            scrollbar,
            chunks[0].inner(&ratatui::layout::Margin {
                horizontal: 0,
                vertical: 1,
            }),
            &mut scrollbar_state,
        );
    }
    
    /// Handle input
    pub fn handle_input(&mut self, key: crossterm::event::KeyEvent) -> GraphAction {
        use crossterm::event::KeyCode;
        
        match key.code {
            KeyCode::Char('j') | KeyCode::Down => {
                if self.selected_commit < self.commits.len().saturating_sub(1) {
                    self.selected_commit += 1;
                    // Adjust scroll if needed
                    if self.selected_commit >= self.scroll_offset + 20 {
                        self.scroll_offset += 1;
                    }
                }
                GraphAction::None
            }
            KeyCode::Char('k') | KeyCode::Up => {
                if self.selected_commit > 0 {
                    self.selected_commit -= 1;
                    if self.selected_commit < self.scroll_offset {
                        self.scroll_offset = self.selected_commit;
                    }
                }
                GraphAction::None
            }
            KeyCode::PageDown => {
                self.selected_commit = (self.selected_commit + 20).min(self.commits.len().saturating_sub(1));
                self.scroll_offset = (self.scroll_offset + 20).min(self.commits.len().saturating_sub(20));
                GraphAction::None
            }
            KeyCode::PageUp => {
                self.selected_commit = self.selected_commit.saturating_sub(20);
                self.scroll_offset = self.scroll_offset.saturating_sub(20);
                GraphAction::None
            }
            KeyCode::Char('g') => {
                self.selected_commit = 0;
                self.scroll_offset = 0;
                GraphAction::None
            }
            KeyCode::Char('G') => {
                self.selected_commit = self.commits.len().saturating_sub(1);
                self.scroll_offset = self.commits.len().saturating_sub(20);
                GraphAction::None
            }
            KeyCode::Char('r') => {
                GraphAction::ToggleRemoteBranches
            }
            KeyCode::Char('t') => {
                self.show_tags = !self.show_tags;
                GraphAction::None
            }
            KeyCode::Char('q') => GraphAction::Quit,
            _ => GraphAction::None,
        }
    }
    
    /// Get selected commit
    pub fn selected_commit(&self) -> Option<&GraphCommit> {
        self.commits.get(self.selected_commit)
    }
    
    /// Get branches
    pub fn branches(&self) -> &[BranchInfo] {
        &self.branches
    }
}

/// Actions from branch graph
#[derive(Clone, Debug)]
pub enum GraphAction {
    None,
    ToggleRemoteBranches,
    CheckoutBranch(String),
    CreateBranch(String),
    DeleteBranch(String),
    MergeBranch(String),
    RebaseBranch(String),
    Quit,
}

/// Branch comparison view
pub struct BranchComparison {
    pub base_branch: String,
    pub compare_branch: String,
    pub ahead_commits: Vec<ComparisonCommit>,
    pub behind_commits: Vec<ComparisonCommit>,
    pub diverged_commits: Vec<ComparisonCommit>,
}

pub struct ComparisonCommit {
    pub id: Oid,
    pub message: String,
    pub author: String,
    pub time: Time,
}

impl BranchComparison {
    /// Compare two branches
    pub fn compare(repo: &Repository, base: &str, compare: &str) -> Result<Self, git2::Error> {
        let base_ref = repo.find_branch(base, BranchType::Local)?;
        let compare_ref = repo.find_branch(compare, BranchType::Local)?;
        
        let base_commit = base_ref.get().peel_to_commit()?;
        let compare_commit = compare_ref.get().peel_to_commit()?;
        
        let (ahead, behind) = repo.graph_ahead_behind(compare_commit.id(), base_commit.id())?;
        
        // Collect ahead commits
        let mut ahead_commits = Vec::new();
        let mut revwalk = repo.revwalk()?;
        revwalk.push(compare_commit.id())?;
        revwalk.hide(base_commit.id())?;
        
        for oid in revwalk {
            let oid = oid?;
            if let Ok(commit) = repo.find_commit(oid) {
                ahead_commits.push(ComparisonCommit {
                    id: oid,
                    message: commit.message().unwrap_or("").lines().next().unwrap_or("").to_string(),
                    author: commit.author().name().unwrap_or("Unknown").to_string(),
                    time: commit.time(),
                });
            }
        }
        
        // Collect behind commits
        let mut behind_commits = Vec::new();
        let mut revwalk = repo.revwalk()?;
        revwalk.push(base_commit.id())?;
        revwalk.hide(compare_commit.id())?;
        
        for oid in revwalk {
            let oid = oid?;
            if let Ok(commit) = repo.find_commit(oid) {
                behind_commits.push(ComparisonCommit {
                    id: oid,
                    message: commit.message().unwrap_or("").lines().next().unwrap_or("").to_string(),
                    author: commit.author().name().unwrap_or("Unknown").to_string(),
                    time: commit.time(),
                });
            }
        }
        
        Ok(Self {
            base_branch: base.to_string(),
            compare_branch: compare.to_string(),
            ahead_commits,
            behind_commits,
            diverged_commits: Vec::new(),
        })
    }
}

