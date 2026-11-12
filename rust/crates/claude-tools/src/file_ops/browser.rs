//! Interactive file browser with tree view
//!
//! Provides a navigable file tree similar to vim's NERDTree
//! or VS Code's explorer with keyboard navigation.

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::fs;
use ratatui::{
    backend::Backend,
    layout::{Constraint, Direction, Layout, Rect, Margin},
    style::{Color, Modifier, Style},
    text::{Line, Span, Text},
    widgets::{Block, Borders, Clear, List, ListItem, Paragraph, Scrollbar, ScrollbarOrientation, ScrollbarState},
    Frame,
};
use tracing::{debug, error, info, instrument};

/// File browser state
pub struct FileBrowser {
    root: PathBuf,
    items: Vec<FileTreeItem>,
    selected_index: usize,
    scroll_offset: usize,
    expanded_dirs: HashSet<PathBuf>,
    selected_items: HashSet<PathBuf>,
    show_hidden: bool,
    filter: Option<String>,
    preview_mode: PreviewMode,
}

#[derive(Clone, Copy, PartialEq)]
pub enum PreviewMode {
    None,
    Split,
    Fullscreen,
}

/// An item in the file tree
pub struct FileTreeItem {
    pub path: PathBuf,
    pub name: String,
    pub depth: usize,
    pub is_dir: bool,
    pub is_expanded: bool,
    pub size: u64,
    pub modified: Option<std::time::SystemTime>,
    pub is_selected: bool,
}

/// Icons for file types
pub struct FileIcons;

impl FileIcons {
    pub fn folder() -> &'static str { "📁" }
    pub fn folder_open() -> &'static str { "📂" }
    pub fn file() -> &'static str { "📄" }
    pub fn binary() -> &'static str { "⚙️" }
    pub fn image() -> &'static str { "🖼️" }
    pub fn code() -> &'static str { "📜" }
    pub fn text() -> &'static str { "📝" }
    pub fn markdown() -> &'static str { "📖" }
    pub fn git() -> &'static str { "🔀" }
    pub fn config() -> &'static str { "⚙️" }
    pub fn hidden() -> &'static str { "👁️" }
    
    /// Get icon for a file based on extension
    pub fn for_file(path: &Path) -> &'static str {
        if let Some(ext) = path.extension() {
            let ext = ext.to_string_lossy().to_lowercase();
            match ext.as_str() {
                "png" | "jpg" | "jpeg" | "gif" | "bmp" | "svg" | "webp" | "ico" => Self::image(),
                "exe" | "dll" | "so" | "dylib" | "bin" => Self::binary(),
                "rs" | "js" | "ts" | "py" | "java" | "cpp" | "c" | "h" | "go" | "rb" | "php" => Self::code(),
                "md" | "txt" => Self::text(),
                "toml" | "yaml" | "yml" | "json" | "xml" | "ini" | "conf" => Self::config(),
                _ => Self::file(),
            }
        } else {
            Self::file()
        }
    }
}

impl FileBrowser {
    pub fn new(root: PathBuf) -> Self {
        let mut browser = Self {
            root: root.clone(),
            items: Vec::new(),
            selected_index: 0,
            scroll_offset: 0,
            expanded_dirs: HashSet::new(),
            selected_items: HashSet::new(),
            show_hidden: false,
            filter: None,
            preview_mode: PreviewMode::None,
        };
        
        // Expand root by default
        browser.expanded_dirs.insert(root);
        browser.refresh();
        
        browser
    }
    
    /// Refresh the file tree
    #[instrument(skip(self))]
    pub fn refresh(&mut self) {
        self.items.clear();
        self.build_tree(&self.root, 0);
    }
    
    /// Build the tree recursively
    fn build_tree(&mut self, path: &Path, depth: usize) {
        if let Ok(entries) = fs::read_dir(path) {
            let mut entries: Vec<_> = entries.filter_map(|e| e.ok()).collect();
            
            // Sort: directories first, then by name
            entries.sort_by(|a, b| {
                let a_is_dir = a.file_type().map(|t| t.is_dir()).unwrap_or(false);
                let b_is_dir = b.file_type().map(|t| t.is_dir()).unwrap_or(false);
                
                match (a_is_dir, b_is_dir) {
                    (true, false) => std::cmp::Ordering::Less,
                    (false, true) => std::cmp::Ordering::Greater,
                    _ => a.file_name().cmp(&b.file_name()),
                }
            });
            
            for entry in entries {
                let name = entry.file_name().to_string_lossy().to_string();
                
                // Skip hidden files if not showing them
                if !self.show_hidden && name.starts_with('.') {
                    continue;
                }
                
                // Apply filter if set
                if let Some(ref filter) = self.filter {
                    if !name.to_lowercase().contains(&filter.to_lowercase()) {
                        continue;
                    }
                }
                
                let metadata = entry.metadata().ok();
                let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);
                let is_expanded = self.expanded_dirs.contains(&entry.path());
                
                let item = FileTreeItem {
                    path: entry.path(),
                    name: name.clone(),
                    depth,
                    is_dir,
                    is_expanded,
                    size: metadata.as_ref().map(|m| m.len()).unwrap_or(0),
                    modified: metadata.as_ref().and_then(|m| m.modified().ok()),
                    is_selected: self.selected_items.contains(&entry.path()),
                };
                
                self.items.push(item);
                
                // Recursively add children if directory is expanded
                if is_dir && is_expanded {
                    self.build_tree(&entry.path(), depth + 1);
                }
            }
        }
    }
    
    /// Render the file browser
    pub fn render<B: Backend>(&self, frame: &mut Frame<B>, area: Rect) {
        match self.preview_mode {
            PreviewMode::None => self.render_tree_only(frame, area),
            PreviewMode::Split => self.render_with_preview(frame, area),
            PreviewMode::Fullscreen => self.render_fullscreen(frame, area),
        }
    }
    
    /// Render just the tree
    fn render_tree_only<B: Backend>(&self, frame: &mut Frame<B>, area: Rect) {
        let items: Vec<ListItem> = self.items.iter().enumerate().map(|(i, item)| {
            let is_selected = i == self.selected_index;
            
            // Build indentation
            let indent = "  ".repeat(item.depth);
            
            // Expansion indicator
            let expand_indicator = if item.is_dir {
                if item.is_expanded { "▼" } else { "▶" }
            } else {
                " "
            };
            
            // Icon
            let icon = if item.is_dir {
                if item.is_expanded {
                    FileIcons::folder_open()
                } else {
                    FileIcons::folder()
                }
            } else {
                FileIcons::for_file(&item.path)
            };
            
            // Selection indicator
            let check = if item.is_selected { "☑" } else { "☐" };
            
            // Name with color
            let name_style = if is_selected {
                Style::default().bg(Color::Blue).fg(Color::White)
            } else if item.is_dir {
                Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)
            } else if item.name.starts_with('.') {
                Style::default().fg(Color::Gray)
            } else {
                Style::default()
            };
            
            // Size info
            let size_str = if !item.is_dir {
                format!(" ({})", Self::format_size(item.size))
            } else {
                String::new()
            };
            
            let line = Line::from(vec![
                Span::raw(check),
                Span::raw(" "),
                Span::raw(indent),
                Span::raw(expand_indicator),
                Span::raw(" "),
                Span::raw(icon),
                Span::raw(" "),
                Span::styled(item.name.clone(), name_style),
                Span::styled(size_str, Style::default().fg(Color::DarkGray)),
            ]);
            
            ListItem::new(line)
        }).collect();
        
        let list = List::new(items)
            .block(Block::default()
                .title(format!("{} ({}/{} items)", 
                    self.root.to_string_lossy(),
                    self.selected_index + 1,
                    self.items.len()))
                .borders(Borders::ALL))
            .highlight_style(Style::default().add_modifier(Modifier::REVERSED));
        
        frame.render_widget(list, area);
    }
    
    /// Render with preview panel
    fn render_with_preview<B: Backend>(&self, frame: &mut Frame<B>, area: Rect) {
        let chunks = Layout::default()
            .direction(Direction::Horizontal)
            .constraints([Constraint::Percentage(50), Constraint::Percentage(50)])
            .split(area);
        
        self.render_tree_only(frame, chunks[0]);
        
        // Render preview in right panel
        if let Some(item) = self.items.get(self.selected_index) {
            let preview = self.render_preview(item);
            frame.render_widget(preview, chunks[1]);
        }
    }
    
    /// Render preview for an item
    fn render_preview(&self, item: &FileTreeItem) -> Paragraph {
        let mut lines = Vec::new();
        
        lines.push(Line::from(vec![
            Span::styled("Name: ", Style::default().add_modifier(Modifier::BOLD)),
            Span::raw(item.name.clone()),
        ]));
        
        lines.push(Line::from(vec![
            Span::styled("Path: ", Style::default().add_modifier(Modifier::BOLD)),
            Span::raw(item.path.to_string_lossy().to_string()),
        ]));
        
        lines.push(Line::from(vec![
            Span::styled("Type: ", Style::default().add_modifier(Modifier::BOLD)),
            Span::raw(if item.is_dir { "Directory" } else { "File" }),
        ]));
        
        lines.push(Line::from(vec![
            Span::styled("Size: ", Style::default().add_modifier(Modifier::BOLD)),
            Span::raw(Self::format_size(item.size)),
        ]));
        
        if let Some(modified) = item.modified {
            if let Ok(duration) = modified.elapsed() {
                let time_str = if duration.as_secs() < 60 {
                    "just now".to_string()
                } else if duration.as_secs() < 3600 {
                    format!("{} minutes ago", duration.as_secs() / 60)
                } else if duration.as_secs() < 86400 {
                    format!("{} hours ago", duration.as_secs() / 3600)
                } else {
                    format!("{} days ago", duration.as_secs() / 86400)
                };
                
                lines.push(Line::from(vec![
                    Span::styled("Modified: ", Style::default().add_modifier(Modifier::BOLD)),
                    Span::raw(time_str),
                ]));
            }
        }
        
        lines.push(Line::from(""));
        
        // If it's a file, try to show content preview
        if !item.is_dir {
            if let Ok(content) = fs::read_to_string(&item.path) {
                lines.push(Line::from(vec![
                    Span::styled("Preview:", Style::default().add_modifier(Modifier::BOLD)),
                ]));
                lines.push(Line::from("─".repeat(40)));
                
                let preview_lines: Vec<_> = content.lines().take(50).collect();
                for line in preview_lines {
                    // Truncate long lines
                    let line = if line.len() > 80 {
                        format!("{}...", &line[..77])
                    } else {
                        line.to_string()
                    };
                    lines.push(Line::from(line));
                }
                
                if content.lines().count() > 50 {
                    lines.push(Line::from("..."));
                }
            } else {
                lines.push(Line::from(vec![
                    Span::styled("Preview: ", Style::default().add_modifier(Modifier::BOLD)),
                    Span::styled("Binary file", Style::default().fg(Color::Yellow)),
                ]));
            }
        } else {
            // Directory: show item count
            if let Ok(entries) = fs::read_dir(&item.path) {
                let count = entries.count();
                lines.push(Line::from(vec![
                    Span::styled("Contains: ", Style::default().add_modifier(Modifier::BOLD)),
                    Span::raw(format!("{} items", count)),
                ]));
            }
        }
        
        Paragraph::new(Text::from(lines))
            .block(Block::default().title("Preview").borders(Borders::ALL))
            .scroll((0, 0))
    }
    
    /// Render fullscreen preview
    fn render_fullscreen<B: Backend>(&self, frame: &mut Frame<B>, area: Rect) {
        if let Some(item) = self.items.get(self.selected_index) {
            let preview = self.render_preview(item);
            frame.render_widget(preview, area);
        }
    }
    
    /// Format size in human readable format
    fn format_size(size: u64) -> String {
        const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];
        
        if size == 0 {
            return "0 B".to_string();
        }
        
        let exp = (size as f64).log2() as usize / 10;
        let exp = exp.min(UNITS.len() - 1);
        
        let value = size as f64 / (1 << (exp * 10)) as f64;
        
        format!("{:.1} {}", value, UNITS[exp])
    }
    
    /// Handle input
    pub fn handle_input(&mut self, key: crossterm::event::KeyEvent) -> BrowserAction {
        use crossterm::event::KeyCode;
        
        match key.code {
            KeyCode::Char('j') | KeyCode::Down => {
                if self.selected_index < self.items.len().saturating_sub(1) {
                    self.selected_index += 1;
                    // Auto-scroll
                    if self.selected_index >= self.scroll_offset + 20 {
                        self.scroll_offset += 1;
                    }
                }
                BrowserAction::None
            }
            KeyCode::Char('k') | KeyCode::Up => {
                if self.selected_index > 0 {
                    self.selected_index -= 1;
                    if self.selected_index < self.scroll_offset {
                        self.scroll_offset = self.selected_index;
                    }
                }
                BrowserAction::None
            }
            KeyCode::Char('h') | KeyCode::Left => {
                // Collapse current directory or go to parent
                if let Some(item) = self.items.get(self.selected_index) {
                    if item.is_dir && item.is_expanded {
                        self.toggle_expand();
                    } else if let Some(parent) = item.path.parent() {
                        // Try to select parent
                        if let Some(idx) = self.items.iter().position(|i| i.path == parent) {
                            self.selected_index = idx;
                        }
                    }
                }
                BrowserAction::None
            }
            KeyCode::Char('l') | KeyCode::Right | KeyCode::Enter => {
                // Expand or select
                if let Some(item) = self.items.get(self.selected_index) {
                    if item.is_dir {
                        self.toggle_expand();
                        BrowserAction::None
                    } else {
                        BrowserAction::OpenFile(item.path.clone())
                    }
                } else {
                    BrowserAction::None
                }
            }
            KeyCode::Char(' ') => {
                self.toggle_selection();
                BrowserAction::None
            }
            KeyCode::Char('o') => {
                if let Some(item) = self.items.get(self.selected_index) {
                    if !item.is_dir {
                        BrowserAction::OpenFile(item.path.clone())
                    } else {
                        BrowserAction::OpenDirectory(item.path.clone())
                    }
                } else {
                    BrowserAction::None
                }
            }
            KeyCode::Char('e') => {
                if let Some(item) = self.items.get(self.selected_index) {
                    if !item.is_dir {
                        BrowserAction::EditFile(item.path.clone())
                    } else {
                        BrowserAction::None
                    }
                } else {
                    BrowserAction::None
                }
            }
            KeyCode::Char('r') => {
                self.refresh();
                BrowserAction::None
            }
            KeyCode::Char('a') => {
                self.select_all();
                BrowserAction::None
            }
            KeyCode::Char('.') => {
                self.show_hidden = !self.show_hidden;
                self.refresh();
                BrowserAction::None
            }
            KeyCode::Char('p') => {
                self.preview_mode = match self.preview_mode {
                    PreviewMode::None => PreviewMode::Split,
                    PreviewMode::Split => PreviewMode::Fullscreen,
                    PreviewMode::Fullscreen => PreviewMode::None,
                };
                BrowserAction::None
            }
            KeyCode::Char('g') => {
                self.selected_index = 0;
                self.scroll_offset = 0;
                BrowserAction::None
            }
            KeyCode::Char('G') => {
                self.selected_index = self.items.len().saturating_sub(1);
                if self.items.len() > 20 {
                    self.scroll_offset = self.items.len() - 20;
                }
                BrowserAction::None
            }
            KeyCode::Char('/') => {
                BrowserAction::StartFilter
            }
            KeyCode::Char('q') => BrowserAction::Quit,
            KeyCode::Esc => {
                self.preview_mode = PreviewMode::None;
                BrowserAction::None
            }
            _ => BrowserAction::None,
        }
    }
    
    /// Toggle expansion of current directory
    fn toggle_expand(&mut self) {
        if let Some(item) = self.items.get(self.selected_index) {
            if item.is_dir {
                let path = item.path.clone();
                if self.expanded_dirs.contains(&path) {
                    self.expanded_dirs.remove(&path);
                } else {
                    self.expanded_dirs.insert(path);
                }
                self.refresh();
            }
        }
    }
    
    /// Toggle selection of current item
    fn toggle_selection(&mut self) {
        if let Some(item) = self.items.get_mut(self.selected_index) {
            let path = item.path.clone();
            if self.selected_items.contains(&path) {
                self.selected_items.remove(&path);
                item.is_selected = false;
            } else {
                self.selected_items.insert(path);
                item.is_selected = true;
            }
        }
    }
    
    /// Select all visible items
    fn select_all(&mut self) {
        for item in &self.items {
            self.selected_items.insert(item.path.clone());
        }
        self.refresh();
    }
    
    /// Get selected paths
    pub fn selected_paths(&self) -> Vec<&PathBuf> {
        self.selected_items.iter().collect()
    }
    
    /// Set filter
    pub fn set_filter(&mut self, filter: Option<String>) {
        self.filter = filter;
        self.refresh();
    }
    
    /// Get current path
    pub fn current_path(&self) -> Option<&PathBuf> {
        self.items.get(self.selected_index).map(|i| &i.path)
    }
}

/// Actions from file browser
#[derive(Clone, Debug)]
pub enum BrowserAction {
    None,
    OpenFile(PathBuf),
    OpenDirectory(PathBuf),
    EditFile(PathBuf),
    StartFilter,
    Selected(Vec<PathBuf>),
    Quit,
}

/// Batch file operations
pub struct BatchFileOps;

impl BatchFileOps {
    /// Copy files with progress
    #[instrument]
    pub async fn copy_files(
        sources: &[PathBuf],
        destination: &Path,
        progress_tx: mpsc::Sender<(PathBuf, u64, u64)>,
    ) -> Result<BatchResult, FileOpsError> {
        use tokio::fs;
        use tokio::io::AsyncWriteExt;
        
        info!("Copying {} files to {:?}", sources.len(), destination);
        
        let mut copied = Vec::new();
        let mut failed = Vec::new();
        
        for source in sources {
            let dest = if destination.is_dir() {
                destination.join(source.file_name().unwrap_or_default())
            } else {
                destination.to_path_buf()
            };
            
            let total_size = fs::metadata(source).await.map(|m| m.len()).unwrap_or(0);
            let mut copied_size = 0u64;
            
            match fs::copy(source, &dest).await {
                Ok(bytes) => {
                    copied_size = bytes;
                    copied.push(source.clone());
                    let _ = progress_tx.send((source.clone(), copied_size, total_size)).await;
                }
                Err(e) => {
                    failed.push((source.clone(), e.to_string()));
                    error!("Failed to copy {:?}: {}", source, e);
                }
            }
        }
        
        Ok(BatchResult { successful: copied, failed })
    }
    
    /// Move/rename files with progress
    #[instrument]
    pub async fn move_files(
        sources: &[PathBuf],
        destination: &Path,
        progress_tx: mpsc::Sender<(PathBuf, bool)>,
    ) -> Result<BatchResult, FileOpsError> {
        use tokio::fs;
        
        info!("Moving {} files to {:?}", sources.len(), destination);
        
        let mut moved = Vec::new();
        let mut failed = Vec::new();
        
        for source in sources {
            let dest = if destination.is_dir() {
                destination.join(source.file_name().unwrap_or_default())
            } else {
                destination.to_path_buf()
            };
            
            match fs::rename(source, &dest).await {
                Ok(_) => {
                    moved.push(source.clone());
                    let _ = progress_tx.send((source.clone(), true)).await;
                }
                Err(e) => {
                    // Try copy + delete if rename fails (cross-device)
                    match fs::copy(source, &dest).await {
                        Ok(_) => {
                            let _ = fs::remove_file(source).await;
                            moved.push(source.clone());
                            let _ = progress_tx.send((source.clone(), true)).await;
                        }
                        Err(_) => {
                            failed.push((source.clone(), e.to_string()));
                            let _ = progress_tx.send((source.clone(), false)).await;
                        }
                    }
                }
            }
        }
        
        Ok(BatchResult { successful: moved, failed })
    }
    
    /// Delete files with confirmation
    #[instrument]
    pub async fn delete_files(
        paths: &[PathBuf],
        permanent: bool,
    ) -> Result<BatchResult, FileOpsError> {
        use tokio::fs;
        
        info!("Deleting {} files (permanent: {})", paths.len(), permanent);
        
        let mut deleted = Vec::new();
        let mut failed = Vec::new();
        
        for path in paths {
            let result = if path.is_dir() {
                if permanent {
                    fs::remove_dir_all(path).await
                } else {
                    // Move to trash (platform-specific)
                    Self::trash_file(path).await
                }
            } else {
                if permanent {
                    fs::remove_file(path).await
                } else {
                    Self::trash_file(path).await
                }
            };
            
            match result {
                Ok(_) => deleted.push(path.clone()),
                Err(e) => failed.push((path.clone(), e.to_string())),
            }
        }
        
        Ok(BatchResult { successful: deleted, failed })
    }
    
    /// Move file to trash (platform-specific)
    #[instrument]
    async fn trash_file(path: &Path) -> Result<(), FileOpsError> {
        // This is a simplified implementation
        // Full implementation would use platform-specific trash APIs
        // - Linux: ~/.local/share/Trash or gio trash
        // - macOS: ~/.Trash
        // - Windows: Recycle Bin via WinAPI
        
        let trash_dir = dirs::data_dir()
            .map(|d| d.join("Trash"))
            .ok_or_else(|| FileOpsError::Io(std::io::Error::new(
                std::io::ErrorKind::Other,
                "Could not determine trash directory"
            )))?;
        
        tokio::fs::create_dir_all(&trash_dir).await?;
        
        let dest = trash_dir.join(path.file_name().unwrap_or_default());
        tokio::fs::rename(path, dest).await?;
        
        Ok(())
    }
}

/// Result of batch operations
pub struct BatchResult {
    pub successful: Vec<PathBuf>,
    pub failed: Vec<(PathBuf, String)>,
}

