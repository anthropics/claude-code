//! Claude Code Plugin System
//!
//! This crate provides the full plugin system for Claude Code including:
//! - Plugin loading and management
//! - Commands (slash commands)
//! - Agents (specialized AI workers with parallel execution)
//! - Skills (reusable capabilities)
//! - Hooks (event interception)
//! - Sandbox (security restrictions)
//! - Advanced tools (WebSearch, WebFetch, NotebookEdit)
//! - CLAUDE.md parsing and compliance
//! - Output styles

pub mod agents;
pub mod commands;
pub mod sandbox;
pub mod styles;
pub mod tools;
pub mod claude_md;

// Re-export main types
pub use agents::{AgentExecutor, AgentResult, Issue, IssueSeverity};
pub use commands::{CommandExecutor, CommandOutput, parse_command};
pub use sandbox::{Sandbox, SandboxConfig, SandboxDecision};
pub use styles::{OutputStyle, OutputStyleConfig, StyleManager, FormattingContext};
pub use tools::{WebSearchTool, WebFetchTool, NotebookEditTool};
pub use claude_md::{ClaudeMd, ClaudeMdParser, ComplianceChecker, Violation};

// Core plugin types from lib.rs
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tokio::fs;
use tracing::{debug, error, info, warn};

/// Plugin manifest
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PluginManifest {
    pub name: String,
    pub version: String,
    pub description: String,
    pub author: String,
    pub license: Option<String>,
    pub homepage: Option<String>,
    pub repository: Option<String>,
    pub keywords: Vec<String>,
    pub categories: Vec<String>,
    pub entry: Option<String>,
    pub hooks: Option<HooksConfig>,
    pub commands: Option<Vec<CommandDefinition>>,
    pub agents: Option<Vec<AgentDefinition>>,
    pub skills: Option<Vec<SkillDefinition>>,
    pub mcp: Option<McpConfig>,
    pub permissions: Option<PluginPermissions>,
}

/// Hooks configuration
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct HooksConfig {
    #[serde(rename = "PreToolUse")]
    pub pre_tool_use: Option<Vec<HookDefinition>>,
    #[serde(rename = "PostToolUse")]
    pub post_tool_use: Option<Vec<HookDefinition>>,
    #[serde(rename = "SessionStart")]
    pub session_start: Option<Vec<HookDefinition>>,
    #[serde(rename = "SessionEnd")]
    pub session_end: Option<Vec<HookDefinition>>,
    #[serde(rename = "Stop")]
    pub stop: Option<Vec<HookDefinition>>,
    #[serde(rename = "Prompt")]
    pub prompt: Option<Vec<HookDefinition>>,
}

/// Hook definition
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct HookDefinition {
    pub name: String,
    pub description: Option<String>,
    pub enabled: bool,
    #[serde(rename = "type")]
    pub hook_type: HookType,
    pub pattern: Option<String>,
    pub matcher: Option<String>,
    pub action: HookAction,
    pub conditions: Option<Vec<HookCondition>>,
    pub message: Option<String>,
    pub command: Option<String>,
    pub script: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HookType {
    Command,
    Script,
    Builtin,
    Remote,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HookAction {
    Warn,
    Block,
    Allow,
    Modify,
    Inject,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct HookCondition {
    pub field: String,
    pub operator: String,
    pub pattern: String,
}

/// Command definition (slash commands)
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CommandDefinition {
    pub name: String,
    pub description: String,
    pub usage: Option<String>,
    pub examples: Option<Vec<String>>,
    pub args: Option<Vec<CommandArg>>,
    pub handler: CommandHandler,
    pub requires_confirmation: Option<bool>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CommandArg {
    pub name: String,
    pub description: String,
    pub required: bool,
    #[serde(rename = "type")]
    pub arg_type: String,
    pub default: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum CommandHandler {
    #[serde(rename = "builtin")]
    Builtin { function: String },
    #[serde(rename = "agent")]
    Agent { agent: String, prompt_template: String },
    #[serde(rename = "script")]
    Script { path: String },
    #[serde(rename = "workflow")]
    Workflow { phases: Vec<WorkflowPhase> },
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct WorkflowPhase {
    pub name: String,
    pub description: String,
    pub agent: Option<String>,
    pub prompt: String,
    pub requires_approval: bool,
}

/// Agent definition
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AgentDefinition {
    pub name: String,
    pub description: String,
    pub system_prompt: String,
    pub model: Option<String>,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
    pub skills: Option<Vec<String>>,
    pub tools: Option<Vec<String>>,
    pub hooks: Option<Vec<String>>,
    pub parallelizable: bool,
    pub confidence_threshold: Option<f32>,
}

/// Skill definition
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SkillDefinition {
    pub name: String,
    pub description: String,
    pub version: String,
    pub content: String,
    pub auto_invoke: Option<bool>,
    pub triggers: Option<Vec<String>>,
}

/// MCP configuration
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct McpConfig {
    pub servers: Vec<McpServer>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct McpServer {
    pub name: String,
    #[serde(rename = "type")]
    pub server_type: McpServerType,
    pub command: Option<String>,
    pub args: Option<Vec<String>>,
    pub url: Option<String>,
    pub env: Option<HashMap<String, String>>,
    pub enabled: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum McpServerType {
    Stdio,
    Sse,
    Http,
}

/// Plugin permissions
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PluginPermissions {
    pub filesystem: Option<FileSystemPermissions>,
    pub network: Option<NetworkPermissions>,
    pub shell: Option<ShellPermissions>,
    pub tools: Option<Vec<String>>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct FileSystemPermissions {
    pub read: Vec<String>,
    pub write: Vec<String>,
    pub deny: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct NetworkPermissions {
    pub allowed_domains: Vec<String>,
    pub blocked_domains: Vec<String>,
    pub allow_all: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ShellPermissions {
    pub allowed_commands: Vec<String>,
    pub blocked_commands: Vec<String>,
    pub allow_all: bool,
}

/// Loaded plugin
pub struct Plugin {
    pub manifest: PluginManifest,
    pub path: PathBuf,
    pub enabled: bool,
    pub loaded_at: std::time::SystemTime,
}

/// Plugin manager
pub struct PluginManager {
    plugins: HashMap<String, Plugin>,
    plugin_dirs: Vec<PathBuf>,
    hooks: HookRegistry,
    commands: CommandRegistry,
    agents: AgentRegistry,
    skills: SkillRegistry,
}

impl PluginManager {
    pub fn new() -> Self {
        Self {
            plugins: HashMap::new(),
            plugin_dirs: vec![
                dirs::home_dir()
                    .map(|h| h.join(".claude/plugins"))
                    .unwrap_or_else(|| PathBuf::from("/tmp/claude/plugins")),
                PathBuf::from(".claude/plugins"),
            ],
            hooks: HookRegistry::new(),
            commands: CommandRegistry::new(),
            agents: AgentRegistry::new(),
            skills: SkillRegistry::new(),
        }
    }

    pub async fn load_plugins(&mut self) -> anyhow::Result<usize> {
        info!("Loading plugins...");
        let mut loaded = 0;

        for dir in &self.plugin_dirs {
            if !dir.exists() {
                continue;
            }

            let mut entries = fs::read_dir(dir).await?;
            while let Some(entry) = entries.next_entry().await? {
                let path = entry.path();
                if path.is_dir() {
                    match self.load_plugin(&path).await {
                        Ok(_) => loaded += 1,
                        Err(e) => warn!("Failed to load plugin from {:?}: {}", path, e),
                    }
                }
            }
        }

        info!("Loaded {} plugins", loaded);
        Ok(loaded)
    }

    async fn load_plugin(&mut self, path: &Path) -> anyhow::Result<()> {
        let manifest_path = path.join(".claude-plugin/plugin.json");
        if !manifest_path.exists() {
            anyhow::bail!("No plugin.json found");
        }

        let content = fs::read_to_string(&manifest_path).await?;
        let manifest: PluginManifest = serde_json::from_str(&content)?;

        info!("Loading plugin: {} v{}", manifest.name, manifest.version);

        if let Some(hooks) = &manifest.hooks {
            self.hooks.register_plugin(&manifest.name, hooks)?;
        }

        if let Some(commands) = &manifest.commands {
            for cmd in commands {
                self.commands.register(cmd)?;
            }
        }

        if let Some(agents) = &manifest.agents {
            for agent in agents {
                self.agents.register(agent)?;
            }
        }

        if let Some(skills) = &manifest.skills {
            for skill in skills {
                self.skills.register(skill)?;
            }
        }

        let plugin = Plugin {
            manifest: manifest.clone(),
            path: path.to_path_buf(),
            enabled: true,
            loaded_at: std::time::SystemTime::now(),
        };

        self.plugins.insert(manifest.name.clone(), plugin);
        Ok(())
    }

    pub fn get_plugin(&self, name: &str) -> Option<&Plugin> {
        self.plugins.get(name)
    }

    pub fn list_plugins(&self) -> Vec<&Plugin> {
        self.plugins.values().collect()
    }

    pub fn set_enabled(&mut self, name: &str, enabled: bool) -> anyhow::Result<()> {
        if let Some(plugin) = self.plugins.get_mut(name) {
            plugin.enabled = enabled;
            info!("Plugin {} {}", name, if enabled { "enabled" } else { "disabled" });
            Ok(())
        } else {
            anyhow::bail!("Plugin not found: {}", name)
        }
    }

    pub fn hooks(&self) -> &HookRegistry {
        &self.hooks
    }

    pub fn hooks_mut(&mut self) -> &mut HookRegistry {
        &mut self.hooks
    }

    pub fn commands(&self) -> &CommandRegistry {
        &self.commands
    }

    pub fn agents(&self) -> &AgentRegistry {
        &self.agents
    }

    pub fn skills(&self) -> &SkillRegistry {
        &self.skills
    }
}

/// Hook registry
pub struct HookRegistry {
    hooks: HashMap<HookEvent, Vec<HookDefinition>>,
}

#[derive(Clone, Debug, Hash, Eq, PartialEq)]
pub enum HookEvent {
    PreToolUse,
    PostToolUse,
    SessionStart,
    SessionEnd,
    Stop,
    Prompt,
}

impl HookRegistry {
    pub fn new() -> Self {
        Self {
            hooks: HashMap::new(),
        }
    }

    fn register_plugin(&mut self, _plugin_name: &str, config: &HooksConfig) -> anyhow::Result<()> {
        if let Some(hooks) = &config.pre_tool_use {
            self.register_hooks(HookEvent::PreToolUse, hooks.clone());
        }
        if let Some(hooks) = &config.post_tool_use {
            self.register_hooks(HookEvent::PostToolUse, hooks.clone());
        }
        if let Some(hooks) = &config.session_start {
            self.register_hooks(HookEvent::SessionStart, hooks.clone());
        }
        if let Some(hooks) = &config.session_end {
            self.register_hooks(HookEvent::SessionEnd, hooks.clone());
        }
        if let Some(hooks) = &config.stop {
            self.register_hooks(HookEvent::Stop, hooks.clone());
        }
        if let Some(hooks) = &config.prompt {
            self.register_hooks(HookEvent::Prompt, hooks.clone());
        }
        Ok(())
    }

    fn register_hooks(&mut self, event: HookEvent, hooks: Vec<HookDefinition>) {
        let entry = self.hooks.entry(event).or_default();
        entry.extend(hooks);
    }

    pub fn get_hooks(&self, event: HookEvent) -> Vec<&HookDefinition> {
        self.hooks.get(&event).map(|v| v.iter().collect()).unwrap_or_default()
    }

    pub async fn execute_hooks(
        &self,
        event: HookEvent,
        _context: &HookContext,
    ) -> Vec<HookResult> {
        let mut results = vec![];
        
        for hook in self.get_hooks(event) {
            if !hook.enabled {
                continue;
            }

            let result = HookResult {
                action: hook.action.clone(),
                message: hook.message.clone(),
                modified_input: None,
            };
            results.push(result);

            if matches!(hook.action, HookAction::Block) {
                break;
            }
        }

        results
    }
}

/// Context passed to hooks
pub struct HookContext {
    pub tool_name: Option<String>,
    pub tool_input: Option<serde_json::Value>,
    pub file_path: Option<String>,
    pub user_prompt: Option<String>,
    pub session_transcript: Option<String>,
}

/// Result of hook execution
pub struct HookResult {
    pub action: HookAction,
    pub message: Option<String>,
    pub modified_input: Option<serde_json::Value>,
}

/// Command registry
pub struct CommandRegistry {
    commands: HashMap<String, CommandDefinition>,
}

impl CommandRegistry {
    pub fn new() -> Self {
        Self {
            commands: HashMap::new(),
        }
    }

    fn register(&mut self, cmd: &CommandDefinition) -> anyhow::Result<()> {
        info!("Registering command: /{}", cmd.name);
        self.commands.insert(cmd.name.clone(), cmd.clone());
        Ok(())
    }

    pub fn get_command(&self, name: &str) -> Option<&CommandDefinition> {
        self.commands.get(name)
    }

    pub fn list_commands(&self) -> Vec<&CommandDefinition> {
        self.commands.values().collect()
    }
}

/// Agent registry
pub struct AgentRegistry {
    agents: HashMap<String, AgentDefinition>,
}

impl AgentRegistry {
    pub fn new() -> Self {
        Self {
            agents: HashMap::new(),
        }
    }

    fn register(&mut self, agent: &AgentDefinition) -> anyhow::Result<()> {
        info!("Registering agent: {}", agent.name);
        self.agents.insert(agent.name.clone(), agent.clone());
        Ok(())
    }

    pub fn get_agent(&self, name: &str) -> Option<&AgentDefinition> {
        self.agents.get(name)
    }

    pub fn list_agents(&self) -> Vec<&AgentDefinition> {
        self.agents.values().collect()
    }
}

/// Skill registry
pub struct SkillRegistry {
    skills: HashMap<String, SkillDefinition>,
}

impl SkillRegistry {
    pub fn new() -> Self {
        Self {
            skills: HashMap::new(),
        }
    }

    fn register(&mut self, skill: &SkillDefinition) -> anyhow::Result<()> {
        info!("Registering skill: {}", skill.name);
        self.skills.insert(skill.name.clone(), skill.clone());
        Ok(())
    }

    pub fn get_skill(&self, name: &str) -> Option<&SkillDefinition> {
        self.skills.get(name)
    }

    pub fn find_relevant_skills(&self, context: &str) -> Vec<&SkillDefinition> {
        self.skills
            .values()
            .filter(|s| {
                if let Some(triggers) = &s.triggers {
                    triggers.iter().any(|t| context.contains(t))
                } else {
                    false
                }
            })
            .collect()
    }
}

