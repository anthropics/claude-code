//! Cloud and authentication module
//!
//! Provides:
//! - OAuth integration (GitHub, GitLab, Google)
//! - Session history sync
//! - Team collaboration features
//! - Cloud storage integration

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::time::{Duration, SystemTime};
use tokio::sync::mpsc;
use tracing::{debug, error, info, instrument, warn};
use thiserror::Error;

/// Cloud/auth errors
#[derive(Debug, Error)]
pub enum CloudError {
    #[error("Authentication failed: {0}")]
    AuthFailed(String),
    
    #[error("Token expired")]
    TokenExpired,
    
    #[error("Network error: {0}")]
    Network(String),
    
    #[error("API error: {status} - {message}")]
    ApiError { status: u16, message: String },
    
    #[error("Invalid credentials")]
    InvalidCredentials,
    
    #[error("Sync conflict: {0}")]
    SyncConflict(String),
    
    #[error("Not authenticated")]
    NotAuthenticated,
    
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

/// OAuth providers
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum OAuthProvider {
    GitHub,
    GitLab,
    Google,
    Microsoft,
    Custom(String),
}

impl OAuthProvider {
    pub fn name(&self) -> &str {
        match self {
            OAuthProvider::GitHub => "GitHub",
            OAuthProvider::GitLab => "GitLab",
            OAuthProvider::Google => "Google",
            OAuthProvider::Microsoft => "Microsoft",
            OAuthProvider::Custom(s) => s.as_str(),
        }
    }
    
    pub fn authorize_url(&self) -> String {
        match self {
            OAuthProvider::GitHub => "https://github.com/login/oauth/authorize".to_string(),
            OAuthProvider::GitLab => "https://gitlab.com/oauth/authorize".to_string(),
            OAuthProvider::Google => "https://accounts.google.com/o/oauth2/v2/auth".to_string(),
            OAuthProvider::Microsoft => "https://login.microsoftonline.com/common/oauth2/v2.0/authorize".to_string(),
            OAuthProvider::Custom(_) => String::new(),
        }
    }
    
    pub fn token_url(&self) -> String {
        match self {
            OAuthProvider::GitHub => "https://github.com/login/oauth/access_token".to_string(),
            OAuthProvider::GitLab => "https://gitlab.com/oauth/token".to_string(),
            OAuthProvider::Google => "https://oauth2.googleapis.com/token".to_string(),
            OAuthProvider::Microsoft => "https://login.microsoftonline.com/common/oauth2/v2.0/token".to_string(),
            OAuthProvider::Custom(_) => String::new(),
        }
    }
}

/// OAuth authentication flow
pub struct OAuthFlow {
    provider: OAuthProvider,
    client_id: String,
    client_secret: String,
    redirect_uri: String,
    scopes: Vec<String>,
    state: String,
}

impl OAuthFlow {
    /// Create new OAuth flow
    pub fn new(
        provider: OAuthProvider,
        client_id: String,
        client_secret: String,
        redirect_uri: String,
        scopes: Vec<String>,
    ) -> Self {
        let state = Self::generate_state();
        
        Self {
            provider,
            client_id,
            client_secret,
            redirect_uri,
            scopes,
            state,
        }
    }
    
    /// Generate random state parameter
    fn generate_state() -> String {
        use rand::Rng;
        let mut rng = rand::thread_rng();
        (0..32)
            .map(|_| rng.sample(rand::distributions::Alphanumeric) as char)
            .collect()
    }
    
    /// Get authorization URL
    pub fn get_authorize_url(&self) -> String {
        let scope = self.scopes.join(" ");
        
        format!(
            "{}?client_id={}&redirect_uri={}&scope={}&state={}&response_type=code",
            self.provider.authorize_url(),
            urlencoding::encode(&self.client_id),
            urlencoding::encode(&self.redirect_uri),
            urlencoding::encode(&scope),
            urlencoding::encode(&self.state)
        )
    }
    
    /// Exchange code for token
    pub async fn exchange_code(&self, code: &str, state: &str) -> Result<AuthToken, CloudError> {
        // Verify state
        if state != self.state {
            return Err(CloudError::AuthFailed("Invalid state parameter".to_string()));
        }
        
        let client = reqwest::Client::new();
        
        let params = [
            ("client_id", self.client_id.as_str()),
            ("client_secret", self.client_secret.as_str()),
            ("code", code),
            ("redirect_uri", self.redirect_uri.as_str()),
            ("grant_type", "authorization_code"),
        ];
        
        let response = client
            .post(self.provider.token_url())
            .form(&params)
            .header("Accept", "application/json")
            .send()
            .await
            .map_err(|e| CloudError::Network(e.to_string()))?;
        
        let status = response.status();
        let body = response.text().await
            .map_err(|e| CloudError::Network(e.to_string()))?;
        
        if !status.is_success() {
            return Err(CloudError::ApiError {
                status: status.as_u16(),
                message: body,
            });
        }
        
        // Parse token response
        let token_data: serde_json::Value = serde_json::from_str(&body)
            .map_err(|e| CloudError::AuthFailed(format!("Failed to parse token: {}", e)))?;
        
        let access_token = token_data["access_token"]
            .as_str()
            .ok_or_else(|| CloudError::AuthFailed("No access token in response".to_string()))?;
        
        let refresh_token = token_data["refresh_token"].as_str().map(|s| s.to_string());
        
        let expires_in = token_data["expires_in"]
            .as_i64()
            .map(|s| Duration::from_secs(s as u64))
            .unwrap_or(Duration::from_secs(3600));
        
        Ok(AuthToken {
            provider: self.provider.clone(),
            access_token: access_token.to_string(),
            refresh_token,
            expires_at: SystemTime::now() + expires_in,
            scopes: self.scopes.clone(),
        })
    }
}

/// Authentication token
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AuthToken {
    pub provider: OAuthProvider,
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: SystemTime,
    pub scopes: Vec<String>,
}

impl AuthToken {
    /// Check if token is expired
    pub fn is_expired(&self) -> bool {
        SystemTime::now() >= self.expires_at
    }
    
    /// Refresh the token if possible
    pub async fn refresh(&mut self, client_secret: &str) -> Result<(), CloudError> {
        if let Some(ref refresh) = self.refresh_token {
            // Implement refresh flow
            info!("Refreshing token for {}", self.provider.name());
            
            let client = reqwest::Client::new();
            
            let params = [
                ("grant_type", "refresh_token"),
                ("refresh_token", refresh.as_str()),
                ("client_secret", client_secret),
            ];
            
            let response = client
                .post(self.provider.token_url())
                .form(&params)
                .send()
                .await
                .map_err(|e| CloudError::Network(e.to_string()))?;
            
            let body = response.text().await
                .map_err(|e| CloudError::Network(e.to_string()))?;
            
            let token_data: serde_json::Value = serde_json::from_str(&body)
                .map_err(|e| CloudError::AuthFailed(format!("Failed to parse refresh: {}", e)))?;
            
            if let Some(new_token) = token_data["access_token"].as_str() {
                self.access_token = new_token.to_string();
                
                if let Some(new_refresh) = token_data["refresh_token"].as_str() {
                    self.refresh_token = Some(new_refresh.to_string());
                }
                
                if let Some(expires_in) = token_data["expires_in"].as_i64() {
                    self.expires_at = SystemTime::now() + Duration::from_secs(expires_in as u64);
                }
                
                info!("Token refreshed successfully");
                Ok(())
            } else {
                Err(CloudError::AuthFailed("No access token in refresh response".to_string()))
            }
        } else {
            Err(CloudError::TokenExpired)
        }
    }
}

/// Authentication manager
pub struct AuthManager {
    tokens: HashMap<OAuthProvider, AuthToken>,
    config_path: PathBuf,
}

impl AuthManager {
    pub fn new(config_path: PathBuf) -> Self {
        Self {
            tokens: HashMap::new(),
            config_path,
        }
    }
    
    /// Load saved tokens
    pub fn load(&mut self) -> Result<(), CloudError> {
        if self.config_path.exists() {
            let content = std::fs::read_to_string(&self.config_path)?;
            let saved: HashMap<OAuthProvider, AuthToken> = serde_json::from_str(&content)?;
            self.tokens = saved;
            info!("Loaded {} auth tokens", self.tokens.len());
        }
        Ok(())
    }
    
    /// Save tokens
    pub fn save(&self) -> Result<(), CloudError> {
        let content = serde_json::to_string_pretty(&self.tokens)?;
        std::fs::write(&self.config_path, content)?;
        Ok(())
    }
    
    /// Add token
    pub fn add_token(&mut self, token: AuthToken) {
        self.tokens.insert(token.provider.clone(), token);
    }
    
    /// Get token for provider
    pub fn get_token(&self, provider: &OAuthProvider) -> Option<&AuthToken> {
        self.tokens.get(provider)
    }
    
    /// Remove token
    pub fn remove_token(&mut self, provider: &OAuthProvider) {
        self.tokens.remove(provider);
    }
    
    /// Check if authenticated with provider
    pub fn is_authenticated(&self, provider: &OAuthProvider) -> bool {
        if let Some(token) = self.tokens.get(provider) {
            !token.is_expired()
        } else {
            false
        }
    }
    
    /// Get all authenticated providers
    pub fn authenticated_providers(&self) -> Vec<&OAuthProvider> {
        self.tokens.values()
            .filter(|t| !t.is_expired())
            .map(|t| &t.provider)
            .collect()
    }
}

/// Session history for sync
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SessionHistory {
    pub id: String,
    pub name: String,
    pub created_at: SystemTime,
    pub updated_at: SystemTime,
    pub working_directory: PathBuf,
    pub files_opened: Vec<PathBuf>,
    pub conversation: Vec<ConversationEntry>,
    pub metadata: HashMap<String, String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ConversationEntry {
    pub timestamp: SystemTime,
    pub role: String, // "user" or "assistant"
    pub content: String,
    pub tool_calls: Vec<ToolCallRecord>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ToolCallRecord {
    pub tool_name: String,
    pub input: serde_json::Value,
    pub output: serde_json::Value,
    pub duration_ms: u64,
}

/// History sync manager
pub struct HistorySync {
    sessions: Vec<SessionHistory>,
    sync_enabled: bool,
    cloud_endpoint: String,
    auth_manager: AuthManager,
    local_path: PathBuf,
}

impl HistorySync {
    pub fn new(
        auth_manager: AuthManager,
        local_path: PathBuf,
        cloud_endpoint: String,
    ) -> Self {
        Self {
            sessions: Vec::new(),
            sync_enabled: false,
            cloud_endpoint,
            auth_manager,
            local_path,
        }
    }
    
    /// Load local history
    pub fn load(&mut self) -> Result<(), CloudError> {
        if self.local_path.exists() {
            let content = std::fs::read_to_string(&self.local_path)?;
            self.sessions = serde_json::from_str(&content)?;
            info!("Loaded {} sessions from local storage", self.sessions.len());
        }
        Ok(())
    }
    
    /// Save local history
    pub fn save(&self) -> Result<(), CloudError> {
        let content = serde_json::to_string_pretty(&self.sessions)?;
        std::fs::write(&self.local_path, content)?;
        Ok(())
    }
    
    /// Create new session
    pub fn create_session(&mut self, name: String, working_dir: PathBuf) -> &SessionHistory {
        let id = uuid::Uuid::new_v4().to_string();
        let now = SystemTime::now();
        
        let session = SessionHistory {
            id,
            name,
            created_at: now,
            updated_at: now,
            working_directory: working_dir,
            files_opened: Vec::new(),
            conversation: Vec::new(),
            metadata: HashMap::new(),
        };
        
        self.sessions.push(session);
        self.sessions.last().unwrap()
    }
    
    /// Get session by ID
    pub fn get_session(&self, id: &str) -> Option<&SessionHistory> {
        self.sessions.iter().find(|s| s.id == id)
    }
    
    /// Get session by ID (mutable)
    pub fn get_session_mut(&mut self, id: &str) -> Option<&mut SessionHistory> {
        self.sessions.iter_mut().find(|s| s.id == id)
    }
    
    /// Add conversation entry to session
    pub fn add_entry(&mut self, session_id: &str, entry: ConversationEntry) -> Result<(), CloudError> {
        if let Some(session) = self.get_session_mut(session_id) {
            session.conversation.push(entry);
            session.updated_at = SystemTime::now();
            
            // Auto-save
            self.save()?;
            
            // Sync if enabled
            if self.sync_enabled {
                let _ = self.sync_session(session_id);
            }
            
            Ok(())
        } else {
            Err(CloudError::SyncConflict("Session not found".to_string()))
        }
    }
    
    /// Delete session
    pub fn delete_session(&mut self, id: &str) -> Result<(), CloudError> {
        let idx = self.sessions.iter().position(|s| s.id == id);
        if let Some(idx) = idx {
            self.sessions.remove(idx);
            self.save()?;
            
            if self.sync_enabled {
                // TODO: Delete from cloud
            }
            
            Ok(())
        } else {
            Err(CloudError::SyncConflict("Session not found".to_string()))
        }
    }
    
    /// Enable/disable sync
    pub fn set_sync_enabled(&mut self, enabled: bool) {
        self.sync_enabled = enabled;
        info!("Cloud sync {}", if enabled { "enabled" } else { "disabled" });
    }
    
    /// Sync all sessions to cloud
    pub async fn sync_all(&self) -> Result<SyncResult, CloudError> {
        if !self.sync_enabled {
            return Ok(SyncResult::skipped());
        }
        
        if self.auth_manager.authenticated_providers().is_empty() {
            return Err(CloudError::NotAuthenticated);
        }
        
        info!("Starting sync of {} sessions", self.sessions.len());
        
        let mut synced = 0;
        let mut failed = 0;
        
        for session in &self.sessions {
            match self.sync_session(&session.id).await {
                Ok(_) => synced += 1,
                Err(_) => failed += 1,
            }
        }
        
        Ok(SyncResult { synced, failed, conflicts: 0 })
    }
    
    /// Sync single session
    pub async fn sync_session(&self, session_id: &str) -> Result<(), CloudError> {
        if !self.sync_enabled {
            return Ok(());
        }
        
        let session = self.get_session(session_id)
            .ok_or_else(|| CloudError::SyncConflict("Session not found".to_string()))?;
        
        let client = reqwest::Client::new();
        
        // Get auth token
        let provider = OAuthProvider::GitHub; // Default provider
        let token = self.auth_manager.get_token(&provider)
            .ok_or(CloudError::NotAuthenticated)?;
        
        let response = client
            .post(&format!("{}/sessions", self.cloud_endpoint))
            .bearer_auth(&token.access_token)
            .json(session)
            .send()
            .await
            .map_err(|e| CloudError::Network(e.to_string()))?;
        
        if response.status().is_success() {
            info!("Synced session {}", session_id);
            Ok(())
        } else {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            Err(CloudError::ApiError { status: status.as_u16(), message: body })
        }
    }
    
    /// Fetch sessions from cloud
    pub async fn fetch_cloud_sessions(&self) -> Result<Vec<SessionHistory>, CloudError> {
        if !self.sync_enabled {
            return Ok(Vec::new());
        }
        
        let provider = OAuthProvider::GitHub;
        let token = self.auth_manager.get_token(&provider)
            .ok_or(CloudError::NotAuthenticated)?;
        
        let client = reqwest::Client::new();
        
        let response = client
            .get(&format!("{}/sessions", self.cloud_endpoint))
            .bearer_auth(&token.access_token)
            .send()
            .await
            .map_err(|e| CloudError::Network(e.to_string()))?;
        
        if response.status().is_success() {
            let sessions = response.json().await
                .map_err(|e| CloudError::Network(e.to_string()))?;
            Ok(sessions)
        } else {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            Err(CloudError::ApiError { status: status.as_u16(), message: body })
        }
    }
}

/// Sync result
pub struct SyncResult {
    pub synced: usize,
    pub failed: usize,
    pub conflicts: usize,
}

impl SyncResult {
    fn skipped() -> Self {
        Self { synced: 0, failed: 0, conflicts: 0 }
    }
}

/// Team collaboration features
pub struct TeamManager {
    team_id: Option<String>,
    members: Vec<TeamMember>,
    shared_sessions: Vec<String>,
    permissions: HashMap<String, TeamPermission>,
}

#[derive(Clone, Debug)]
pub struct TeamMember {
    pub id: String,
    pub name: String,
    pub email: String,
    pub role: TeamRole,
    pub status: MemberStatus,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum TeamRole {
    Owner,
    Admin,
    Member,
    Viewer,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum MemberStatus {
    Active,
    Invited,
    Suspended,
}

#[derive(Clone, Debug)]
pub struct TeamPermission {
    pub can_edit: bool,
    pub can_share: bool,
    pub can_invite: bool,
}

impl TeamManager {
    pub fn new() -> Self {
        Self {
            team_id: None,
            members: Vec::new(),
            shared_sessions: Vec::new(),
            permissions: HashMap::new(),
        }
    }
    
    /// Invite member to team
    pub async fn invite_member(
        &self,
        email: String,
        role: TeamRole,
    ) -> Result<TeamMember, CloudError> {
        // Implementation would send invitation via API
        let member = TeamMember {
            id: uuid::Uuid::new_v4().to_string(),
            name: String::new(),
            email,
            role,
            status: MemberStatus::Invited,
        };
        
        info!("Invited {} to team", member.email);
        Ok(member)
    }
    
    /// Share session with team
    pub fn share_session(&mut self, session_id: String) {
        if !self.shared_sessions.contains(&session_id) {
            self.shared_sessions.push(session_id);
        }
    }
    
    /// Unshare session
    pub fn unshare_session(&mut self, session_id: &str) {
        self.shared_sessions.retain(|id| id != session_id);
    }
    
    /// Get shared sessions
    pub fn shared_sessions(&self) -> &[String] {
        &self.shared_sessions
    }
}

/// Cloud storage integration
pub struct CloudStorage {
    provider: OAuthProvider,
    endpoint: String,
    auth_manager: AuthManager,
}

impl CloudStorage {
    pub fn new(provider: OAuthProvider, endpoint: String, auth_manager: AuthManager) -> Self {
        Self {
            provider,
            endpoint,
            auth_manager,
        }
    }
    
    /// Upload file to cloud
    pub async fn upload(
        &self,
        local_path: &std::path::Path,
        remote_path: &str,
    ) -> Result<(), CloudError> {
        let token = self.auth_manager.get_token(&self.provider)
            .ok_or(CloudError::NotAuthenticated)?;
        
        let client = reqwest::Client::new();
        let file_content = std::fs::read(local_path)?;
        
        let response = client
            .put(&format!("{}/files/{}", self.endpoint, remote_path))
            .bearer_auth(&token.access_token)
            .body(file_content)
            .send()
            .await
            .map_err(|e| CloudError::Network(e.to_string()))?;
        
        if response.status().is_success() {
            info!("Uploaded {:?} to {}", local_path, remote_path);
            Ok(())
        } else {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            Err(CloudError::ApiError { status: status.as_u16(), message: body })
        }
    }
    
    /// Download file from cloud
    pub async fn download(
        &self,
        remote_path: &str,
        local_path: &std::path::Path,
    ) -> Result<(), CloudError> {
        let token = self.auth_manager.get_token(&self.provider)
            .ok_or(CloudError::NotAuthenticated)?;
        
        let client = reqwest::Client::new();
        
        let response = client
            .get(&format!("{}/files/{}", self.endpoint, remote_path))
            .bearer_auth(&token.access_token)
            .send()
            .await
            .map_err(|e| CloudError::Network(e.to_string()))?;
        
        if response.status().is_success() {
            let content = response.bytes().await
                .map_err(|e| CloudError::Network(e.to_string()))?;
            
            std::fs::write(local_path, content)?;
            info!("Downloaded {} to {:?}", remote_path, local_path);
            Ok(())
        } else {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            Err(CloudError::ApiError { status: status.as_u16(), message: body })
        }
    }
    
    /// List cloud files
    pub async fn list_files(&self, prefix: &str) -> Result<Vec<CloudFile>, CloudError> {
        let token = self.auth_manager.get_token(&self.provider)
            .ok_or(CloudError::NotAuthenticated)?;
        
        let client = reqwest::Client::new();
        
        let response = client
            .get(&format!("{}/files?prefix={}", self.endpoint, prefix))
            .bearer_auth(&token.access_token)
            .send()
            .await
            .map_err(|e| CloudError::Network(e.to_string()))?;
        
        if response.status().is_success() {
            let files = response.json().await
                .map_err(|e| CloudError::Network(e.to_string()))?;
            Ok(files)
        } else {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            Err(CloudError::ApiError { status: status.as_u16(), message: body })
        }
    }
}

/// Cloud file metadata
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CloudFile {
    pub path: String,
    pub size: u64,
    pub modified_at: SystemTime,
    pub is_directory: bool,
}

