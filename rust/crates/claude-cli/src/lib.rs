//! CLI application

pub mod cli;
pub mod config;
pub mod logging;

use anyhow::Result;
use claude_api::AnthropicClient;
use claude_engine::{EngineContext, QueryEngine};
use claude_tools::default_tools;
use tracing::info;

/// Run the CLI application
pub async fn run() -> Result<()> {
    let args = cli::Cli::parse();
    
    logging::init(&args.log_level)?;
    
    info!("Claude Code Rust v{}", env!("CARGO_PKG_VERSION"));
    
    let config = config::Config::load_or_default()?;
    
    let api_key = config.api_key
        .or_else(|| std::env::var("ANTHROPIC_API_KEY").ok())
        .ok_or_else(|| anyhow::anyhow!("API key not found"))?;
    
    let context = EngineContext::new(api_key);
    let tools = default_tools();
    let engine = QueryEngine::new(context, tools);
    
    match args.command {
        cli::Commands::Chat { query } => {
            if let Some(q) = query {
                let cwd = std::env::current_dir()?.to_string_lossy().to_string();
                let session_id = claude_core::SessionId::new();
                let result = engine.process(&session_id, &q).await?;
                
                for block in &result.content {
                    match block {
                        claude_core::ContentBlock::Text { text } => println!("{}", text),
                        _ => {}
                    }
                }
            } else {
                run_interactive(engine).await?;
            }
        }
    }
    
    Ok(())
}

/// Run interactive mode
async fn run_interactive(_engine: QueryEngine) -> Result<()> {
    println!("Claude Code - Interactive Mode");
    println!("Type 'exit' or 'quit' to exit.\n");
    
    loop {
        print!("> ");
        use std::io::Write;
        std::io::stdout().flush()?;
        
        let mut input = String::new();
        std::io::stdin().read_line(&mut input)?;
        
        let input = input.trim();
        
        if input.is_empty() {
            continue;
        }
        
        if input == "exit" || input == "quit" {
            println!("Goodbye!");
            break;
        }
        
        println!("Processing: {}\n", input);
    }
    
    Ok(())
}

use clap::Parser;

