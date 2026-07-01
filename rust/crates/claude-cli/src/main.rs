//! Claude Code CLI - Main entry point

use claude_core::{AgentConfig, PermissionMode};
use claude_engine::{AppState, QueryEngine};
use claude_tools::{default_tools, BashTool, FileReadTool, FileWriteTool, FileEditTool, GrepTool, GlobTool, LSTool, GitTool};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::info;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt::init();
    
    info!("Claude Code - Rust Implementation");
    
    // Get API key
    let api_key = std::env::var("ANTHROPIC_API_KEY")
        .expect("ANTHROPIC_API_KEY environment variable not set");
    
    // Create application state
    let app_state = Arc::new(RwLock::new(AppState::new()));
    
    // Create API client
    let client = claude_api::AnthropicClient::new(&api_key);
    
    // Create agent config
    let config = AgentConfig::default()
        .with_model("claude-3-7-sonnet-20241022");
    
    // Create query engine
    let mut engine = QueryEngine::new(client, config, app_state.clone());
    
    // Register default tools
    let tools = default_tools();
    // Register each tool
    engine.register_tool(BashTool::new()).await;
    engine.register_tool(FileReadTool::new()).await;
    engine.register_tool(FileWriteTool::new()).await;
    engine.register_tool(FileEditTool::new()).await;
    engine.register_tool(GrepTool::new()).await;
    engine.register_tool(GlobTool::new()).await;
    engine.register_tool(LSTool::new()).await;
    engine.register_tool(GitTool::new()).await;
    
    // Set permission mode
    engine.set_permission_mode(PermissionMode::AutoYes).await;
    
    // Check for command line arguments
    let args: Vec<String> = std::env::args().collect();
    
    if args.len() > 1 {
        // Single query mode
        let query = args[1..].join(" ");
        info!("Running single query: {}", query);
        
        match engine.process_query(&query).await {
            Ok(response) => {
                // Print response content
                for block in &response.content {
                    if let Some(text) = block.as_text() {
                        println!("{}", text);
                    }
                }
            }
            Err(e) => {
                eprintln!("Error: {}", e);
                std::process::exit(1);
            }
        }
    } else {
        // Interactive TUI mode would start here
        println!("Claude Code - Rust Implementation");
        println!("Usage: claude-code <query>");
        println!();
        println!("Example:");
        println!("  claude-code 'What files are in the current directory?'");
        println!();
        println!("Environment variables:");
        println!("  ANTHROPIC_API_KEY - Required for API access");
    }
    
    Ok(())
}

