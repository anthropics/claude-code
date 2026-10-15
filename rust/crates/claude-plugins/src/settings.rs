//! Advanced Settings - Complex permission rules, marketplace management, profile configs

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

/// Advanced settings with complex rules
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AdvancedSettings {
    /// Profile-based configurations
    pub profiles: HashMap<String, ProfileConfig>,
    /// Active profile name
    pub active_profile: String,
    /// Tool-specific permissions
    pub tool_permissions: ToolPermissions,
    /// Directory-specific rules
    pub directory_rules: Vec<DirectoryRule>,
    /// File pattern rules
    pub file_pattern_rules: Vec<FilePatternRule>,
    /// Marketplace configuration
    pub marketplace: MarketplaceConfig,
    /// Permission inheritance
    pub inheritance: InheritanceRules,
    /// Notification settings
    pub notifications: NotificationSettings,
    /// Privacy settings
    pub privacy: PrivacySettings,
    /// Autonomous mode settings
    pub autonomous: AutonomousSettings,
}

/// Profile configuration
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ProfileConfig {
    pub name: String,
    pub description: String,
    pub permissions: PermissionLevel,
    /// Auto-allow patterns
    pub auto_allow: Vec<String>,
    /// Auto-deny patterns
    pub auto_deny: Vec<String>,
    /// Require confirmation for
    pub require_confirmation: Vec<String>,
    /// Allowed tools
    pub allowed_tools: Vec<String>,
    /// Blocked tools
    pub blocked_tools: Vec<String>,
    /// Sandbox settings
    pub sandbox: SandboxSettings,
    /// Output style
    pub output_style: String,
    /// Model preference
    pub model: String,
    /// Max tokens per request
    pub max_tokens: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PermissionLevel {
    Strict,    // Ask for everything
    Balanced,  // Auto-allow safe operations
    Permissive, // Auto-allow most operations
    Custom,    // Use custom rules
}

/// Sandbox settings per profile
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SandboxSettings {
    pub bash_sandbox: BashSandboxProfile,
    pub network_sandbox: NetworkSandboxProfile,
    pub auto_suggest_sandboxed_bash_commands: bool,
    pub allow_weaker_nested_sandbox: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct BashSandboxProfile {
    pub auto_allow_sandboxed: bool,
    pub excluded_commands: Vec<String>,
    pub allowed_commands: Vec<String>,
    pub blocked_commands: Vec<String>,
    pub require_confirmation_for: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct NetworkSandboxProfile {
    pub allow_all: bool,
    pub allowed_domains: Vec<String>,
    pub blocked_domains: Vec<String>,
    pub allow_unix_sockets: Vec<String>,
    pub allow_all_unix_sockets: bool,
    pub allow_local_binding: bool,
}

/// Tool-specific permissions
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ToolPermissions {
    /// Global tool permissions
    pub global: HashMap<String, ToolPermission>,
    /// Per-directory overrides
    pub per_directory: HashMap<PathBuf, HashMap<String, ToolPermission>>,
    /// Per-file overrides
    pub per_file: HashMap<PathBuf, HashMap<String, ToolPermission>>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ToolPermission {
    pub tool_name: String,
    pub allowed: PermissionState,
    pub conditions: Vec<PermissionCondition>,
    pub reason: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PermissionState {
    Allow,
    Deny,
    Ask,
    AllowWithConfirmation,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PermissionCondition {
    pub condition_type: ConditionType,
    pub pattern: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConditionType {
    FileExtension,
    FileSize,
    DirectoryPath,
    ContentPattern,
    TimeOfDay,
    UserConfirmation,
}

/// Directory-specific rules
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DirectoryRule {
    pub path: PathBuf,
    pub recursive: bool,
    pub permissions: HashMap<String, PermissionState>,
    pub description: String,
    pub priority: i32, // Higher priority wins conflicts
}

/// File pattern rules
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct FilePatternRule {
    pub pattern: String,
    #[serde(with = "serde_regex")]
    pub regex: regex::Regex,
    pub permissions: HashMap<String, PermissionState>,
    pub description: String,
    pub priority: i32,
}

/// Marketplace configuration
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MarketplaceConfig {
    pub enabled: bool,
    pub trusted_publishers: Vec<String>,
    pub auto_update_plugins: bool,
    pub update_check_interval_hours: u32,
    pub installed_plugins: Vec<InstalledPlugin>,
    pub custom_registries: Vec<RegistryConfig>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct InstalledPlugin {
    pub name: String,
    pub version: String,
    pub publisher: String,
    pub installed_at: String,
    pub last_updated: String,
    pub enabled: bool,
    pub permissions: PluginMarketplacePermissions,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PluginMarketplacePermissions {
    pub filesystem_read: bool,
    pub filesystem_write: bool,
    pub network_access: bool,
    pub shell_execution: bool,
    pub max_disk_usage_mb: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RegistryConfig {
    pub name: String,
    pub url: String,
    pub trusted: bool,
    pub api_key: Option<String>,
}

/// Inheritance rules for permissions
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct InheritanceRules {
    pub inherit_from_parent: bool,
    pub merge_strategy: MergeStrategy,
    pub override_rules: Vec<OverrideRule>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MergeStrategy {
    MostRestrictive,
    LeastRestrictive,
    ExplicitOnly,
    PriorityBased,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct OverrideRule {
    pub child_pattern: String,
    pub parent_pattern: String,
    pub action: OverrideAction,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OverrideAction {
    Override,
    Extend,
    Ignore,
}

/// Notification settings
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct NotificationSettings {
    pub enabled: bool,
    pub desktop_notifications: bool,
    pub sound_effects: bool,
    pub notify_on_long_operations: bool,
    pub long_operation_threshold_seconds: u32,
    pub notify_on_completion: bool,
    pub notify_on_error: bool,
    pub quiet_hours: Option<QuietHours>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct QuietHours {
    pub start: String, // HH:MM format
    pub end: String,
    pub timezone: String,
    pub allow_critical: bool,
}

/// Privacy settings
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PrivacySettings {
    pub telemetry_enabled: bool,
    pub share_usage_stats: bool,
    pub allow_cloud_sync: bool,
    pub encrypt_local_data: bool,
    pub retention_days: u32,
    pub local_only_mode: bool,
    pub mask_sensitive_output: bool,
}

/// Autonomous mode settings
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AutonomousSettings {
    pub enabled: bool,
    pub max_iterations: u32,
    pub stop_on_error: bool,
    pub require_approval_for_writes: bool,
    pub require_approval_for_deletes: bool,
    pub allow_git_operations: bool,
    pub auto_commit_message_template: String,
    pub timeout_seconds: u32,
    pub ralph_mode: RalphSettings,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RalphSettings {
    pub enabled: bool,
    pub max_iterations: u32,
    pub stop_on_first_error: bool,
    pub verbose_logging: bool,
    pub auto_summary: bool,
}

/// Default settings
impl Default for AdvancedSettings {
    fn default() -> Self {
        let mut profiles = HashMap::new();

        // Strict profile
        profiles.insert(
            "strict".to_string(),
            ProfileConfig {
                name: "strict".to_string(),
                description: "Maximum security, ask for everything".to_string(),
                permissions: PermissionLevel::Strict,
                auto_allow: vec![],
                auto_deny: vec!["rm -rf".to_string(), "sudo -S -p ''".to_string()],
                require_confirmation: vec!["*".to_string()],
                allowed_tools: vec![],
                blocked_tools: vec![],
                sandbox: SandboxSettings {
                    bash_sandbox: BashSandboxProfile {
                        auto_allow_sandboxed: false,
                        excluded_commands: vec![],
                        allowed_commands: vec![],
                        blocked_commands: vec!["rm -rf /".to_string()],
                        require_confirmation_for: vec!["*".to_string()],
                    },
                    network_sandbox: NetworkSandboxProfile {
                        allow_all: false,
                        allowed_domains: vec![],
                        blocked_domains: vec![],
                        allow_unix_sockets: vec![],
                        allow_all_unix_sockets: false,
                        allow_local_binding: false,
                    },
                    auto_suggest_sandboxed_bash_commands: false,
                    allow_weaker_nested_sandbox: false,
                },
                output_style: "normal".to_string(),
                model: "claude-3-sonnet".to_string(),
                max_tokens: 4000,
            },
        );

        // Balanced profile (default)
        profiles.insert(
            "balanced".to_string(),
            ProfileConfig {
                name: "balanced".to_string(),
                description: "Safe defaults with smart auto-allow".to_string(),
                permissions: PermissionLevel::Balanced,
                auto_allow: vec![
                    "Read".to_string(),
                    "View".to_string(),
                    "LSP".to_string(),
                ],
                auto_deny: vec!["rm -rf /".to_string(), "mkfs".to_string()],
                require_confirmation: vec![
                    "Edit".to_string(),
                    "Write".to_string(),
                    "Bash".to_string(),
                ],
                allowed_tools: vec![],
                blocked_tools: vec![],
                sandbox: SandboxSettings {
                    bash_sandbox: BashSandboxProfile {
                        auto_allow_sandboxed: false,
                        excluded_commands: vec![],
                        allowed_commands: vec!["ls".to_string(), "cat".to_string()],
                        blocked_commands: vec!["rm -rf /".to_string()],
                        require_confirmation_for: vec!["rm".to_string(), "sudo -S -p ''".to_string()],
                    },
                    network_sandbox: NetworkSandboxProfile {
                        allow_all: false,
                        allowed_domains: vec![
                            "api.github.com".to_string(),
                            "github.com".to_string(),
                        ],
                        blocked_domains: vec![],
                        allow_unix_sockets: vec![],
                        allow_all_unix_sockets: false,
                        allow_local_binding: false,
                    },
                    auto_suggest_sandboxed_bash_commands: true,
                    allow_weaker_nested_sandbox: false,
                },
                output_style: "normal".to_string(),
                model: "claude-3-sonnet".to_string(),
                max_tokens: 8000,
            },
        );

        Self {
            profiles,
            active_profile: "balanced".to_string(),
            tool_permissions: ToolPermissions {
                global: HashMap::new(),
                per_directory: HashMap::new(),
                per_file: HashMap::new(),
            },
            directory_rules: vec![],
            file_pattern_rules: vec![],
            marketplace: MarketplaceConfig {
                enabled: true,
                trusted_publishers: vec!["anthropic".to_string()],
                auto_update_plugins: false,
                update_check_interval_hours: 24,
                installed_plugins: vec![],
                custom_registries: vec![],
            },
            inheritance: InheritanceRules {
                inherit_from_parent: true,
                merge_strategy: MergeStrategy::MostRestrictive,
                override_rules: vec![],
            },
            notifications: NotificationSettings {
                enabled: true,
                desktop_notifications: true,
                sound_effects: false,
                notify_on_long_operations: true,
                long_operation_threshold_seconds: 30,
                notify_on_completion: false,
                notify_on_error: true,
                quiet_hours: None,
            },
            privacy: PrivacySettings {
                telemetry_enabled: true,
                share_usage_stats: false,
                allow_cloud_sync: true,
                encrypt_local_data: true,
                retention_days: 90,
                local_only_mode: false,
                mask_sensitive_output: true,
            },
            autonomous: AutonomousSettings {
                enabled: false,
                max_iterations: 50,
                stop_on_error: true,
                require_approval_for_writes: true,
                require_approval_for_deletes: true,
                allow_git_operations: false,
                auto_commit_message_template: "Auto: {description}".to_string(),
                timeout_seconds: 300,
                ralph_mode: RalphSettings {
                    enabled: false,
                    max_iterations: 100,
                    stop_on_first_error: false,
                    verbose_logging: true,
                    auto_summary: true,
                },
            },
        }
    }
}

/// Settings manager
pub struct AdvancedSettingsManager {
    settings: AdvancedSettings,
    config_path: PathBuf,
}

impl AdvancedSettingsManager {
    pub fn new(config_path: PathBuf) -> Self {
        Self {
            settings: AdvancedSettings::default(),
            config_path,
        }
    }

    /// Load settings from disk
    pub fn load(&mut self) -> anyhow::Result<()> {
        if self.config_path.exists() {
            let content = std::fs::read_to_string(&self.config_path)?;
            self.settings = serde_json::from_str(&content)?;
        }
        Ok(())
    }

    /// Save settings to disk
    pub fn save(&self) -> anyhow::Result<()> {
        let content = serde_json::to_string_pretty(&self.settings)?;
        std::fs::write(&self.config_path, content)?;
        Ok(())
    }

    /// Get current settings
    pub fn settings(&self) -> &AdvancedSettings {
        &self.settings
    }

    /// Get mutable settings
    pub fn settings_mut(&mut self) -> &mut AdvancedSettings {
        &mut self.settings
    }

    /// Get active profile
    pub fn active_profile(&self) -> Option<&ProfileConfig> {
        self.settings.profiles.get(&self.settings.active_profile)
    }

    /// Switch profile
    pub fn switch_profile(&mut self, profile: &str) -> anyhow::Result<()> {
        if self.settings.profiles.contains_key(profile) {
            self.settings.active_profile = profile.to_string();
            Ok(())
        } else {
            anyhow::bail!("Profile not found: {}", profile)
        }
    }

    /// Check if a tool is allowed for a specific file
    pub fn check_tool_permission(
        &self,
        tool: &str,
        file: Option<&PathBuf>,
    ) -> PermissionState {
        // Check per-file rules first
        if let Some(path) = file {
            if let Some(file_perms) = self.settings.tool_permissions.per_file.get(path) {
                if let Some(perm) = file_perms.get(tool) {
                    return perm.allowed.clone();
                }
            }

            // Check directory rules
            for rule in &self.settings.directory_rules {
                if path.starts_with(&rule.path) {
                    if let Some(state) = rule.permissions.get(tool) {
                        return state.clone();
                    }
                    if !rule.recursive {
                        break;
                    }
                }
            }
        }

        // Check global permissions
        if let Some(perm) = self.settings.tool_permissions.global.get(tool) {
            return perm.allowed.clone();
        }

        // Fall back to profile default
        if let Some(profile) = self.active_profile() {
            if profile.blocked_tools.contains(&tool.to_string()) {
                return PermissionState::Deny;
            }
            if profile.allowed_tools.contains(&tool.to_string())
                || profile.auto_allow.contains(&tool.to_string())
            {
                return PermissionState::Allow;
            }
            if profile.require_confirmation.iter().any(|p| {
                p == "*" || tool.contains(p)
            }) {
                return PermissionState::Ask;
            }
        }

        PermissionState::Ask
    }
}

