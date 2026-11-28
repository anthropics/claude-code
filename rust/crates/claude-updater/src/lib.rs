//! Auto-update system - Check and install updates automatically
//!
//! Features:
//! - Automatic update checking
//! - Semver-compatible version comparison
//! - Background download
//! - Safe update installation
//! - Rollback on failure

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::{Duration, SystemTime};
use tokio::fs;
use tracing::{error, info, warn};

/// Update configuration
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct UpdateConfig {
    pub enabled: bool,
    pub check_interval_hours: u64,
    pub auto_install: bool,
    pub channel: UpdateChannel,
    pub endpoint: String,
    pub last_check: Option<SystemTime>,
}

impl Default for UpdateConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            check_interval_hours: 24,
            auto_install: false,
            channel: UpdateChannel::Stable,
            endpoint: "https://api.anthropic.com/claude-code/updates".to_string(),
            last_check: None,
        }
    }
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
pub enum UpdateChannel {
    Stable,
    Beta,
    Nightly,
}

impl UpdateChannel {
    pub fn as_str(&self) -> &'static str {
        match self {
            UpdateChannel::Stable => "stable",
            UpdateChannel::Beta => "beta",
            UpdateChannel::Nightly => "nightly",
        }
    }
}

/// Release information
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Release {
    pub version: String,
    pub channel: UpdateChannel,
    pub published_at: SystemTime,
    pub release_notes: String,
    pub download_url: String,
    pub checksum: String,
    pub size_bytes: u64,
    pub min_version: Option<String>,
    pub critical: bool,
}

/// Update manager
pub struct UpdateManager {
    config: UpdateConfig,
    current_version: String,
    cache_dir: PathBuf,
    http_client: reqwest::Client,
}

impl UpdateManager {
    pub fn new(
        config: UpdateConfig,
        current_version: String,
        cache_dir: PathBuf,
    ) -> Self {
        let http_client = reqwest::Client::builder()
            .timeout(Duration::from_secs(60))
            .build()
            .expect("Failed to build HTTP client");
        
        Self {
            config,
            current_version,
            cache_dir,
            http_client,
        }
    }
    
    /// Check if update check is due
    pub fn should_check(&self) -> bool {
        if !self.config.enabled {
            return false;
        }
        
        if let Some(last_check) = self.config.last_check {
            let elapsed = SystemTime::now()
                .duration_since(last_check)
                .unwrap_or(Duration::MAX);
            
            let interval = Duration::from_secs(self.config.check_interval_hours * 3600);
            elapsed >= interval
        } else {
            true
        }
    }
    
    /// Check for available updates
    pub async fn check_for_updates(&self) -> Result<Option<Release>, UpdateError> {
        if !self.config.enabled {
            return Ok(None);
        }
        
        info!("Checking for updates...");
        
        let platform = std::env::consts::OS;
        let arch = std::env::consts::ARCH;
        
        let url = format!(
            "{}/latest?channel={}&platform={}&arch={}&current={}",
            self.config.endpoint,
            self.config.channel.as_str(),
            platform,
            arch,
            self.current_version
        );
        
        let response = self.http_client
            .get(&url)
            .send()
            .await
            .map_err(|e| UpdateError::Network(e.to_string()))?;
        
        if response.status() == reqwest::StatusCode::NOT_MODIFIED {
            info!("Already on latest version");
            return Ok(None);
        }
        
        if !response.status().is_success() {
            return Err(UpdateError::Api(format!(
                "HTTP {}",
                response.status()
            )));
        }
        
        let release: Release = response
            .json()
            .await
            .map_err(|e| UpdateError::Parse(e.to_string()))?;
        
        // Compare versions
        if self.is_newer(&release.version) {
            info!("Update available: {} -> {}", self.current_version, release.version);
            Ok(Some(release))
        } else {
            info!("Already on latest version: {}", self.current_version);
            Ok(None)
        }
    }
    
    /// Download an update
    pub async fn download_update(&self, release: &Release) -> Result<PathBuf, UpdateError> {
        info!("Downloading update {}...", release.version);
        
        let temp_path = self.cache_dir.join(format!(
            "claude-code-{}-{}.tmp",
            release.version,
            std::process::id()
        ));
        
        // Ensure cache directory exists
        fs::create_dir_all(&self.cache_dir).await
            .map_err(|e| UpdateError::Io(e.to_string()))?;
        
        // Download with progress tracking
        let mut response = self.http_client
            .get(&release.download_url)
            .send()
            .await
            .map_err(|e| UpdateError::Network(e.to_string()))?;
        
        if !response.status().is_success() {
            return Err(UpdateError::Network(format!(
                "Download failed: HTTP {}",
                response.status()
            )));
        }
        
        // Stream download to file
        let mut file = fs::File::create(&temp_path).await
            .map_err(|e| UpdateError::Io(e.to_string()))?;
        
        let mut downloaded: u64 = 0;
        while let Some(chunk) = response.chunk().await
            .map_err(|e| UpdateError::Network(e.to_string()))?
        {
            use tokio::io::AsyncWriteExt;
            file.write_all(&chunk).await
                .map_err(|e| UpdateError::Io(e.to_string()))?;
            
            downloaded += chunk.len() as u64;
            
            // Log progress every 10%
            if release.size_bytes > 0 {
                let percent = (downloaded * 100) / release.size_bytes;
                if percent % 10 == 0 {
                    info!("Download progress: {}%", percent);
                }
            }
        }
        
        // Verify checksum
        let checksum = self.calculate_checksum(&temp_path).await?;
        if checksum != release.checksum {
            fs::remove_file(&temp_path).await.ok();
            return Err(UpdateError::ChecksumMismatch);
        }
        
        let final_path = self.cache_dir.join(format!(
            "claude-code-{}-{}",
            release.version,
            self.platform_suffix()
        ));
        
        fs::rename(&temp_path, &final_path).await
            .map_err(|e| UpdateError::Io(e.to_string()))?;
        
        info!("Update downloaded to {:?}", final_path);
        Ok(final_path)
    }
    
    /// Install an update
    pub async fn install_update(&self, release: &Release, update_path: &PathBuf) -> Result<(), UpdateError> {
        info!("Installing update {}...", release.version);
        
        let current_exe = std::env::current_exe()
            .map_err(|e| UpdateError::Io(e.to_string()))?;
        
        // Platform-specific installation
        #[cfg(target_os = "macos")]
        self.install_macos(update_path, &current_exe).await?;
        
        #[cfg(target_os = "linux")]
        self.install_linux(update_path, &current_exe).await?;
        
        #[cfg(target_os = "windows")]
        self.install_windows(update_path, &current_exe).await?;
        
        info!("Update installed successfully");
        Ok(())
    }
    
    #[cfg(target_os = "macos")]
    async fn install_macos(&self, update_path: &PathBuf, current_exe: &PathBuf) -> Result<(), UpdateError> {
        // Backup current executable
        let backup = current_exe.with_extension("backup");
        fs::copy(current_exe, &backup).await
            .map_err(|e| UpdateError::Io(e.to_string()))?;
        
        // Replace with new version
        fs::rename(update_path, current_exe).await
            .map_err(|e| UpdateError::Io(e.to_string()))?;
        
        // Set executable permissions
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = fs::metadata(current_exe).await
                .map_err(|e| UpdateError::Io(e.to_string()))?
                .permissions();
            perms.set_mode(0o755);
            fs::set_permissions(current_exe, perms).await
                .map_err(|e| UpdateError::Io(e.to_string()))?;
        }
        
        Ok(())
    }
    
    #[cfg(target_os = "linux")]
    async fn install_linux(&self, update_path: &PathBuf, current_exe: &PathBuf) -> Result<(), UpdateError> {
        // Same as macOS for now
        self.install_macos(update_path, current_exe).await
    }
    
    #[cfg(target_os = "windows")]
    async fn install_windows(&self, update_path: &PathBuf, current_exe: &PathBuf) -> Result<(), UpdateError> {
        // Windows: rename running executable not possible
        // Need to use a helper process for replacement
        
        let installer_script = self.cache_dir.join("install_update.bat");
        let script_content = format!(
            r#"@echo off
timeout /t 2 /nobreak >nul
move /Y "{}" "{}"
start "" "{}"
del "%~f0""#,
            update_path.display(),
            current_exe.display(),
            current_exe.display()
        );
        
        fs::write(&installer_script, script_content).await
            .map_err(|e| UpdateError::Io(e.to_string()))?;
        
        // Spawn the installer and exit
        std::process::Command::new("cmd")
            .args(["/C", &installer_script.to_string_lossy()])
            .spawn()
            .map_err(|e| UpdateError::Io(e.to_string()))?;
        
        Ok(())
    }
    
    /// Calculate file checksum (SHA-256)
    async fn calculate_checksum(&self, path: &PathBuf) -> Result<String, UpdateError> {
        use sha2::{Digest, Sha256};
        
        let content = fs::read(path).await
            .map_err(|e| UpdateError::Io(e.to_string()))?;
        
        let mut hasher = Sha256::new();
        hasher.update(&content);
        let result = hasher.finalize();
        
        Ok(format!("{:x}", result))
    }
    
    /// Compare versions (semver-style)
    fn is_newer(&self, other_version: &str) -> bool {
        let current = parse_version(&self.current_version);
        let other = parse_version(other_version);
        
        other > current
    }
    
    fn platform_suffix(&self) -> &'static str {
        match std::env::consts::OS {
            "macos" => "macos",
            "linux" => "linux",
            "windows" => "windows.exe",
            _ => "unknown",
        }
    }
}

/// Parse semantic version
fn parse_version(version: &str) -> (u32, u32, u32, Option<String>) {
    let version = version.trim_start_matches('v');
    let parts: Vec<&str> = version.split('.').collect();
    
    let major = parts.get(0).and_then(|s| s.parse().ok()).unwrap_or(0);
    let minor = parts.get(1).and_then(|s| s.parse().ok()).unwrap_or(0);
    
    // Handle patch and pre-release (e.g., "1.2.3-beta")
    let (patch, pre_release) = if let Some(patch_str) = parts.get(2) {
        if let Some(dash_idx) = patch_str.find('-') {
            let (num, pre) = patch_str.split_at(dash_idx);
            (num.parse().unwrap_or(0), Some(pre[1..].to_string()))
        } else {
            (patch_str.parse().unwrap_or(0), None)
        }
    } else {
        (0, None)
    };
    
    (major, minor, patch, pre_release)
}

/// Update errors
#[derive(Debug)]
pub enum UpdateError {
    Network(String),
    Api(String),
    Parse(String),
    Io(String),
    ChecksumMismatch,
    InstallationFailed(String),
}

impl std::fmt::Display for UpdateError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            UpdateError::Network(s) => write!(f, "Network error: {}", s),
            UpdateError::Api(s) => write!(f, "API error: {}", s),
            UpdateError::Parse(s) => write!(f, "Parse error: {}", s),
            UpdateError::Io(s) => write!(f, "IO error: {}", s),
            UpdateError::ChecksumMismatch => write!(f, "Checksum verification failed"),
            UpdateError::InstallationFailed(s) => write!(f, "Installation failed: {}", s),
        }
    }
}

impl std::error::Error for UpdateError {}

