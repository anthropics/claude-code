//! Interactive REPL for Claude Code

use crate::app::App;
use crate::conversation::ConversationManager;
use anyhow::{Context, Result};
use claude_api::{ContentBlock, MessageRequestBuilder};
use claude_core::{ToolInput, ToolResult};
use std::io::{self, Write};

/// Interactive REPL
pub struct Repl {
    app: App,
    conversation: ConversationManager,
    max_turns: usize,
}

impl Repl {
    /// Create a new REPL
    pub fn new(app: App, max_turns: usize) -> Self {
        Self {
            app,
            conversation: ConversationManager::new(),
            max_turns,
        }
    }

    /// Run the REPL
    pub async fn run(&mut self) -> Result<()> {
        println!("Claude Code (Rust) - Interactive Mode");
        println!("Type 'exit' to quit, 'clear' to clear conversation\n");

        let mut turn = 0;

        loop {
            // Get user input
            print!("> ");
            io::stdout().flush()?;

            let mut input = String::new();
            io::stdin().read_line(&mut input)?;
            let input = input.trim();

            // Handle special commands
            match input {
                "exit" | "quit" => {
                    println!("Goodbye!");
                    break;
                }
                "clear" => {
                    self.conversation.clear();
                    println!("Conversation cleared.");
                    continue;
                }
                "" => continue,
                _ => {}
            }

            // Add user message
            self.conversation.add_user_message(input);

            // Process with Claude
            if let Err(e) = self.process_message().await {
                eprintln!("Error: {}", e);
                continue;
            }

            turn += 1;
            if turn >= self.max_turns {
                println!(
                    "\nReached maximum turns ({}). Use 'clear' to start a new conversation.",
                    self.max_turns
                );
                break;
            }
        }

        Ok(())
    }

    /// Process a message and handle tool use
    async fn process_message(&mut self) -> Result<()> {
        // Use default model (Sonnet)
        let model = claude_api::Model::Sonnet;

        let mut request = MessageRequestBuilder::new(model);

        // Add system prompt
        if let Some(system) = self.conversation.system_prompt() {
            request = request.system(system);
        }

        // Add messages
        for message in self.conversation.messages() {
            request = request.message(message.clone());
        }

        // Note: Tools would be added here in a full implementation
        // For now, skip tools to get the basic flow working

        // Build and send request
        let req = request.build();
        let response = self
            .app
            .api_client
            .create_message(req)
            .await
            .context("Failed to send message")?;

        // Process response
        let mut text_parts = Vec::new();
        let mut tool_uses = Vec::new();

        for block in &response.content {
            match block {
                ContentBlock::Text { text } => {
                    text_parts.push(text.clone());
                }
                ContentBlock::ToolUse { id, name, input } => {
                    tool_uses.push((id.clone(), name.clone(), input.clone()));
                }
                _ => {}
            }
        }

        // Display text response
        if !text_parts.is_empty() {
            println!("\n{}\n", text_parts.join("\n"));
        }

        // Execute tools if any
        if !tool_uses.is_empty() {
            for (tool_id, tool_name, input) in tool_uses {
                println!("Executing tool: {} ...", tool_name);

                let tool_input = ToolInput::new(input.clone()).unwrap_or_else(|_| ToolInput {
                    parameters: input.clone(),
                });

                let result = self
                    .app
                    .tool_registry
                    .execute(&tool_name, tool_input)
                    .await
                    .unwrap_or_else(|e| ToolResult {
                        success: false,
                        output: None,
                        error: Some(e.to_string()),
                        metadata: std::collections::HashMap::new(),
                    });

                // Add tool result to conversation
                self.conversation.add_tool_result(tool_id, &result);

                if result.success {
                    println!("✓ Tool executed successfully");
                } else {
                    println!("✗ Tool failed: {}", result.error.unwrap_or_default());
                }
            }

            // Continue conversation to get Claude's response to tool results
            Box::pin(self.process_message()).await?;
        }

        // Add assistant response to conversation
        if !text_parts.is_empty() {
            self.conversation
                .add_assistant_message(text_parts.join("\n"));
        }

        Ok(())
    }
}
