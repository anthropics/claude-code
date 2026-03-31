//! Advanced file operations module
//!
//! This module provides:
//! - Multi-file edit preview with diff view
//! - Interactive file browser with tree view
//! - Batch file operations (copy, move, delete)
//! - Search and replace across multiple files
//!
//! ## Usage
//!
//! ```rust
//! use claude_tools::file_ops::{MultiFileEditPreview, FileBrowser, BatchFileOps};
//!
//! // Create multi-file edit preview
//! let mut preview = MultiFileEditPreview::new();
//! preview.create_from_search_replace(
//!     &files,
//!     "old_pattern",
//!     "new_text",
//!     false, // use_regex
//!     true,  // case_sensitive
//! )?;
//!
//! // Create file browser
//! let mut browser = FileBrowser::new(PathBuf::from("."));
//!
//! // Batch copy files
//! let result = BatchFileOps::copy_files(&files, &dest, progress_tx).await?;
//! ```

pub mod advanced;
pub mod browser;

pub use advanced::{
    MultiFileEditPreview, 
    PreviewMode, 
    FileEdit, 
    DiffHunk, 
    DiffLine, 
    DiffLineType,
    PreviewAction,
    ApplyResult,
    FileOpsError,
    FileType,
};

pub use browser::{
    FileBrowser,
    BrowserAction,
    PreviewMode as BrowserPreviewMode,
    FileTreeItem,
    FileIcons,
    BatchFileOps,
    BatchResult,
};

