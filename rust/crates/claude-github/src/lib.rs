//! GitHub API client for repository operations, PRs, and issues
//!
//! Uses the GitHub REST API with full support for PR reviews, issues, and more.

use reqwest::{header, Client, Method, StatusCode};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::time::Duration;
use thiserror::Error;
use tracing::{debug, error, info, instrument};

/// GitHub API errors
#[derive(Debug, Error, Clone)]
pub enum GitHubError {
    #[error("API error: {status} - {message}")]
    Api { status: StatusCode, message: String },
    
    #[error("Authentication failed")]
    Authentication,
    
    #[error("Not found: {0}")]
    NotFound(String),
    
    #[error("Rate limited. Reset at: {reset_time}")]
    RateLimited { reset_time: String },
    
    #[error("Network error: {0}")]
    Network(String),
    
    #[error("Serialization error: {0}")]
    Serialization(String),
    
    #[error("Invalid input: {0}")]
    InvalidInput(String),
}

impl From<reqwest::Error> for GitHubError {
    fn from(e: reqwest::Error) -> Self {
        if e.is_timeout() {
            GitHubError::Network("Request timeout".to_string())
        } else if e.is_connect() {
            GitHubError::Network("Connection error".to_string())
        } else {
            GitHubError::Network(e.to_string())
        }
    }
}

impl From<serde_json::Error> for GitHubError {
    fn from(e: serde_json::Error) -> Self {
        GitHubError::Serialization(e.to_string())
    }
}

/// GitHub client configuration
#[derive(Debug, Clone)]
pub struct GitHubConfig {
    /// GitHub API token
    pub token: String,
    /// API base URL (for GitHub Enterprise)
    pub base_url: String,
    /// Request timeout
    pub timeout_secs: u64,
}

impl Default for GitHubConfig {
    fn default() -> Self {
        Self {
            token: String::new(),
            base_url: "https://api.github.com".to_string(),
            timeout_secs: 30,
        }
    }
}

impl GitHubConfig {
    /// Create with token from environment
    pub fn from_env() -> Option<Self> {
        let token = std::env::var("GITHUB_TOKEN").ok()?;
        Some(Self {
            token,
            ..Default::default()
        })
    }
    
    /// Create with explicit token
    pub fn with_token(token: impl Into<String>) -> Self {
        Self {
            token: token.into(),
            ..Default::default()
        }
    }
}

/// GitHub API client
#[derive(Debug, Clone)]
pub struct GitHubClient {
    client: Client,
    config: GitHubConfig,
}

impl GitHubClient {
    /// Create a new GitHub client
    pub fn new(config: GitHubConfig) -> Result<Self, GitHubError> {
        if config.token.is_empty() {
            return Err(GitHubError::Authentication);
        }
        
        let mut headers = header::HeaderMap::new();
        
        // Authorization header
        let auth_value = format!("Bearer {}", config.token);
        let mut auth_header = header::HeaderValue::from_str(&auth_value)
            .map_err(|e| GitHubError::InvalidInput(e.to_string()))?;
        auth_header.set_sensitive(true);
        headers.insert(header::AUTHORIZATION, auth_header);
        
        // Accept header for API v3
        headers.insert(
            header::ACCEPT,
            header::HeaderValue::from_static("application/vnd.github.v3+json")
        );
        
        // User-Agent (required by GitHub API)
        headers.insert(
            header::USER_AGENT,
            header::HeaderValue::from_static("claude-code-rust/1.0")
        );
        
        let client = Client::builder()
            .default_headers(headers)
            .timeout(Duration::from_secs(config.timeout_secs))
            .build()
            .map_err(|e| GitHubError::Network(e.to_string()))?;
        
        Ok(Self { client, config })
    }
    
    /// Get the authenticated user
    #[instrument(skip(self))]
    pub async fn get_user(&self) -> Result<User, GitHubError> {
        let url = format!("{}/user", self.config.base_url);
        self.get(&url).await
    }
    
    /// Get a repository
    #[instrument(skip(self))]
    pub async fn get_repo(&self, owner: &str, repo: &str) -> Result<Repository, GitHubError> {
        let url = format!("{}/repos/{}/{}", self.config.base_url, owner, repo);
        self.get(&url).await
    }
    
    // ========== Pull Request Operations ==========
    
    /// List pull requests
    #[instrument(skip(self))]
    pub async fn list_pulls(
        &self,
        owner: &str,
        repo: &str,
        state: Option<PullRequestState>,
    ) -> Result<Vec<PullRequest>, GitHubError> {
        let state = state.unwrap_or(PullRequestState::Open);
        let url = format!(
            "{}/repos/{}/{}/pulls?state={}",
            self.config.base_url, owner, repo, state.as_str()
        );
        self.get(&url).await
    }
    
    /// Get a single pull request
    #[instrument(skip(self))]
    pub async fn get_pull(&self, owner: &str, repo: &str, number: u64) -> Result<PullRequest, GitHubError> {
        let url = format!("{}/repos/{}/{}/pulls/{}", self.config.base_url, owner, repo, number);
        self.get(&url).await
    }
    
    /// Create a pull request
    #[instrument(skip(self, pr))]
    pub async fn create_pull(&self, owner: &str, repo: &str, pr: &CreatePullRequest) -> Result<PullRequest, GitHubError> {
        let url = format!("{}/repos/{}/{}/pulls", self.config.base_url, owner, repo);
        self.post(&url, pr).await
    }
    
    /// Update a pull request
    #[instrument(skip(self, pr))]
    pub async fn update_pull(
        &self,
        owner: &str,
        repo: &str,
        number: u64,
        pr: &UpdatePullRequest,
    ) -> Result<PullRequest, GitHubError> {
        let url = format!("{}/repos/{}/{}/pulls/{}", self.config.base_url, owner, repo, number);
        self.patch(&url, pr).await
    }
    
    /// List pull request files
    #[instrument(skip(self))]
    pub async fn list_pull_files(&self, owner: &str, repo: &str, number: u64) -> Result<Vec<PullRequestFile>, GitHubError> {
        let url = format!(
            "{}/repos/{}/{}/pulls/{}/files",
            self.config.base_url, owner, repo, number
        );
        self.get(&url).await
    }
    
    /// Get pull request diff
    #[instrument(skip(self))]
    pub async fn get_pull_diff(&self, owner: &str, repo: &str, number: u64) -> Result<String, GitHubError> {
        let url = format!(
            "{}/repos/{}/{}/pulls/{}",
            self.config.base_url, owner, repo, number
        );
        
        let response = self.client
            .request(Method::GET, &url)
            .header(header::ACCEPT, "application/vnd.github.v3.diff")
            .send()
            .await?;
        
        self.handle_response_status(&response).await?;
        
        response.text().await.map_err(|e| GitHubError::Network(e.to_string()))
    }
    
    // ========== PR Review Operations ==========
    
    /// List pull request reviews
    #[instrument(skip(self))]
    pub async fn list_reviews(&self, owner: &str, repo: &str, number: u64) -> Result<Vec<PullRequestReview>, GitHubError> {
        let url = format!(
            "{}/repos/{}/{}/pulls/{}/reviews",
            self.config.base_url, owner, repo, number
        );
        self.get(&url).await
    }
    
    /// Create a pull request review
    #[instrument(skip(self, review))]
    pub async fn create_review(
        &self,
        owner: &str,
        repo: &str,
        number: u64,
        review: &CreateReview,
    ) -> Result<PullRequestReview, GitHubError> {
        let url = format!(
            "{}/repos/{}/{}/pulls/{}/reviews",
            self.config.base_url, owner, repo, number
        );
        self.post(&url, review).await
    }
    
    /// Create a review comment
    #[instrument(skip(self, comment))]
    pub async fn create_review_comment(
        &self,
        owner: &str,
        repo: &str,
        number: u64,
        comment: &CreateReviewComment,
    ) -> Result<ReviewComment, GitHubError> {
        let url = format!(
            "{}/repos/{}/{}/pulls/{}/comments",
            self.config.base_url, owner, repo, number
        );
        self.post(&url, comment).await
    }
    
    /// List review comments
    #[instrument(skip(self))]
    pub async fn list_review_comments(
        &self,
        owner: &str,
        repo: &str,
        number: u64,
    ) -> Result<Vec<ReviewComment>, GitHubError> {
        let url = format!(
            "{}/repos/{}/{}/pulls/{}/comments",
            self.config.base_url, owner, repo, number
        );
        self.get(&url).await
    }
    
    // ========== Issue Operations ==========
    
    /// List issues
    #[instrument(skip(self))]
    pub async fn list_issues(
        &self,
        owner: &str,
        repo: &str,
        state: Option<IssueState>,
    ) -> Result<Vec<Issue>, GitHubError> {
        let state = state.unwrap_or(IssueState::Open);
        let url = format!(
            "{}/repos/{}/{}/issues?state={}",
            self.config.base_url, owner, repo, state.as_str()
        );
        self.get(&url).await
    }
    
    /// Get a single issue
    #[instrument(skip(self))]
    pub async fn get_issue(&self, owner: &str, repo: &str, number: u64) -> Result<Issue, GitHubError> {
        let url = format!("{}/repos/{}/{}/issues/{}", self.config.base_url, owner, repo, number);
        self.get(&url).await
    }
    
    /// Create an issue
    #[instrument(skip(self, issue))]
    pub async fn create_issue(&self, owner: &str, repo: &str, issue: &CreateIssue) -> Result<Issue, GitHubError> {
        let url = format!("{}/repos/{}/{}/issues", self.config.base_url, owner, repo);
        self.post(&url, issue).await
    }
    
    /// Update an issue
    #[instrument(skip(self, issue))]
    pub async fn update_issue(
        &self,
        owner: &str,
        repo: &str,
        number: u64,
        issue: &UpdateIssue,
    ) -> Result<Issue, GitHubError> {
        let url = format!("{}/repos/{}/{}/issues/{}", self.config.base_url, owner, repo, number);
        self.patch(&url, issue).await
    }
    
    /// List issue comments
    #[instrument(skip(self))]
    pub async fn list_issue_comments(&self, owner: &str, repo: &str, number: u64) -> Result<Vec<IssueComment>, GitHubError> {
        let url = format!(
            "{}/repos/{}/{}/issues/{}/comments",
            self.config.base_url, owner, repo, number
        );
        self.get(&url).await
    }
    
    /// Create an issue comment
    #[instrument(skip(self, comment))]
    pub async fn create_issue_comment(
        &self,
        owner: &str,
        repo: &str,
        number: u64,
        comment: &CreateComment,
    ) -> Result<IssueComment, GitHubError> {
        let url = format!(
            "{}/repos/{}/{}/issues/{}/comments",
            self.config.base_url, owner, repo, number
        );
        self.post(&url, comment).await
    }
    
    // ========== Repository Contents ==========
    
    /// Get file contents
    #[instrument(skip(self))]
    pub async fn get_contents(
        &self,
        owner: &str,
        repo: &str,
        path: &str,
        ref_: Option<&str>,
    ) -> Result<Content, GitHubError> {
        let mut url = format!(
            "{}/repos/{}/{}/contents/{}",
            self.config.base_url, owner, repo, path
        );
        
        if let Some(r) = ref_ {
            url.push_str(&format!("?ref={}", r));
        }
        
        self.get(&url).await
    }
    
    /// Create or update file contents
    #[instrument(skip(self, content))]
    pub async fn create_or_update_file(
        &self,
        owner: &str,
        repo: &str,
        path: &str,
        content: &CreateOrUpdateFile,
    ) -> Result<FileCommit, GitHubError> {
        let url = format!(
            "{}/repos/{}/{}/contents/{}",
            self.config.base_url, owner, repo, path
        );
        self.put(&url, content).await
    }
    
    // ========== Search Operations ==========
    
    /// Search code
    #[instrument(skip(self))]
    pub async fn search_code(&self, query: &str) -> Result<SearchResult<CodeSearchItem>, GitHubError> {
        let encoded_query = urlencoding::encode(query);
        let url = format!(
            "{}/search/code?q={}",
            self.config.base_url, encoded_query
        );
        self.get(&url).await
    }
    
    /// Search issues
    #[instrument(skip(self))]
    pub async fn search_issues(&self, query: &str) -> Result<SearchResult<Issue>, GitHubError> {
        let encoded_query = urlencoding::encode(query);
        let url = format!(
            "{}/search/issues?q={}",
            self.config.base_url, encoded_query
        );
        self.get(&url).await
    }
    
    // ========== Helper Methods ==========
    
    /// Generic GET request
    async fn get<T: for<'de> Deserialize<'de>>(&self, url: &str) -> Result<T, GitHubError> {
        debug!("GitHub API GET: {}", url);
        
        let response = self.client
            .get(url)
            .send()
            .await?;
        
        self.handle_response_status(&response).await?;
        
        let data = response.json::<T>().await?;
        Ok(data)
    }
    
    /// Generic POST request
    async fn post<T: for<'de> Deserialize<'de>, B: Serialize>(
        &self,
        url: &str,
        body: &B,
    ) -> Result<T, GitHubError> {
        debug!("GitHub API POST: {}", url);
        
        let response = self.client
            .post(url)
            .json(body)
            .send()
            .await?;
        
        self.handle_response_status(&response).await?;
        
        let data = response.json::<T>().await?;
        Ok(data)
    }
    
    /// Generic PATCH request
    async fn patch<T: for<'de> Deserialize<'de>, B: Serialize>(
        &self,
        url: &str,
        body: &B,
    ) -> Result<T, GitHubError> {
        debug!("GitHub API PATCH: {}", url);
        
        let response = self.client
            .patch(url)
            .json(body)
            .send()
            .await?;
        
        self.handle_response_status(&response).await?;
        
        let data = response.json::<T>().await?;
        Ok(data)
    }
    
    /// Generic PUT request
    async fn put<T: for<'de> Deserialize<'de>, B: Serialize>(
        &self,
        url: &str,
        body: &B,
    ) -> Result<T, GitHubError> {
        debug!("GitHub API PUT: {}", url);
        
        let response = self.client
            .put(url)
            .json(body)
            .send()
            .await?;
        
        self.handle_response_status(&response).await?;
        
        let data = response.json::<T>().await?;
        Ok(data)
    }
    
    /// Handle response status codes
    async fn handle_response_status(&self, response: &reqwest::Response) -> Result<(), GitHubError> {
        match response.status() {
            StatusCode::OK | StatusCode::CREATED | StatusCode::ACCEPTED | StatusCode::NO_CONTENT => Ok(()),
            StatusCode::UNAUTHORIZED => Err(GitHubError::Authentication),
            StatusCode::NOT_FOUND => Err(GitHubError::NotFound(response.url().to_string())),
            StatusCode::FORBIDDEN => {
                // Check for rate limiting
                if let Some(reset) = response.headers().get("X-RateLimit-Reset") {
                    let reset_time = reset.to_str().unwrap_or("unknown").to_string();
                    Err(GitHubError::RateLimited { reset_time })
                } else {
                    let body = response.text().await.unwrap_or_default();
                    Err(GitHubError::Api {
                        status: StatusCode::FORBIDDEN,
                        message: body,
                    })
                }
            }
            status if status.is_client_error() || status.is_server_error() => {
                let body = response.text().await.unwrap_or_default();
                Err(GitHubError::Api { status, message: body })
            }
            _ => Ok(()),
        }
    }
}

// ========== Data Models ==========

/// GitHub user
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub login: String,
    pub id: u64,
    pub node_id: String,
    pub avatar_url: String,
    pub html_url: String,
    #[serde(rename = "type")]
    pub user_type: String,
    pub name: Option<String>,
    pub email: Option<String>,
    pub bio: Option<String>,
}

/// GitHub repository
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Repository {
    pub id: u64,
    pub node_id: String,
    pub name: String,
    pub full_name: String,
    pub owner: User,
    pub private: bool,
    pub html_url: String,
    pub description: Option<String>,
    pub fork: bool,
    pub url: String,
    pub default_branch: String,
}

/// Pull request state
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PullRequestState {
    Open,
    Closed,
    All,
}

impl PullRequestState {
    fn as_str(&self) -> &'static str {
        match self {
            Self::Open => "open",
            Self::Closed => "closed",
            Self::All => "all",
        }
    }
}

/// Pull request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PullRequest {
    pub id: u64,
    pub node_id: String,
    pub number: u64,
    pub state: String,
    pub locked: bool,
    pub title: String,
    pub user: User,
    pub body: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub closed_at: Option<String>,
    pub merged_at: Option<String>,
    pub merge_commit_sha: Option<String>,
    pub assignee: Option<User>,
    pub assignees: Vec<User>,
    pub head: BranchRef,
    pub base: BranchRef,
    pub draft: bool,
    pub merged: bool,
    pub mergeable: Option<bool>,
    pub rebaseable: Option<bool>,
    pub mergeable_state: Option<String>,
    pub comments: u64,
    pub review_comments: u64,
    pub commits: u64,
    pub additions: u64,
    pub deletions: u64,
    pub changed_files: u64,
}

/// Branch reference
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BranchRef {
    pub label: String,
    #[serde(rename = "ref")]
    pub ref_: String,
    pub sha: String,
    pub user: User,
    pub repo: Repository,
}

/// Pull request file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PullRequestFile {
    pub sha: String,
    pub filename: String,
    pub status: String,
    pub additions: u64,
    pub deletions: u64,
    pub changes: u64,
    pub patch: Option<String>,
    pub previous_filename: Option<String>,
}

/// Create pull request body
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePullRequest {
    pub title: String,
    pub body: Option<String>,
    pub head: String,
    #[serde(rename = "base")]
    pub base_branch: String,
    pub draft: Option<bool>,
}

/// Update pull request body
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct UpdatePullRequest {
    pub title: Option<String>,
    pub body: Option<String>,
    pub state: Option<String>,
    pub base: Option<String>,
}

/// Pull request review
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PullRequestReview {
    pub id: u64,
    pub node_id: String,
    pub user: User,
    pub body: Option<String>,
    pub state: String,
    pub html_url: String,
    pub submitted_at: String,
    pub commit_id: String,
}

/// Create review body
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateReview {
    pub commit_id: Option<String>,
    pub body: Option<String>,
    pub event: Option<String>, // APPROVE, REQUEST_CHANGES, COMMENT
    pub comments: Option<Vec<ReviewCommentInput>>,
}

/// Review comment input
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReviewCommentInput {
    pub path: String,
    pub position: Option<u64>,
    pub body: String,
    pub line: Option<u64>,
    pub side: Option<String>, // LEFT, RIGHT
}

/// Review comment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReviewComment {
    pub id: u64,
    pub node_id: String,
    pub pull_request_review_id: Option<u64>,
    pub diff_hunk: String,
    pub path: String,
    pub position: Option<u64>,
    pub original_position: u64,
    pub commit_id: String,
    pub original_commit_id: String,
    pub user: User,
    pub body: String,
    pub created_at: String,
    pub updated_at: String,
    pub html_url: String,
}

/// Create review comment body
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateReviewComment {
    pub body: String,
    pub commit_id: String,
    pub path: String,
    pub position: Option<u64>,
    pub side: Option<String>,
    pub line: Option<u64>,
}

/// Issue state
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum IssueState {
    Open,
    Closed,
    All,
}

impl IssueState {
    fn as_str(&self) -> &'static str {
        match self {
            Self::Open => "open",
            Self::Closed => "closed",
            Self::All => "all",
        }
    }
}

/// Issue
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Issue {
    pub id: u64,
    pub node_id: String,
    pub number: u64,
    pub state: String,
    pub locked: bool,
    pub title: String,
    pub user: User,
    pub body: Option<String>,
    pub labels: Vec<Label>,
    pub assignee: Option<User>,
    pub assignees: Vec<User>,
    pub milestone: Option<Milestone>,
    pub comments: u64,
    pub created_at: String,
    pub updated_at: String,
    pub closed_at: Option<String>,
    pub html_url: String,
}

/// Create issue body
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateIssue {
    pub title: String,
    pub body: Option<String>,
    pub labels: Option<Vec<String>>,
    pub assignees: Option<Vec<String>>,
}

/// Update issue body
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct UpdateIssue {
    pub title: Option<String>,
    pub body: Option<String>,
    pub state: Option<String>,
    pub labels: Option<Vec<String>>,
    pub assignees: Option<Vec<String>>,
}

/// Label
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Label {
    pub id: u64,
    pub node_id: String,
    pub url: String,
    pub name: String,
    pub color: String,
    pub description: Option<String>,
    pub default: bool,
}

/// Milestone
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Milestone {
    pub id: u64,
    pub node_id: String,
    pub number: u64,
    pub title: String,
    pub description: Option<String>,
    pub state: String,
    pub created_at: String,
    pub updated_at: String,
    pub due_on: Option<String>,
    pub closed_at: Option<String>,
}

/// Issue comment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IssueComment {
    pub id: u64,
    pub node_id: String,
    pub user: User,
    pub body: String,
    pub created_at: String,
    pub updated_at: String,
    pub html_url: String,
}

/// Create comment body
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateComment {
    pub body: String,
}

/// Content (file/directory)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum Content {
    #[serde(rename = "file")]
    File { content: String, encoding: String, size: u64, name: String, path: String },
    #[serde(rename = "dir")]
    Dir { entries: Vec<ContentEntry> },
    #[serde(rename = "symlink")]
    Symlink { target: String },
    #[serde(rename = "submodule")]
    Submodule { submodule_git_url: String },
}

/// Content entry (for directories)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContentEntry {
    #[serde(rename = "type")]
    pub entry_type: String,
    pub size: u64,
    pub name: String,
    pub path: String,
    pub sha: String,
    pub url: String,
    pub html_url: String,
    pub git_url: String,
    pub download_url: Option<String>,
}

/// Create or update file body
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateOrUpdateFile {
    pub message: String,
    pub content: String, // base64 encoded
    pub sha: Option<String>, // required for updates
    pub branch: Option<String>,
    pub committer: Option<GitAuthor>,
    pub author: Option<GitAuthor>,
}

/// Git author
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitAuthor {
    pub name: String,
    pub email: String,
    pub date: Option<String>,
}

/// File commit response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileCommit {
    pub content: Content,
    pub commit: CommitInfo,
}

/// Commit info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitInfo {
    pub sha: String,
    pub node_id: String,
    pub url: String,
    pub html_url: String,
    pub message: String,
    pub author: GitCommitUser,
    pub committer: GitCommitUser,
}

/// Git commit user
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitCommitUser {
    pub name: String,
    pub email: String,
    pub date: String,
}

/// Search result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult<T> {
    pub total_count: u64,
    pub incomplete_results: bool,
    pub items: Vec<T>,
}

/// Code search item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeSearchItem {
    pub name: String,
    pub path: String,
    pub sha: String,
    pub url: String,
    pub git_url: String,
    pub html_url: String,
    pub repository: Repository,
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_github_config_from_env() {
        std::env::set_var("GITHUB_TOKEN", "test-token");
        let config = GitHubConfig::from_env();
        assert!(config.is_some());
        assert_eq!(config.unwrap().token, "test-token");
    }
    
    #[test]
    fn test_pull_request_state() {
        assert_eq!(PullRequestState::Open.as_str(), "open");
        assert_eq!(PullRequestState::Closed.as_str(), "closed");
        assert_eq!(PullRequestState::All.as_str(), "all");
    }
    
    #[test]
    fn test_serialize_create_pull_request() {
        let pr = CreatePullRequest {
            title: "Test PR".to_string(),
            body: Some("Description".to_string()),
            head: "feature-branch".to_string(),
            base_branch: "main".to_string(),
            draft: Some(false),
        };
        
        let json = serde_json::to_string(&pr).unwrap();
        assert!(json.contains("Test PR"));
        assert!(json.contains("feature-branch"));
    }
}

