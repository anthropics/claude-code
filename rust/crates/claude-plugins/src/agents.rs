//! Agent System - Parallel agent execution with confidence scoring
//!
//! Agents are specialized AI workers that can be invoked in parallel.
//! They return results with confidence scores for quality filtering.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Semaphore;
use tracing::{debug, error, info, warn};

/// Agent execution result with confidence scoring
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AgentResult {
    pub agent_name: String,
    pub content: String,
    pub confidence: f32, // 0.0 to 1.0
    pub issues: Vec<Issue>,
    pub metadata: HashMap<String, String>,
    pub execution_time_ms: u64,
}

/// Issue found by an agent
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Issue {
    pub severity: IssueSeverity,
    pub confidence: f32,
    pub file_path: Option<String>,
    pub line_number: Option<u32>,
    pub message: String,
    pub suggestion: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum IssueSeverity {
    Critical,
    High,
    Medium,
    Low,
    Info,
}

/// Agent executor - runs agents in parallel
pub struct AgentExecutor {
    concurrency_limit: Arc<Semaphore>,
    api_client: Arc<dyn ApiClient>,
}

/// API client trait for agent LLM calls
trait ApiClient: Send + Sync {
    async fn complete(&self, request: CompletionRequest) -> anyhow::Result<CompletionResponse>;
}

struct CompletionRequest {
    model: String,
    system_prompt: String,
    user_prompt: String,
    temperature: f32,
    max_tokens: u32,
}

struct CompletionResponse {
    content: String,
    usage: TokenUsage,
}

struct TokenUsage {
    prompt_tokens: u32,
    completion_tokens: u32,
}

impl AgentExecutor {
    pub fn new(max_concurrent: usize, api_client: Arc<dyn ApiClient>) -> Self {
        Self {
            concurrency_limit: Arc::new(Semaphore::new(max_concurrent)),
            api_client,
        }
    }

    /// Execute multiple agents in parallel
    pub async fn execute_parallel(
        &self,
        agents: Vec<AgentInvocation>,
    ) -> Vec<AgentResult> {
        let mut handles = vec![];

        for agent in agents {
            let permit = self.concurrency_limit.clone().acquire_owned().await.unwrap();
            let api = self.api_client.clone();
            
            let handle = tokio::spawn(async move {
                let _permit = permit; // Keep permit alive
                Self::execute_single(agent, api).await
            });
            
            handles.push(handle);
        }

        let mut results = vec![];
        for handle in handles {
            match handle.await {
                Ok(result) => results.push(result),
                Err(e) => {
                    warn!("Agent task panicked: {}", e);
                }
            }
        }

        results
    }

    /// Execute a single agent
    async fn execute_single(
        invocation: AgentInvocation,
        api: Arc<dyn ApiClient>,
    ) -> AgentResult {
        let start = std::time::Instant::now();
        
        let request = CompletionRequest {
            model: invocation.model.unwrap_or_else(|| "claude-3-sonnet".to_string()),
            system_prompt: invocation.system_prompt,
            user_prompt: invocation.user_prompt,
            temperature: invocation.temperature.unwrap_or(0.3),
            max_tokens: invocation.max_tokens.unwrap_or(4000),
        };

        match api.complete(request).await {
            Ok(response) => {
                // Parse confidence and issues from response
                let (content, confidence, issues) = Self::parse_response(&response.content);
                
                AgentResult {
                    agent_name: invocation.name,
                    content,
                    confidence,
                    issues,
                    metadata: HashMap::new(),
                    execution_time_ms: start.elapsed().as_millis() as u64,
                }
            }
            Err(e) => AgentResult {
                agent_name: invocation.name,
                content: format!("Error: {}", e),
                confidence: 0.0,
                issues: vec![],
                metadata: HashMap::new(),
                execution_time_ms: start.elapsed().as_millis() as u64,
            },
        }
    }

    /// Parse agent response to extract confidence and issues
    fn parse_response(content: &str) -> (String, f32, Vec<Issue>) {
        // Default confidence
        let mut confidence = 0.8;
        let mut issues = vec![];

        // Look for confidence marker: [Confidence: 0.95]
        let confidence_regex = regex::Regex::new(r"\[Confidence:\s*([0-9.]+)\]").unwrap();
        if let Some(cap) = confidence_regex.captures(content) {
            if let Some(num) = cap.get(1) {
                if let Ok(val) = num.as_str().parse::<f32>() {
                    confidence = val.clamp(0.0, 1.0);
                }
            }
        }

        // Parse issues in format: [Issue: severity] message at file:line
        let issue_regex = regex::Regex::new(
            r"(?m)^\s*[-*]\s*(?:\[(Issue|CRITICAL|HIGH|MEDIUM|LOW):\s*(Critical|High|Medium|Low)\])?\s*(.+?)(?:\s+at\s+([\w./-]+)(?::(\d+))?)?$"
        ).unwrap();

        for cap in issue_regex.captures_iter(content) {
            let severity = cap.get(2)
                .map(|m| match m.as_str() {
                    "Critical" => IssueSeverity::Critical,
                    "High" => IssueSeverity::High,
                    "Medium" => IssueSeverity::Medium,
                    "Low" => IssueSeverity::Low,
                    _ => IssueSeverity::Info,
                })
                .unwrap_or(IssueSeverity::Medium);

            let message = cap.get(3)
                .map(|m| m.as_str().to_string())
                .unwrap_or_default();

            let file_path = cap.get(4).map(|m| m.as_str().to_string());
            let line_number = cap.get(5).and_then(|m| m.as_str().parse().ok());

            issues.push(Issue {
                severity,
                confidence,
                file_path,
                line_number,
                message,
                suggestion: None,
            });
        }

        (content.to_string(), confidence, issues)
    }

    /// Filter results by confidence threshold
    pub fn filter_by_confidence(results: Vec<AgentResult>, threshold: f32) -> Vec<AgentResult> {
        results
            .into_iter()
            .filter(|r| r.confidence >= threshold)
            .collect()
    }

    /// Consolidate results from multiple agents
    pub fn consolidate_results(results: Vec<AgentResult>) -> ConsolidatedResult {
        let mut all_issues = vec![];
        let mut all_findings = vec![];
        let mut total_confidence = 0.0;

        for result in &results {
            all_issues.extend(result.issues.clone());
            all_findings.push((result.agent_name.clone(), result.content.clone()));
            total_confidence += result.confidence;
        }

        // Sort issues by severity
        all_issues.sort_by(|a, b| {
            let severity_order = |s: &IssueSeverity| match s {
                IssueSeverity::Critical => 0,
                IssueSeverity::High => 1,
                IssueSeverity::Medium => 2,
                IssueSeverity::Low => 3,
                IssueSeverity::Info => 4,
            };
            severity_order(&a.severity).cmp(&severity_order(&b.severity))
        });

        let avg_confidence = if !results.is_empty() {
            total_confidence / results.len() as f32
        } else {
            0.0
        };

        ConsolidatedResult {
            issues: all_issues,
            findings: all_findings,
            average_confidence: avg_confidence,
            agents_ran: results.len(),
        }
    }
}

/// Agent invocation parameters
pub struct AgentInvocation {
    pub name: String,
    pub system_prompt: String,
    pub user_prompt: String,
    pub model: Option<String>,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
}

/// Consolidated result from multiple agents
pub struct ConsolidatedResult {
    pub issues: Vec<Issue>,
    pub findings: Vec<(String, String)>,
    pub average_confidence: f32,
    pub agents_ran: usize,
}

/// Built-in agents for common tasks
pub mod builtin_agents {
    use super::*;

    /// Code explorer agent - traces execution paths
    pub fn code_explorer(feature: &str) -> AgentInvocation {
        AgentInvocation {
            name: "code-explorer".to_string(),
            system_prompt: CODE_EXPLORER_PROMPT.to_string(),
            user_prompt: format!("Trace how '{}' is implemented in this codebase. Find entry points, execution flows, and key files.", feature),
            model: Some("claude-3-sonnet".to_string()),
            temperature: Some(0.3),
            max_tokens: Some(4000),
        }
    }

    const CODE_EXPLORER_PROMPT: &str = r#"
You are a code exploration expert. Your task is to deeply analyze existing codebase features.

Analyze the codebase to find:
1. Entry points and call chains for the feature
2. Data flow and transformations
3. Architecture layers and patterns
4. Dependencies and integrations
5. Implementation details

Output format:
- List entry points with file:line references
- Describe step-by-step execution flow
- Identify key components and their responsibilities
- Provide architecture insights
- List all essential files to read

[Confidence: 0.95]
"#;

    /// Code architect agent - designs feature architecture
    pub fn code_architect(feature: &str, approach: &str) -> AgentInvocation {
        AgentInvocation {
            name: format!("code-architect-{}", approach),
            system_prompt: CODE_ARCHITECT_PROMPT.to_string(),
            user_prompt: format!("Design the architecture for '{}' with a {} approach. Consider existing patterns and conventions.", feature, approach),
            model: Some("claude-3-opus".to_string()),
            temperature: Some(0.4),
            max_tokens: Some(4000),
        }
    }

    const CODE_ARCHITECT_PROMPT: &str = r#"
You are a senior software architect. Design feature architectures that integrate seamlessly with existing codebases.

For each design:
1. Analyze existing codebase patterns and conventions
2. Make thoughtful architecture decisions with rationale
3. Design complete component structures
4. Provide implementation roadmap
5. Define data flow and build sequence

Output format:
- Patterns and conventions found
- Architecture decision with rationale
- Complete component design
- Implementation map with specific files
- Build sequence with phases

[Confidence: 0.90]
"#;

    /// Code reviewer agent - finds bugs and quality issues
    pub fn code_reviewer(focus: &str) -> AgentInvocation {
        AgentInvocation {
            name: format!("code-reviewer-{}", focus),
            system_prompt: CODE_REVIEWER_PROMPT.to_string(),
            user_prompt: format!("Review the recent code changes with focus on: {}", focus),
            model: Some("claude-3-sonnet".to_string()),
            temperature: Some(0.2),
            max_tokens: Some(4000),
        }
    }

    const CODE_REVIEWER_PROMPT: &str = r#"
You are a meticulous code reviewer. Find bugs, quality issues, and ensure project conventions are followed.

Review checklist:
- Check CLAUDE.md compliance
- Detect potential bugs and logic errors
- Identify code quality issues
- Verify project standards

Output format:
For each issue found, report:
[Issue: severity] message at file:line
- Severity: Critical, High, Medium, or Low
- Confidence level (only report if ≥ 0.80)
- Specific fix with file:line reference
- Project guideline reference

Only report high-confidence issues.
[Confidence: 0.85]
"#;

    /// Bug hunter agent - finds silent failures
    pub fn bug_hunter() -> AgentInvocation {
        AgentInvocation {
            name: "silent-failure-hunter".to_string(),
            system_prompt: BUG_HUNTER_PROMPT.to_string(),
            user_prompt: "Find silent failures, edge cases, and error handling gaps in the recent changes.".to_string(),
            model: Some("claude-3-sonnet".to_string()),
            temperature: Some(0.2),
            max_tokens: Some(4000),
        }
    }

    const BUG_HUNTER_PROMPT: &str = r#"
You are a bug detection specialist focused on silent failures and edge cases.

Look for:
1. Uncaught exceptions
2. Silent failures (operations that fail but don't report)
3. Edge cases not handled
4. Error handling gaps
5. Resource leaks

Output each issue as:
[Issue: severity] description at file:line

[Confidence: 0.88]
"#;

    /// Type design analyzer
    pub fn type_design_analyzer() -> AgentInvocation {
        AgentInvocation {
            name: "type-design-analyzer".to_string(),
            system_prompt: TYPE_DESIGN_PROMPT.to_string(),
            user_prompt: "Analyze type design in the recent changes. Check for proper Option/Result usage, generic bounds, and type safety.".to_string(),
            model: Some("claude-3-sonnet".to_string()),
            temperature: Some(0.2),
            max_tokens: Some(3000),
        }
    }

    const TYPE_DESIGN_PROMPT: &str = r#"
You are a type system expert. Analyze type design for correctness and ergonomics.

Check for:
1. Proper use of Option/Result types
2. Generic bounds are correct
3. Type safety is maintained
4. API ergonomics
5. Performance implications of type choices

Report issues as:
[Issue: severity] description at file:line

[Confidence: 0.82]
"#;
}

