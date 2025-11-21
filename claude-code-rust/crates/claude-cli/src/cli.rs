//! CLI argument parsing

use clap::{Parser, Subcommand, ValueEnum};

#[derive(Parser)]
#[command(name = "claude")]
#[command(about = "Claude Code - starts an interactive session by default, use -p/--print for non-interactive output", long_about = None)]
#[command(version)]
#[command(author = "Anthropic")]
pub struct Cli {
    /// Your prompt
    #[arg(value_name = "prompt")]
    pub prompt: Option<String>,

    /// Enable debug mode with optional category filtering (e.g., "api,hooks" or "!statsig,!file")
    #[arg(short = 'd', long, value_name = "filter")]
    pub debug: Option<Option<String>>,

    /// Override verbose mode setting from config
    #[arg(long)]
    pub verbose: bool,

    /// Print response and exit (useful for pipes). Note: The workspace trust dialog is skipped when Claude is run with the -p mode. Only use this flag in directories you trust.
    #[arg(long, short, value_name = "PRINT")]
    pub print: bool,

    /// Output format (only works with --print): "text" (default), "json" (single result), or "stream-json" (realtime streaming)
    #[arg(long, value_name = "format", value_enum)]
    pub output_format: Option<OutputFormat>,

    /// Include partial message chunks as they arrive (only works with --print and --output-format=stream-json)
    #[arg(long)]
    pub include_partial_messages: bool,

    /// Input format (only works with --print): "text" (default), or "stream-json" (realtime streaming input)
    #[arg(long, value_name = "format", value_enum)]
    pub input_format: Option<InputFormat>,

    /// [DEPRECATED. Use --debug instead] Enable MCP debug mode (shows MCP server errors)
    #[arg(long)]
    pub mcp_debug: bool,

    /// Bypass all permission checks. Recommended only for sandboxes with no internet access.
    #[arg(long)]
    pub dangerously_skip_permissions: bool,

    /// Enable bypassing all permission checks as an option, without it being enabled by default. Recommended only for sandboxes with no internet access.
    #[arg(long)]
    pub allow_dangerously_skip_permissions: bool,

    /// Re-emit user messages from stdin back on stdout for acknowledgment (only works with --input-format=stream-json and --output-format=stream-json)
    #[arg(long)]
    pub replay_user_messages: bool,

    /// Comma or space-separated list of tool names to allow (e.g. "Bash(git:) Edit")
    #[arg(long = "allowedTools", alias = "allowed-tools", value_name = "tools", num_args = 1..)]
    pub allowed_tools: Vec<String>,

    /// Specify the list of available tools from the built-in set. Use "" to disable all tools, "default" to use all tools, or specify tool names (e.g. "Bash,Edit,Read"). Only works with --print mode.
    #[arg(long, value_name = "tools", num_args = 1..)]
    pub tools: Vec<String>,

    /// Comma or space-separated list of tool names to deny (e.g. "Bash(git:) Edit")
    #[arg(long = "disallowedTools", alias = "disallowed-tools", value_name = "tools", num_args = 1..)]
    pub disallowed_tools: Vec<String>,

    /// Load MCP servers from JSON files or strings (space-separated)
    #[arg(long, value_name = "configs", num_args = 1..)]
    pub mcp_config: Vec<String>,

    /// System prompt to use for the session
    #[arg(long, value_name = "prompt")]
    pub system_prompt: Option<String>,

    /// Append a system prompt to the default system prompt
    #[arg(long, value_name = "prompt")]
    pub append_system_prompt: Option<String>,

    /// Permission mode to use for the session
    #[arg(long, value_name = "mode", value_enum)]
    pub permission_mode: Option<PermissionMode>,

    /// Continue the most recent conversation
    #[arg(short = 'c', long = "continue")]
    pub continue_session: bool,

    /// Resume a conversation - provide a session ID or interactively select a conversation to resume
    #[arg(short = 'r', long, value_name = "sessionId")]
    pub resume: Option<Option<String>>,

    /// When resuming, create a new session ID instead of reusing the original (use with --resume or --continue)
    #[arg(long)]
    pub fork_session: bool,

    /// Model for the current session. Provide an alias for the latest model (e.g. 'sonnet' or 'opus') or a model's full name (e.g. 'claude-sonnet-4-5-20250929').
    #[arg(long, value_name = "model", env = "CLAUDE_MODEL")]
    pub model: Option<String>,

    /// Enable automatic fallback to specified model when default model is overloaded (only works with --print)
    #[arg(long, value_name = "model")]
    pub fallback_model: Option<String>,

    /// Path to a settings JSON file or a JSON string to load additional settings from
    #[arg(long, value_name = "file-or-json")]
    pub settings: Option<String>,

    /// Additional directories to allow tool access to
    #[arg(long, value_name = "directories", num_args = 1..)]
    pub add_dir: Vec<String>,

    /// Automatically connect to IDE on startup if exactly one valid IDE is available
    #[arg(long)]
    pub ide: bool,

    /// Only use MCP servers from --mcp-config, ignoring all other MCP configurations
    #[arg(long)]
    pub strict_mcp_config: bool,

    /// Use a specific session ID for the conversation (must be a valid UUID)
    #[arg(long, value_name = "uuid")]
    pub session_id: Option<String>,

    /// JSON object defining custom agents (e.g. '{"reviewer": {"description": "Reviews code", "prompt": "You are a code reviewer"}}')
    #[arg(long, value_name = "json")]
    pub agents: Option<String>,

    /// Comma-separated list of setting sources to load (user, project, local).
    #[arg(long, value_name = "sources")]
    pub setting_sources: Option<String>,

    /// Load plugins from directories for this session only (repeatable)
    #[arg(long, value_name = "paths", num_args = 1..)]
    pub plugin_dir: Vec<String>,

    /// API key (can also use ANTHROPIC_API_KEY env var)
    #[arg(long, env = "ANTHROPIC_API_KEY", hide = true)]
    pub api_key: Option<String>,

    /// Config directory (default: ~/.claude)
    #[arg(long, env = "CLAUDE_CONFIG_DIR", hide = true)]
    pub config_dir: Option<String>,

    /// Working directory
    #[arg(long, hide = true)]
    pub working_dir: Option<String>,

    /// System prompt file
    #[arg(long, hide = true)]
    pub system_prompt_file: Option<String>,

    /// Subcommands
    #[command(subcommand)]
    pub command: Option<Commands>,
}

#[derive(ValueEnum, Clone, Debug)]
pub enum OutputFormat {
    Text,
    Json,
    #[value(name = "stream-json")]
    StreamJson,
}

#[derive(ValueEnum, Clone, Debug)]
pub enum InputFormat {
    Text,
    #[value(name = "stream-json")]
    StreamJson,
}

#[derive(ValueEnum, Clone, Debug)]
pub enum PermissionMode {
    #[value(name = "acceptEdits")]
    AcceptEdits,
    #[value(name = "bypassPermissions")]
    BypassPermissions,
    #[value(name = "default")]
    Default,
    #[value(name = "plan")]
    Plan,
}

#[derive(Subcommand)]
pub enum Commands {
    /// Configure and manage MCP servers
    Mcp {
        #[command(subcommand)]
        command: McpCommands,
    },

    /// Manage Claude Code plugins
    Plugin {
        #[command(subcommand)]
        command: PluginCommands,
    },

    /// Migrate from global npm installation to local installation
    #[command(name = "migrate-installer")]
    MigrateInstaller,

    /// Set up a long-lived authentication token (requires Claude subscription)
    #[command(name = "setup-token")]
    SetupToken,

    /// Check the health of your Claude Code
    Doctor,

    /// Check for updates and install if available
    #[command(name = "auto-updater")]
    AutoUpdater {
        #[command(subcommand)]
        command: AutoUpdaterCommands,
    },

    /// Install Claude Code native build. Use [target] to specify version (stable, latest, or specific version)
    Install {
        /// Target version (stable, latest, or specific version)
        #[arg(value_name = "target")]
        target: Option<String>,
    },
}

#[derive(Subcommand)]
pub enum McpCommands {
    /// Start MCP server
    Serve,
}

#[derive(Subcommand)]
pub enum PluginCommands {
    /// List installed plugins
    List,
    /// Install a plugin
    Install {
        /// Plugin name or path
        name: String,
    },
    /// Uninstall a plugin
    Uninstall {
        /// Plugin name
        name: String,
    },
}

#[derive(Subcommand)]
pub enum AutoUpdaterCommands {
    /// Check for updates and install if available
    Update,
}
