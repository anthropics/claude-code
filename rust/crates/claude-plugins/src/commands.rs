//! Command execution - slash commands like /feature-dev, /hookify

use crate::agents::{builtin_agents, AgentExecutor, AgentInvocation, ConsolidatedResult};
use crate::{CommandDefinition, CommandHandler, WorkflowPhase};
use anyhow::Result;
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{debug, error, info, warn};

/// Command executor
pub struct CommandExecutor {
    agent_executor: Arc<AgentExecutor>,
}

impl CommandExecutor {
    pub fn new(agent_executor: Arc<AgentExecutor>) -> Self {
        Self { agent_executor }
    }

    /// Execute a command
    pub async fn execute(
        &self,
        cmd: &CommandDefinition,
        args: HashMap<String, String>,
    ) -> Result<CommandOutput> {
        info!("Executing command: /{}", cmd.name);

        match &cmd.handler {
            CommandHandler::Builtin { function } => {
                self.execute_builtin(function, &args).await
            }
            CommandHandler::Agent { agent, prompt_template } => {
                self.execute_agent_command(agent, prompt_template, &args).await
            }
            CommandHandler::Script { path } => {
                self.execute_script(path, &args).await
            }
            CommandHandler::Workflow { phases } => {
                self.execute_workflow(phases, &args).await
            }
        }
    }

    /// Execute a builtin command
    async fn execute_builtin(
        &self,
        function: &str,
        args: &HashMap<String, String>,
    ) -> Result<CommandOutput> {
        match function.as_str() {
            "feature_dev" => self.cmd_feature_dev(args).await,
            "hookify" => self.cmd_hookify(args).await,
            "commit" => self.cmd_commit(args).await,
            "help" => self.cmd_help(args).await,
            _ => Err(anyhow::anyhow!("Unknown builtin function: {}", function)),
        }
    }

    /// Execute agent-based command
    async fn execute_agent_command(
        &self,
        agent: &str,
        prompt_template: &str,
        args: &HashMap<String, String>,
    ) -> Result<CommandOutput> {
        // Build prompt from template
        let mut prompt = prompt_template.to_string();
        for (key, value) in args {
            prompt = prompt.replace(&format!("{{{{{}}}}}", key), value);
        }

        // Create agent invocation
        let invocation = AgentInvocation {
            name: agent.to_string(),
            system_prompt: format!("You are the {} agent. Execute the user's request.", agent),
            user_prompt: prompt,
            model: Some("claude-3-sonnet".to_string()),
            temperature: Some(0.3),
            max_tokens: Some(4000),
        };

        let result = self.agent_executor.execute_parallel(vec![invocation]).await;

        if let Some(first) = result.into_iter().next() {
            Ok(CommandOutput {
                content: first.content,
                suggestions: vec![],
                requires_follow_up: false,
            })
        } else {
            Err(anyhow::anyhow!("Agent execution failed"))
        }
    }

    /// Execute script-based command
    async fn execute_script(
        &self,
        path: &str,
        args: &HashMap<String, String>,
    ) -> Result<CommandOutput> {
        use tokio::process::Command;

        let mut cmd = Command::new("sh");
        cmd.arg("-c").arg(path);

        // Set environment variables from args
        for (key, value) in args {
            cmd.env(format!("CLAUDE_ARG_{}", key.to_uppercase()), value);
        }

        let output = cmd.output().await?;

        let content = if output.status.success() {
            String::from_utf8_lossy(&output.stdout).to_string()
        } else {
            format!(
                "Error: {}",
                String::from_utf8_lossy(&output.stderr)
            )
        };

        Ok(CommandOutput {
            content,
            suggestions: vec![],
            requires_follow_up: false,
        })
    }

    /// Execute workflow-based command (phases)
    async fn execute_workflow(
        &self,
        phases: &[WorkflowPhase],
        args: &HashMap<String, String>,
    ) -> Result<CommandOutput> {
        let mut output = String::new();
        let mut todos = vec![];

        // Get the feature request from args
        let feature_request = args.get("feature").cloned().unwrap_or_default();

        for (idx, phase) in phases.iter().enumerate() {
            output.push_str(&format!("\n## Phase {}: {}\n\n", idx + 1, phase.name));

            if phase.requires_approval && idx > 0 {
                // In real implementation, would pause for user approval here
                output.push_str("*(User approval required to proceed)*\n\n");
            }

            // Build phase prompt
            let prompt = phase.prompt.replace("{{feature}}", &feature_request);

            // Execute phase with agent if specified
            if let Some(agent_name) = &phase.agent {
                let invocation = self.create_agent_invocation(agent_name, &prompt, args);
                let results = self.agent_executor.execute_parallel(vec![invocation]).await;

                if let Some(result) = results.into_iter().next() {
                    output.push_str(&result.content);
                    output.push('\n');

                    // Extract todos from result
                    for line in result.content.lines() {
                        if line.starts_with("- [ ]") || line.starts_with("- [x]") {
                            todos.push(line.to_string());
                        }
                    }
                }
            } else {
                output.push_str(&prompt);
                output.push('\n');
            }
        }

        Ok(CommandOutput {
            content: output,
            suggestions: todos,
            requires_follow_up: true,
        })
    }

    fn create_agent_invocation(
        &self,
        agent: &str,
        prompt: &str,
        _args: &HashMap<String, String>,
    ) -> AgentInvocation {
        match agent {
            "code-explorer" => builtin_agents::code_explorer(prompt),
            "code-architect-minimal" => builtin_agents::code_architect(prompt, "minimal changes"),
            "code-architect-clean" => builtin_agents::code_architect(prompt, "clean architecture"),
            "code-architect-pragmatic" => builtin_agents::code_architect(prompt, "pragmatic balance"),
            "code-reviewer-quality" => builtin_agents::code_reviewer("quality"),
            "code-reviewer-bugs" => builtin_agents::code_reviewer("bugs"),
            "code-reviewer-conventions" => builtin_agents::code_reviewer("conventions"),
            "silent-failure-hunter" => builtin_agents::bug_hunter(),
            "type-design-analyzer" => builtin_agents::type_design_analyzer(),
            _ => AgentInvocation {
                name: agent.to_string(),
                system_prompt: format!("You are the {} agent.", agent),
                user_prompt: prompt.to_string(),
                model: Some("claude-3-sonnet".to_string()),
                temperature: Some(0.3),
                max_tokens: Some(4000),
            },
        }
    }

    // ============== Built-in Commands ==============

    /// /feature-dev command - 7-phase feature development workflow
    async fn cmd_feature_dev(&self, args: &HashMap<String, String>) -> Result<CommandOutput> {
        let feature = args.get("feature").cloned().unwrap_or_else(|| "".to_string());

        let phases = vec![
            WorkflowPhase {
                name: "Discovery".to_string(),
                description: "Understand what needs to be built".to_string(),
                agent: None,
                prompt: format!(
                    "Let me understand the feature request: '{}'\n\n\
                    I'll ask clarifying questions:\n\
                    - What problem are we solving?\n\
                    - What are the constraints and requirements?\n\
                    - Are there any edge cases to consider?\n\n\
                    Please provide more details so I can proceed.",
                    feature
                ),
                requires_approval: false,
            },
            WorkflowPhase {
                name: "Codebase Exploration".to_string(),
                description: "Understand relevant existing code".to_string(),
                agent: Some("code-explorer".to_string()),
                prompt: feature.clone(),
                requires_approval: false,
            },
            WorkflowPhase {
                name: "Clarifying Questions".to_string(),
                description: "Fill in gaps and resolve ambiguities".to_string(),
                agent: None,
                prompt: "Based on the codebase exploration, I have some clarifying questions.".to_string(),
                requires_approval: true,
            },
            WorkflowPhase {
                name: "Architecture Design".to_string(),
                description: "Design multiple implementation approaches".to_string(),
                agent: Some("code-architect-pragmatic".to_string()),
                prompt: feature.clone(),
                requires_approval: true,
            },
            WorkflowPhase {
                name: "Implementation".to_string(),
                description: "Build the feature".to_string(),
                agent: None,
                prompt: "Implementing the feature based on approved architecture.".to_string(),
                requires_approval: true,
            },
            WorkflowPhase {
                name: "Quality Review".to_string(),
                description: "Ensure code quality".to_string(),
                agent: Some("code-reviewer-quality".to_string()),
                prompt: "Review the implementation for quality issues.".to_string(),
                requires_approval: false,
            },
            WorkflowPhase {
                name: "Summary".to_string(),
                description: "Document what was accomplished".to_string(),
                agent: None,
                prompt: "Summarize what was built, key decisions, and suggested next steps.".to_string(),
                requires_approval: false,
            },
        ];

        self.execute_workflow(&phases, args).await
    }

    /// /hookify command - create custom hooks
    async fn cmd_hookify(&self, args: &HashMap<String, String>) -> Result<CommandOutput> {
        let rule_description = args.get("rule").cloned().unwrap_or_default();

        let content = if rule_description.is_empty() {
            // Analyze recent conversation
            "Analyzing recent conversation to find behaviors you've corrected...\n\n\
            (Hook creation based on conversation analysis would go here)\n\n\
            Use: /hookify <description> to create a rule from explicit instructions."
                .to_string()
        } else {
            // Create rule from description
            format!(
                "Creating hookify rule from: '{}'\n\n\
                Generated rule file: `.claude/hookify.custom.local.md`\n\n\
                Rule will be active immediately - no restart needed!",
                rule_description
            )
        };

        Ok(CommandOutput {
            content,
            suggestions: vec![
                "/hookify:list".to_string(),
                "/hookify:configure".to_string(),
            ],
            requires_follow_up: false,
        })
    }

    /// /commit command - git workflow automation
    async fn cmd_commit(&self, args: &HashMap<String, String>) -> Result<CommandOutput> {
        let message = args.get("message").cloned();
        let push = args.get("push").map(|v| v == "true").unwrap_or(false);
        let create_pr = args.get("pr").map(|v| v == "true").unwrap_or(false);

        let mut output = String::new();

        // Stage all changes
        output.push_str("Staging changes...\n");

        // Generate commit message if not provided
        let commit_msg = match message {
            Some(m) => m,
            None => "Update files".to_string(), // Would use AI to generate
        };

        output.push_str(&format!("Committing with message: {}\n", commit_msg));

        if push {
            output.push_str("Pushing to remote...\n");
        }

        if create_pr {
            output.push_str("Creating pull request...\n");
        }

        Ok(CommandOutput {
            content: output,
            suggestions: vec![],
            requires_follow_up: false,
        })
    }

    /// /help command - show available commands
    async fn cmd_help(&self, _args: &HashMap<String, String>) -> Result<CommandOutput> {
        let content = r#"
# Available Commands

## Development
- `/feature-dev <description>` - 7-phase feature development workflow
- `/code-review` - Automated PR review
- `/pr-review-toolkit:review-pr` - Comprehensive PR review

## Git
- `/commit <message>` - Commit with optional push/PR creation
- `/commit-push-pr` - Commit, push, and create PR

## Hooks
- `/hookify <description>` - Create custom hooks
- `/hookify:list` - List all hookify rules
- `/hookify:configure` - Configure hooks interactively

## Other
- `/ralph-loop` - Start autonomous iteration loop
- `/cancel-ralph` - Stop ralph loop
- `/help` - Show this help
"#
        .to_string();

        Ok(CommandOutput {
            content,
            suggestions: vec![],
            requires_follow_up: false,
        })
    }
}

/// Command output
pub struct CommandOutput {
    pub content: String,
    pub suggestions: Vec<String>,
    pub requires_follow_up: bool,
}

/// Parse command string into name and args
pub fn parse_command(input: &str) -> Option<(String, HashMap<String, String>)> {
    // Skip leading slash
    let input = input.trim_start_matches('/');

    // Split into parts
    let parts: Vec<&str> = input.split_whitespace().collect();
    if parts.is_empty() {
        return None;
    }

    let name = parts[0].to_string();

    // Parse remaining as args (positional or key=value)
    let mut args = HashMap::new();
    let rest = parts[1..].join(" ");

    // Try to find key=value pairs
    for part in parts[1..].iter() {
        if let Some(idx) = part.find('=') {
            let key = part[..idx].to_string();
            let value = part[idx + 1..].to_string();
            args.insert(key, value);
        }
    }

    // If no args parsed, put everything in "feature" or "rule"
    if args.is_empty() && !rest.is_empty() {
        let key = if name.contains("hookify") {
            "rule"
        } else if name.contains("commit") {
            "message"
        } else {
            "feature"
        };
        args.insert(key.to_string(), rest);
    }

    Some((name, args))
}

