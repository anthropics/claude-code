//! CLAUDE.md parser and compliance checker

use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tracing::{debug, error, info, warn};

/// CLAUDE.md structure
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct ClaudeMd {
    pub path: PathBuf,
    pub project_context: Option<String>,
    pub build_commands: Vec<BuildCommand>,
    pub common_workflows: Vec<Workflow>,
    pub code_patterns: Vec<CodePattern>,
    pub testing: TestingConfig,
    pub architecture: ArchitectureConfig,
    pub documentation: DocumentationConfig,
    pub rules: Vec<Rule>,
    pub raw_content: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct BuildCommand {
    pub name: String,
    pub command: String,
    pub description: String,
    pub run_on_save: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Workflow {
    pub name: String,
    pub steps: Vec<String>,
    pub description: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CodePattern {
    pub name: String,
    pub pattern: String,
    pub usage: String,
    pub examples: Vec<String>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct TestingConfig {
    pub test_command: String,
    pub test_patterns: Vec<String>,
    pub coverage_required: bool,
    pub coverage_threshold: Option<f32>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct ArchitectureConfig {
    pub preferred_patterns: Vec<String>,
    pub forbidden_patterns: Vec<String>,
    pub layering_rules: Vec<LayerRule>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct LayerRule {
    pub layer: String,
    pub can_import_from: Vec<String>,
    pub cannot_import_from: Vec<String>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct DocumentationConfig {
    pub require_doc_comments: bool,
    pub doc_style: String,
    pub readme_sections: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Rule {
    pub category: RuleCategory,
    pub description: String,
    pub severity: RuleSeverity,
    pub pattern: Option<Regex>,
    pub check: Box<dyn Fn(&str) -> bool>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RuleCategory {
    Naming,
    Formatting,
    Architecture,
    Testing,
    Security,
    Performance,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RuleSeverity {
    Error,
    Warning,
    Info,
}

/// Parser for CLAUDE.md files
pub struct ClaudeMdParser;

impl ClaudeMdParser {
    pub fn new() -> Self {
        Self
    }

    /// Parse a CLAUDE.md file
    pub fn parse(&self, path: &Path) -> anyhow::Result<ClaudeMd> {
        let content = std::fs::read_to_string(path)?;
        self.parse_content(path.to_path_buf(), &content)
    }

    /// Parse content directly
    pub fn parse_content(&self, path: PathBuf, content: &str) -> anyhow::Result<ClaudeMd> {
        let mut claude_md = ClaudeMd {
            path,
            raw_content: content.to_string(),
            ..Default::default()
        };

        // Extract sections
        let sections = self.extract_sections(content);

        for (title, body) in sections {
            match title.to_lowercase().as_str() {
                "project context" | "context" => {
                    claude_md.project_context = Some(body.trim().to_string());
                }
                "build commands" | "build" => {
                    claude_md.build_commands = self.parse_build_commands(&body);
                }
                "common workflows" | "workflows" => {
                    claude_md.common_workflows = self.parse_workflows(&body);
                }
                "code patterns" | "patterns" => {
                    claude_md.code_patterns = self.parse_code_patterns(&body);
                }
                "testing" => {
                    claude_md.testing = self.parse_testing(&body);
                }
                "architecture" => {
                    claude_md.architecture = self.parse_architecture(&body);
                }
                "documentation" => {
                    claude_md.documentation = self.parse_documentation(&body);
                }
                "rules" => {
                    claude_md.rules = self.parse_rules(&body);
                }
                _ => {}
            }
        }

        Ok(claude_md)
    }

    /// Extract sections from markdown
    fn extract_sections(&self, content: &str) -> Vec<(String, String)> {
        let mut sections = vec![];
        let header_regex = Regex::new(r"(?m)^##\s+(.+)$").unwrap();

        let mut last_pos = 0;
        let mut current_title = String::new();

        for cap in header_regex.captures_iter(content) {
            let pos = cap.get(0).unwrap().start();
            let title = cap.get(1).unwrap().as_str().to_string();

            if !current_title.is_empty() {
                let body = content[last_pos..pos].trim().to_string();
                sections.push((current_title, body));
            }

            current_title = title;
            last_pos = cap.get(0).unwrap().end();
        }

        // Add last section
        if !current_title.is_empty() && last_pos < content.len() {
            let body = content[last_pos..].trim().to_string();
            sections.push((current_title, body));
        }

        sections
    }

    fn parse_build_commands(&self, body: &str) -> Vec<BuildCommand> {
        let mut commands = vec![];
        let cmd_regex = Regex::new(r"`([^`]+)`\s*-\s*(.+?)(?:\n|$)").unwrap();

        for cap in cmd_regex.captures_iter(body) {
            commands.push(BuildCommand {
                name: cap.get(1).unwrap().as_str().to_string(),
                command: cap.get(1).unwrap().as_str().to_string(),
                description: cap.get(2).unwrap().as_str().to_string(),
                run_on_save: body.contains("run on save"),
            });
        }

        commands
    }

    fn parse_workflows(&self, body: &str) -> Vec<Workflow> {
        let mut workflows = vec![];
        // Simple parsing for now
        let lines: Vec<&str> = body.lines().collect();
        let mut current_name = String::new();
        let mut current_steps = vec![];

        for line in &lines {
            if line.starts_with("### ") || line.starts_with("**") {
                if !current_name.is_empty() {
                    workflows.push(Workflow {
                        name: current_name.clone(),
                        steps: current_steps.clone(),
                        description: String::new(),
                    });
                }
                current_name = line
                    .trim_start_matches("### ")
                    .trim_start_matches("**")
                    .trim_end_matches("**")
                    .to_string();
                current_steps.clear();
            } else if line.starts_with("1.") || line.starts_with("- ") {
                current_steps.push(line.to_string());
            }
        }

        if !current_name.is_empty() {
            workflows.push(Workflow {
                name: current_name,
                steps: current_steps,
                description: String::new(),
            });
        }

        workflows
    }

    fn parse_code_patterns(&self, body: &str) -> Vec<CodePattern> {
        let mut patterns = vec![];
        let pattern_regex = Regex::new(r"###\s*(.+?)\n\n`{3}(\w+)?\n([\s\S]*?)`{3}").unwrap();

        for cap in pattern_regex.captures_iter(body) {
            patterns.push(CodePattern {
                name: cap.get(1).unwrap().as_str().to_string(),
                pattern: cap.get(3).unwrap().as_str().to_string(),
                usage: String::new(),
                examples: vec![],
            });
        }

        patterns
    }

    fn parse_testing(&self, body: &str) -> TestingConfig {
        let mut config = TestingConfig::default();

        if let Some(cap) = Regex::new(r"Test command:\s*`([^`]+)`").unwrap().captures(body) {
            config.test_command = cap.get(1).unwrap().as_str().to_string();
        }

        if body.contains("coverage required") {
            config.coverage_required = true;
        }

        config
    }

    fn parse_architecture(&self, body: &str) -> ArchitectureConfig {
        let mut config = ArchitectureConfig::default();

        // Extract preferred patterns
        let preferred_regex = Regex::new(r"-\s*Use\s+(.+)").unwrap();
        for cap in preferred_regex.captures_iter(body) {
            config.preferred_patterns.push(cap.get(1).unwrap().as_str().to_string());
        }

        // Extract forbidden patterns
        let forbidden_regex = Regex::new(r"-\s*Avoid\s+(.+)").unwrap();
        for cap in forbidden_regex.captures_iter(body) {
            config.forbidden_patterns.push(cap.get(1).unwrap().as_str().to_string());
        }

        config
    }

    fn parse_documentation(&self, body: &str) -> DocumentationConfig {
        let mut config = DocumentationConfig::default();

        if body.contains("require doc comments") {
            config.require_doc_comments = true;
        }

        config
    }

    fn parse_rules(&self, _body: &str) -> Vec<Rule> {
        // Parse rules - simplified for now
        vec![]
    }

    /// Find CLAUDE.md in project
    pub fn find_in_project(&self, start_dir: &Path) -> Option<PathBuf> {
        let mut current = Some(start_dir);

        while let Some(dir) = current {
            let claude_md = dir.join("CLAUDE.md");
            if claude_md.exists() {
                return Some(claude_md);
            }

            let claude_dir = dir.join(".claude/CLAUDE.md");
            if claude_dir.exists() {
                return Some(claude_dir);
            }

            current = dir.parent();
        }

        None
    }
}

/// Compliance checker for CLAUDE.md rules
pub struct ComplianceChecker {
    claude_md: ClaudeMd,
}

impl ComplianceChecker {
    pub fn new(claude_md: ClaudeMd) -> Self {
        Self { claude_md }
    }

    /// Check code compliance
    pub fn check_code(&self, file_path: &Path, content: &str) -> Vec<Violation> {
        let mut violations = vec![];

        // Check forbidden patterns
        for pattern in &self.claude_md.architecture.forbidden_patterns {
            if content.contains(pattern) {
                violations.push(Violation {
                    file: file_path.to_path_buf(),
                    line: None,
                    rule: format!("Forbidden pattern: {}", pattern),
                    severity: RuleSeverity::Error,
                    message: format!("Code contains forbidden pattern: {}", pattern),
                    suggestion: None,
                });
            }
        }

        // Check code patterns
        for pattern_def in &self.claude_md.code_patterns {
            // Simple pattern matching
            if !content.contains(&pattern_def.pattern) && content.contains("TODO") {
                // This is a simplified check
            }
        }

        violations
    }

    /// Check if test coverage is sufficient
    pub fn check_tests(&self, test_count: usize, total_lines: usize) -> Vec<Violation> {
        let mut violations = vec![];

        if self.claude_md.testing.coverage_required {
            let ratio = test_count as f32 / total_lines as f32;
            if let Some(threshold) = self.claude_md.testing.coverage_threshold {
                if ratio < threshold {
                    violations.push(Violation {
                        file: PathBuf::from("."),
                        line: None,
                        rule: "Test coverage".to_string(),
                        severity: RuleSeverity::Warning,
                        message: format!(
                            "Test coverage {:.1}% is below threshold {:.1}%",
                            ratio * 100.0,
                            threshold * 100.0
                        ),
                        suggestion: Some("Add more tests".to_string()),
                    });
                }
            }
        }

        violations
    }

    /// Get all applicable rules for a file
    pub fn get_rules_for_file(&self, _file_path: &Path) -> Vec<&Rule> {
        self.claude_md.rules.iter().collect()
    }

    /// Generate compliance report
    pub fn generate_report(&self, violations: &[Violation]) -> String {
        let mut report = String::from("# CLAUDE.md Compliance Report\n\n");

        let errors: Vec<_> = violations.iter().filter(|v| matches!(v.severity, RuleSeverity::Error)).collect();
        let warnings: Vec<_> = violations.iter().filter(|v| matches!(v.severity, RuleSeverity::Warning)).collect();

        report.push_str(&format!("## Summary\n\n"));
        report.push_str(&format!("- {} errors\n", errors.len()));
        report.push_str(&format!("- {} warnings\n\n", warnings.len()));

        if !errors.is_empty() {
            report.push_str("## Errors\n\n");
            for v in &errors {
                report.push_str(&format!("- **{}**: {}\n", v.rule, v.message));
            }
            report.push('\n');
        }

        if !warnings.is_empty() {
            report.push_str("## Warnings\n\n");
            for v in &warnings {
                report.push_str(&format!("- **{}**: {}\n", v.rule, v.message));
            }
        }

        report
    }
}

/// A rule violation
#[derive(Clone, Debug)]
pub struct Violation {
    pub file: PathBuf,
    pub line: Option<usize>,
    pub rule: String,
    pub severity: RuleSeverity,
    pub message: String,
    pub suggestion: Option<String>,
}

