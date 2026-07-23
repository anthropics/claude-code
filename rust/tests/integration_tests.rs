//! Integration tests for Claude Code engine
//!
//! These tests verify the full agent loop, tool execution,
//! and query engine behavior.

#[cfg(test)]
mod engine_tests {
    use claude_core::{AgentConfig, AgentId, Message, MessageId, MessageRole, SessionId};
    use claude_engine::{AppState, EngineConfig, QueryEngine};
    
    #[tokio::test]
    async fn test_engine_creation() {
        let engine_config = EngineConfig::default();
        let app_state = AppState::new(engine_config);
        
        assert!(app_state.sessions().is_empty());
    }
    
    #[tokio::test]
    async fn test_session_creation() {
        let engine_config = EngineConfig::default();
        let mut app_state = AppState::new(engine_config);
        
        let session = app_state.create_session(None);
        
        assert_eq!(session.messages().len(), 1); // System message
        assert!(!session.session_id().as_str().is_empty());
    }
    
    #[tokio::test]
    async fn test_agent_creation() {
        let engine_config = EngineConfig::default();
        let mut app_state = AppState::new(engine_config);
        
        let config = AgentConfig::default();
        let agent = app_state.create_agent(config);
        
        assert!(!agent.agent_id().as_str().is_empty());
        assert_eq!(agent.status(), AgentStatus::Idle);
    }
}

#[cfg(test)]
mod tool_tests {
    use claude_tools::{Bash, FileRead, FileWrite, Ls};
    
    #[tokio::test]
    async fn test_bash_echo() {
        let bash = Bash::new(30);
        
        let params = serde_json::json!({
            "command": "echo 'Hello World'"
        });
        
        let result = bash.execute(params).await;
        assert!(result.is_ok());
        
        let output = result.unwrap();
        assert!(output.get("stdout").unwrap().as_str().unwrap().contains("Hello World"));
    }
    
    #[tokio::test]
    async fn test_bash_timeout() {
        let bash = Bash::new(1); // 1 second timeout
        
        let params = serde_json::json!({
            "command": "sleep 10"
        });
        
        let result = bash.execute(params).await;
        assert!(result.is_err());
    }
    
    #[tokio::test]
    async fn test_file_read_write() {
        use std::io::Write;
        use tempfile::NamedTempFile;
        
        let mut temp_file = NamedTempFile::new().unwrap();
        write!(temp_file, "Test content").unwrap();
        
        let reader = FileRead::new();
        let params = serde_json::json!({
            "path": temp_file.path().to_str().unwrap()
        });
        
        let result = reader.execute(params).await;
        assert!(result.is_ok());
        
        let output = result.unwrap();
        assert_eq!(output.get("content").unwrap().as_str().unwrap(), "Test content");
    }
    
    #[tokio::test]
    async fn test_ls_directory() {
        use tempfile::TempDir;
        
        let temp = TempDir::new().unwrap();
        std::fs::File::create(temp.path().join("test.txt")).unwrap();
        
        let ls = Ls::new();
        let params = serde_json::json!({
            "path": temp.path().to_str().unwrap()
        });
        
        let result = ls.execute(params).await;
        assert!(result.is_ok());
        
        let output = result.unwrap();
        let entries = output.get("entries").unwrap().as_array().unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].get("name").unwrap().as_str().unwrap(), "test.txt");
    }
}

#[cfg(test)]
mod api_tests {
    use claude_api::AnthropicClient;
    
    #[test]
    fn test_client_creation() {
        // Should create client even without API key (will fail on actual calls)
        let client = AnthropicClient::new("test-key".to_string());
        assert!(!client.api_key().is_empty());
    }
}

#[cfg(test)]
mod alias_tests {
    use claude_aliases::parse_alias;
    
    #[test]
    fn test_parse_simple_alias() {
        let alias = "@test: bash 'cargo test'";
        let result = parse_alias(alias);
        
        assert!(result.is_ok());
        let parsed = result.unwrap();
        assert_eq!(parsed.name, "test");
        assert_eq!(parsed.steps.len(), 1);
    }
    
    #[test]
    fn test_parse_alias_with_params() {
        let alias = "@search: grep $pattern && ls -la $dir";
        let result = parse_alias(alias);
        
        assert!(result.is_ok());
        let parsed = result.unwrap();
        assert!(parsed.has_parameters());
    }
    
    #[test]
    fn test_parse_invalid_alias() {
        let alias = "invalid_alias_format";
        let result = parse_alias(alias);
        
        assert!(result.is_err());
    }
}

#[cfg(test)]
mod permission_tests {
    use claude_permissions::{AdvancedPermissionChecker, PermissionConfig, PermissionDecision, PermissionMode};
    
    #[tokio::test]
    async fn test_default_allow_read() {
        let checker = AdvancedPermissionChecker::new();
        
        assert_eq!(
            checker.check("Read", "/some/path").await,
            PermissionDecision::Allow
        );
    }
    
    #[tokio::test]
    async fn test_read_only_mode() {
        let config = PermissionConfig::new().with_mode(PermissionMode::ReadOnly);
        let checker = AdvancedPermissionChecker::with_config(config);
        
        assert_eq!(
            checker.check("Write", "/some/path").await,
            PermissionDecision::Deny
        );
    }
    
    #[tokio::test]
    async fn test_dangerous_command_check() {
        let checker = AdvancedPermissionChecker::new();
        
        // rm -rf / should be blocked or require confirmation
        let decision = checker.check("Bash", "rm -rf /").await;
        assert_ne!(decision, PermissionDecision::Allow);
    }
    
    #[tokio::test]
    async fn test_learned_patterns() {
        let checker = AdvancedPermissionChecker::new();
        
        // Record a decision
        checker.record_decision(
            "Bash".to_string(),
            "cargo build".to_string(),
            PermissionDecision::Allow,
            true
        ).await;
        
        // The checker should have learned from this
        let history = checker.history().await;
        assert!(!history.is_empty());
    }
}

#[cfg(test)]
mod config_tests {
    use claude_config::ClaudeConfig;
    
    #[test]
    fn test_default_config() {
        let config = ClaudeConfig::new();
        
        assert_eq!(config.api.model, "claude-3-7-sonnet-20241022");
        assert!(config.ui.animations);
        assert_eq!(config.tools.bash_timeout_secs, 30);
    }
    
    #[test]
    fn test_config_merge() {
        use serde_json::json;
        
        let mut base = ClaudeConfig::new();
        let mut other = ClaudeConfig::new();
        
        other.api.model = "claude-3-opus".to_string();
        other.ui.animations = false;
        other.custom.insert("custom_key".to_string(), json!("value"));
        
        base.merge(other);
        
        assert_eq!(base.api.model, "claude-3-opus");
        assert!(!base.ui.animations);
        assert!(base.custom.contains_key("custom_key"));
    }
}

#[cfg(test)]
mod fs_tests {
    use claude_fs::{FileCache, FileIndex};
    use std::time::Duration;
    
    #[tokio::test]
    async fn test_file_cache() {
        let cache = FileCache::new(Duration::from_secs(60));
        
        cache.insert("/tmp/test".to_string(), b"content".to_vec()).await;
        
        let cached = cache.get("/tmp/test").await;
        assert!(cached.is_some());
        assert_eq!(cached.unwrap(), b"content");
    }
    
    #[tokio::test]
    async fn test_file_index() {
        use tempfile::TempDir;
        
        let temp = TempDir::new().unwrap();
        std::fs::write(temp.path().join("test.txt"), "content").unwrap();
        std::fs::write(temp.path().join("test2.rs"), "fn main() {}").unwrap();
        
        let index = FileIndex::new(temp.path());
        let files = index.files_by_extension("txt").await;
        
        assert_eq!(files.len(), 1);
        assert!(files[0].ends_with("test.txt"));
    }
}

use std::sync::Once;

static INIT: Once = Once::new();

pub fn setup_test_logging() {
    INIT.call_once(|| {
        let _ = tracing_subscriber::fmt()
            .with_env_filter("info")
            .try_init();
    });
}

