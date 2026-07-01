//! Git operations for repository management
//!
//! Provides high-level abstractions over git2 for common operations
//! used by Claude Code. Includes interactive staging, merge conflict
//! resolution, and branch visualization.

use git2::{Repository, Signature, StatusOptions, DiffOptions};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use thiserror::Error;
use tracing::{debug, error, info, instrument};

// Re-export submodules
pub mod interactive;
pub mod conflicts;
pub mod graph;

pub use interactive::{InteractiveStaging, StagingAction, StageOperation, StagingViewMode};
pub use conflicts::{ConflictResolver, ResolutionAction, ConflictResolution};
pub use graph::{BranchGraph, GraphAction, BranchComparison};

/// Git operation errors
#[derive(Debug, Error)]
pub enum GitError {
    #[error("Git error: {0}")]
    Git(#[from] git2::Error),
    
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("Not a git repository: {0}")]
    NotARepo(PathBuf),
    
    #[error("Path not in repository: {0}")]
    NotInRepo(PathBuf),
    
    #[error("No changes to commit")]
    NoChanges,
    
    #[error("Merge conflict")]
    MergeConflict,
    
    #[error("Branch not found: {0}")]
    BranchNotFound(String),
    
    #[error("Invalid operation: {0}")]
    Invalid(String),
}

/// Git repository wrapper
pub struct GitRepo {
    repo: Repository,
    path: PathBuf,
}

impl GitRepo {
    /// Open a repository at a path
    pub fn open(path: impl AsRef<Path>) -> Result<Self, GitError> {
        let path = path.as_ref();
        
        let repo = Repository::open(path)
            .map_err(|e| GitError::NotARepo(path.to_path_buf()))?;
        
        let repo_path = repo.workdir()
            .or_else(|| repo.path().parent())
            .map(|p| p.to_path_buf())
            .unwrap_or_else(|| path.to_path_buf());
        
        Ok(Self {
            repo,
            path: repo_path,
        })
    }
    
    /// Initialize a new repository
    pub fn init(path: impl AsRef<Path>) -> Result<Self, GitError> {
        let repo = Repository::init(path)?;
        let path = repo.workdir()
            .map(|p| p.to_path_buf())
            .unwrap_or_default();
        
        Ok(Self { repo, path })
    }
    
    /// Clone a repository
    #[instrument]
    pub fn clone(url: &str, path: impl AsRef<Path>) -> Result<Self, GitError> {
        info!("Cloning repository from {} to {:?}", url, path.as_ref());
        
        let repo = Repository::clone(url, path.as_ref())?;
        let repo_path = repo.workdir()
            .map(|p| p.to_path_buf())
            .unwrap_or_default();
        
        info!("Successfully cloned to {:?}", repo_path);
        
        Ok(Self { repo, path: repo_path })
    }
    
    /// Get repository status
    #[instrument(skip(self))]
    pub fn status(&self) -> Result<GitStatus, GitError> {
        let mut opts = StatusOptions::new();
        opts.include_untracked(true)
            .include_ignored(false)
            .renames_head_to_index(true)
            .renames_index_to_workdir(true);
        
        let statuses = self.repo.statuses(Some(&mut opts))?;
        
        let mut staged = Vec::new();
        let mut unstaged = Vec::new();
        let mut untracked = Vec::new();
        let mut conflicted = Vec::new();
        
        for entry in statuses.iter() {
            let path = entry.path().map(|p| p.to_string()).unwrap_or_default();
            let status = entry.status();
            
            if status.is_conflicted() {
                conflicted.push(path);
            } else if status.is_index_new() || status.is_index_modified() || status.is_index_deleted() {
                staged.push(path);
            } else if status.is_wt_new() {
                untracked.push(path);
            } else if status.is_wt_modified() || status.is_wt_deleted() {
                unstaged.push(path);
            }
        }
        
        Ok(GitStatus {
            staged,
            unstaged,
            untracked,
            conflicted,
            ahead: self.ahead_behind()?.0,
            behind: self.ahead_behind()?.1,
        })
    }
    
    /// Get ahead/behind count
    fn ahead_behind(&self) -> Result<(usize, usize), GitError> {
        let head = self.repo.head().ok();
        let branch = match head {
            Some(h) if h.is_branch() => h,
            _ => return Ok((0, 0)),
        };
        
        let local = branch.target();
        let upstream = branch.upstream().ok().and_then(|u| u.target());
        
        match (local, upstream) {
            (Some(local), Some(upstream)) => {
                let (ahead, behind) = self.repo.graph_ahead_behind(local, upstream)?;
                Ok((ahead, behind))
            }
            _ => Ok((0, 0)),
        }
    }
    
    /// Stage files
    #[instrument(skip(self))]
    pub fn add(&self, paths: &[impl AsRef<Path>]) -> Result<(), GitError> {
        let mut index = self.repo.index()?;
        
        for path in paths {
            let path = path.as_ref();
            let relative = self.make_relative(path)?;
            index.add_path(&relative)?;
            debug!("Staged: {:?}", relative);
        }
        
        index.write()?;
        Ok(())
    }
    
    /// Stage all changes
    #[instrument(skip(self))]
    pub fn add_all(&self) -> Result<(), GitError> {
        let mut index = self.repo.index()?;
        index.add_all(&["."], git2::IndexAddOption::DEFAULT, None)?;
        index.write()?;
        
        info!("Staged all changes");
        Ok(())
    }
    
    /// Unstage files
    #[instrument(skip(self))]
    pub fn unstage(&self, paths: &[impl AsRef<Path>]) -> Result<(), GitError> {
        let head = self.repo.head().ok();
        let head_tree = head.and_then(|h| h.peel_to_tree().ok());
        
        let mut index = self.repo.index()?;
        
        for path in paths {
            let path = path.as_ref();
            let relative = self.make_relative(path)?;
            
            if let Some(ref tree) = head_tree {
                index.remove_path(&relative)?;
                if let Some(entry) = tree.get_path(&relative).ok() {
                    index.add(&entry)?;
                }
            } else {
                index.remove_path(&relative)?;
            }
            
            debug!("Unstaged: {:?}", relative);
        }
        
        index.write()?;
        Ok(())
    }
    
    /// Commit staged changes
    #[instrument(skip(self))]
    pub fn commit(&self, message: &str, author: Option<(&str, &str)>) -> Result<git2::Oid, GitError> {
        let mut index = self.repo.index()?;
        let tree_id = index.write_tree()?;
        
        if tree_id == self.repo.head()?.peel_to_tree()?.id() {
            return Err(GitError::NoChanges);
        }
        
        let tree = self.repo.find_tree(tree_id)?;
        let parent = self.repo.head()?.peel_to_commit()?;
        
        let sig = match author {
            Some((name, email)) => Signature::now(name, email)?,
            None => self.repo.signature()?,
        };
        
        let oid = self.repo.commit(
            Some("HEAD"),
            &sig,
            &sig,
            message,
            &tree,
            &[&parent],
        )?;
        
        info!("Created commit: {}", oid);
        
        Ok(oid)
    }
    
    /// Get commit log
    #[instrument(skip(self))]
    pub fn log(&self, max_count: usize) -> Result<Vec<CommitInfo>, GitError> {
        let mut revwalk = self.repo.revwalk()?;
        revwalk.push_head()?;
        
        let mut commits = Vec::new();
        
        for (i, oid) in revwalk.enumerate() {
            if i >= max_count {
                break;
            }
            
            let oid = oid?;
            let commit = self.repo.find_commit(oid)?;
            
            commits.push(CommitInfo {
                id: oid.to_string(),
                message: commit.message().unwrap_or("").to_string(),
                author: commit.author().name().unwrap_or("Unknown").to_string(),
                email: commit.author().email().unwrap_or("").to_string(),
                time: commit.time().seconds(),
            });
        }
        
        Ok(commits)
    }
    
    /// Show diff for a file
    #[instrument(skip(self))]
    pub fn diff(&self, path: impl AsRef<Path>) -> Result<String, GitError> {
        let relative = self.make_relative(path.as_ref())?;
        
        let head = self.repo.head()?;
        let tree = head.peel_to_tree()?;
        
        let mut opts = DiffOptions::new();
        opts.pathspec(relative.to_string_lossy().as_ref());
        
        let diff = self.repo.diff_tree_to_workdir_with_index(
            Some(&tree),
            Some(&mut opts),
        )?;
        
        let mut result = String::new();
        diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
            result.push_str(std::str::from_utf8(line.content()).unwrap_or(""));
            true
        })?;
        
        Ok(result)
    }
    
    /// Get current branch name
    pub fn current_branch(&self) -> Result<Option<String>, GitError> {
        let head = self.repo.head().ok();
        
        Ok(head.and_then(|h| {
            h.shorthand().map(|s| s.to_string())
        }))
    }
    
    /// List branches
    pub fn branches(&self) -> Result<Vec<BranchInfo>, GitError> {
        let branches = self.repo.branches(Some(git2::BranchType::Local))?;
        
        let mut result = Vec::new();
        
        for (branch, _) in branches {
            let name = branch.name()?.unwrap_or("unnamed").to_string();
            let is_head = branch.is_head();
            
            result.push(BranchInfo {
                name,
                is_current: is_head,
            });
        }
        
        Ok(result)
    }
    
    /// Create and checkout a new branch
    #[instrument(skip(self))]
    pub fn checkout_branch(&self, name: &str, create: bool) -> Result<(), GitError> {
        let head = self.repo.head()?;
        let commit = head.peel_to_commit()?;
        
        if create {
            let _branch = self.repo.branch(name, &commit, false)?;
            info!("Created branch: {}", name);
        }
        
        let (object, reference) = self.repo.revparse_ext(name)?;
        
        self.repo.checkout_tree(&object, None)?;
        
        if let Some(ref_name) = reference {
            self.repo.set_head(ref_name.name().ok_or_else(|| {
                GitError::Invalid("Invalid reference name".to_string())
            })?)?;
        } else {
            self.repo.set_head_detached(object.id())?;
        }
        
        info!("Checked out: {}", name);
        Ok(())
    }
    
    /// Fetch from remote
    #[instrument(skip(self))]
    pub fn fetch(&self, remote_name: Option<&str>) -> Result<(), GitError> {
        let remote_name = remote_name.unwrap_or("origin");
        let mut remote = self.repo.find_remote(remote_name)?;
        
        info!("Fetching from: {}", remote_name);
        
        remote.fetch(&[] as &[&str], None, None)?;
        
        info!("Fetch complete");
        Ok(())
    }
    
    /// Push to remote
    #[instrument(skip(self))]
    pub fn push(&self, remote_name: Option<&str>, branch: Option<&str>) -> Result<(), GitError> {
        let remote_name = remote_name.unwrap_or("origin");
        let mut remote = self.repo.find_remote(remote_name)?;
        
        let branch = match branch {
            Some(b) => b.to_string(),
            None => self.current_branch()?.ok_or(GitError::NotARepo(self.path.clone()))?,
        };
        
        let refspec = format!("refs/heads/{0}:refs/heads/{0}", branch);
        
        info!("Pushing {} to {}", branch, remote_name);
        
        remote.push(&[&refspec], None)?;
        
        info!("Push complete");
        Ok(())
    }
    
    /// Get repository path
    pub fn path(&self) -> &Path {
        &self.path
    }
    
    /// Get the underlying git2 repository
    pub fn inner(&self) -> &Repository {
        &self.repo
    }
    
    /// Make a path relative to the repo
    fn make_relative(&self, path: &Path) -> Result<PathBuf, GitError> {
        if path.is_absolute() {
            path.strip_prefix(&self.path)
                .map(|p| p.to_path_buf())
                .map_err(|_| GitError::NotInRepo(path.to_path_buf()))
        } else {
            Ok(path.to_path_buf())
        }
    }
}

/// Repository status
#[derive(Debug, Clone, Default)]
pub struct GitStatus {
    pub staged: Vec<String>,
    pub unstaged: Vec<String>,
    pub untracked: Vec<String>,
    pub conflicted: Vec<String>,
    pub ahead: usize,
    pub behind: usize,
}

impl GitStatus {
    /// Check if working directory is clean
    pub fn is_clean(&self) -> bool {
        self.staged.is_empty()
            && self.unstaged.is_empty()
            && self.untracked.is_empty()
            && self.conflicted.is_empty()
    }
    
    /// Check if there are any changes to commit
    pub fn has_changes(&self) -> bool {
        !self.staged.is_empty() || !self.conflicted.is_empty()
    }
}

/// Commit information
#[derive(Debug, Clone)]
pub struct CommitInfo {
    pub id: String,
    pub message: String,
    pub author: String,
    pub email: String,
    pub time: i64,
}

/// Branch information
#[derive(Debug, Clone)]
pub struct BranchInfo {
    pub name: String,
    pub is_current: bool,
}

/// Find repository root for a path
pub fn find_repo_root(path: impl AsRef<Path>) -> Option<PathBuf> {
    let path = path.as_ref();
    
    let mut current = if path.is_file() {
        path.parent()?
    } else {
        path
    };
    
    loop {
        if current.join(".git").is_dir() {
            return Some(current.to_path_buf());
        }
        
        current = current.parent()?;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    
    #[test]
    fn test_init_repo() {
        let temp = TempDir::new().unwrap();
        let repo = GitRepo::init(temp.path()).unwrap();
        
        assert!(temp.path().join(".git").exists());
        assert_eq!(repo.path(), temp.path());
    }
    
    #[test]
    fn test_open_repo() {
        let temp = TempDir::new().unwrap();
        GitRepo::init(temp.path()).unwrap();
        
        let repo = GitRepo::open(temp.path()).unwrap();
        assert_eq!(repo.path(), temp.path());
    }
    
    #[test]
    fn test_find_repo_root() {
        let temp = TempDir::new().unwrap();
        let subdir = temp.path().join("a").join("b");
        std::fs::create_dir_all(&subdir).unwrap();
        
        GitRepo::init(temp.path()).unwrap();
        
        let root = find_repo_root(&subdir).unwrap();
        assert_eq!(root, temp.path());
    }
}


