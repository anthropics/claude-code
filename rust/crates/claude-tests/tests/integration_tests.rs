//! Integration tests for Claude Code
//!
//! Tests the complete system end-to-end including:
//! - API communication
//! - Tool execution
//! - Git operations
//! - TUI interactions

#[cfg(test)]
mod tests {
    use claude_core::*;
    use claude_engine::Engine;
    use claude_api::Client;
    use claude_tools::*;
    use std::time::Duration;
    use tempfile::TempDir;
    
    /// Test API client initialization
    #[tokio::test]
    async fn test_api_client_creation() {
        let client = Client::new("test-api-key".to_string());
        assert!(!client.is_ready()); // Not ready without valid key
    }
    
    /// Test engine initialization
    #[tokio::test]
    async fn test_engine_initialization() {
        let temp_dir = TempDir::new().unwrap();
        let engine = Engine::new(temp_dir.path()).await;
        
        assert!(engine.is_initialized());
        assert_eq!(engine.session_count(), 0);
    }
    
    /// Test tool registration
    #[tokio::test]
    async fn test_tool_registration() {
        let mut engine = Engine::new(std::env::temp_dir()).await;
        
        let tools = default_tools();
        assert!(!tools.is_empty());
        
        for tool in tools {
            engine.register_tool(tool).await.unwrap();
        }
        
        assert_eq!(engine.tool_count(), 7);
    }
    
    /// Test bash tool execution
    #[tokio::test]
    async fn test_bash_tool_echo() {
        let tool = BashTool::new();
        let input = ToolInput::new(serde_json::json!({
            "command": "echo 'hello world'"
        }));
        
        let result = tool.execute(input, &ToolContext::default()).await;
        assert!(result.is_ok());
        
        let output = result.unwrap();
        assert!(output.content.contains("hello world"));
    }
    
    /// Test file operations
    #[tokio::test]
    async fn test_file_tool_operations() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.txt");
        
        // Write test
        let write_tool = FileWriteTool::new();
        let input = ToolInput::new(serde_json::json!({
            "path": file_path.to_str().unwrap(),
            "content": "Hello, World!"
        }));
        
        let result = write_tool.execute(input, &ToolContext::default()).await;
        assert!(result.is_ok());
        
        // Read test
        let read_tool = FileReadTool::new();
        let input = ToolInput::new(serde_json::json!({
            "path": file_path.to_str().unwrap()
        }));
        
        let result = read_tool.execute(input, &ToolContext::default()).await;
        assert!(result.is_ok());
        assert!(result.unwrap().content.contains("Hello, World!"));
    }
    
    /// Test session management
    #[tokio::test]
    async fn test_session_lifecycle() {
        let temp_dir = TempDir::new().unwrap();
        let mut engine = Engine::new(temp_dir.path()).await;
        
        // Create session
        let session_id = engine.create_session("Test Session".to_string()).await;
        assert!(!session_id.is_empty());
        assert_eq!(engine.session_count(), 1);
        
        // Add message
        engine.add_message(&session_id, "Hello", "user").await.unwrap();
        
        // Get session
        let session = engine.get_session(&session_id).await;
        assert!(session.is_some());
        
        // End session
        engine.end_session(&session_id).await;
        assert_eq!(engine.session_count(), 0);
    }
    
    /// Test tool validation
    #[tokio::test]
    async fn test_tool_validation() {
        let tool = BashTool::new();
        
        // Valid input
        let valid_input = ToolInput::new(serde_json::json!({
            "command": "ls -la"
        }));
        assert!(tool.validate(&valid_input).is_ok());
        
        // Invalid input (missing required field)
        let invalid_input = ToolInput::new(serde_json::json!({}));
        assert!(tool.validate(&invalid_input).is_err());
    }
}

#[cfg(test)]
mod git_tests {
    use claude_git::*;
    use std::process::Command;
    use tempfile::TempDir;
    
    /// Setup a test git repository
    fn setup_repo() -> TempDir {
        let temp_dir = TempDir::new().unwrap();
        
        Command::new("git")
            .args(["init"])
            .current_dir(&temp_dir)
            .output()
            .expect("Failed to init git");
        
        Command::new("git")
            .args(["config", "user.email", "test@example.com"])
            .current_dir(&temp_dir)
            .output()
            .expect("Failed to config git");
        
        Command::new("git")
            .args(["config", "user.name", "Test User"])
            .current_dir(&temp_dir)
            .output()
            .expect("Failed to config git");
        
        temp_dir
    }
    
    #[tokio::test]
    async fn test_git_status_clean() {
        let temp_dir = setup_repo();
        
        let tool = GitTool::new();
        let input = ToolInput::new(serde_json::json!({
            "command": "status",
            "path": temp_dir.path().to_str().unwrap()
        }));
        
        let result = tool.execute(input, &ToolContext::default()).await;
        assert!(result.is_ok());
        assert!(result.unwrap().content.contains("nothing to commit"));
    }
}

#[cfg(test)]
mod performance_tests {
    use std::time::Instant;
    use claude_engine::Engine;
    use tempfile::TempDir;
    
    #[tokio::test]
    async fn test_startup_time() {
        let temp_dir = TempDir::new().unwrap();
        
        let start = Instant::now();
        let engine = Engine::new(temp_dir.path()).await;
        let elapsed = start.elapsed();
        
        // Engine should initialize in under 100ms
        assert!(elapsed.as_millis() < 100);
        assert!(engine.is_initialized());
    }
    
    #[tokio::test]
    async fn test_tool_execution_speed() {
        use claude_tools::BashTool;
        use claude_core::{Tool, ToolInput, ToolContext};
        
        let tool = BashTool::new();
        let input = ToolInput::new(serde_json::json!({
            "command": "echo test"
        }));
        
        let start = Instant::now();
        let result = tool.execute(input, &ToolContext::default()).await;
        let elapsed = start.elapsed();
        
        assert!(result.is_ok());
        // Tool execution should be fast
        assert!(elapsed.as_millis() < 50);
    }
}

