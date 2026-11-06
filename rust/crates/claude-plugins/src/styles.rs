//! Output styles - different response formatting modes

use serde::{Deserialize, Serialize};
use std::fmt::Write;

/// Output style for responses
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum OutputStyle {
    /// Normal, concise output (default)
    Normal,
    /// Detailed explanations of implementation choices
    Explanatory,
    /// Interactive learning mode
    Learning,
    /// Minimal output, code only
    Code,
    /// Documentation-focused output
    Documentation,
    /// Debugging-focused output
    Debug,
}

impl Default for OutputStyle {
    fn default() -> Self {
        OutputStyle::Normal
    }
}

/// Output style configuration
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct OutputStyleConfig {
    pub style: OutputStyle,
    pub show_line_numbers: bool,
    pub syntax_highlighting: bool,
    pub include_file_tree: bool,
    pub show_confidence_scores: bool,
    pub verbose_commands: bool,
    pub color_output: bool,
}

impl Default for OutputStyleConfig {
    fn default() -> Self {
        Self {
            style: OutputStyle::Normal,
            show_line_numbers: true,
            syntax_highlighting: true,
            include_file_tree: false,
            show_confidence_scores: true,
            verbose_commands: false,
            color_output: true,
        }
    }
}

/// Style formatter
pub struct StyleFormatter {
    config: OutputStyleConfig,
}

impl StyleFormatter {
    pub fn new(config: OutputStyleConfig) -> Self {
        Self { config }
    }

    /// Format a response according to the style
    pub fn format(&self, content: &str, context: &FormattingContext) -> String {
        match self.config.style {
            OutputStyle::Normal => self.format_normal(content, context),
            OutputStyle::Explanatory => self.format_explanatory(content, context),
            OutputStyle::Learning => self.format_learning(content, context),
            OutputStyle::Code => self.format_code(content, context),
            OutputStyle::Documentation => self.format_documentation(content, context),
            OutputStyle::Debug => self.format_debug(content, context),
        }
    }

    fn format_normal(&self, content: &str, _context: &FormattingContext) -> String {
        // Clean, concise output
        content.to_string()
    }

    fn format_explanatory(&self, content: &str, context: &FormattingContext) -> String {
        let mut output = String::new();

        // Add educational context
        if let Some(why) = &context.reasoning {
            output.push_str("### Why this approach\n\n");
            output.push_str(why);
            output.push_str("\n\n");
        }

        output.push_str(content);

        // Add patterns section
        if !context.patterns_used.is_empty() {
            output.push_str("\n\n### Patterns used\n\n");
            for pattern in &context.patterns_used {
                output.push_str(&format!("- {}\n", pattern));
            }
        }

        // Add alternatives considered
        if !context.alternatives.is_empty() {
            output.push_str("\n### Alternatives considered\n\n");
            for alt in &context.alternatives {
                output.push_str(&format!("- {}\n", alt));
            }
        }

        output
    }

    fn format_learning(&self, content: &str, context: &FormattingContext) -> String {
        let mut output = String::new();

        output.push_str("## Learning Mode\n\n");

        // Add knowledge check questions
        if !context.learning_questions.is_empty() {
            output.push_str("### Questions to consider\n\n");
            for (i, question) in context.learning_questions.iter().enumerate() {
                output.push_str(&format!("{}. {}\n", i + 1, question));
            }
            output.push('\n');
        }

        output.push_str(content);

        // Add practice exercises
        if !context.exercises.is_empty() {
            output.push_str("\n\n### Try it yourself\n\n");
            for (i, exercise) in context.exercises.iter().enumerate() {
                output.push_str(&format!("{}. {}\n", i + 1, exercise));
            }
        }

        // Add further reading
        if !context.further_reading.is_empty() {
            output.push_str("\n### Further reading\n\n");
            for resource in &context.further_reading {
                output.push_str(&format!("- {}\n", resource));
            }
        }

        output
    }

    fn format_code(&self, content: &str, _context: &FormattingContext) -> String {
        // Strip prose, keep only code
        let mut output = String::new();
        let mut in_code_block = false;

        for line in content.lines() {
            if line.starts_with("```") {
                in_code_block = !in_code_block;
                continue;
            }
            if in_code_block {
                output.push_str(line);
                output.push('\n');
            }
        }

        if output.is_empty() {
            // No code blocks found, return original
            content.to_string()
        } else {
            output
        }
    }

    fn format_documentation(&self, content: &str, context: &FormattingContext) -> String {
        let mut output = String::new();

        output.push_str("# Documentation\n\n");

        // Add overview
        if let Some(overview) = &context.overview {
            output.push_str("## Overview\n\n");
            output.push_str(overview);
            output.push_str("\n\n");
        }

        // Add API reference
        if !context.api_references.is_empty() {
            output.push_str("## API Reference\n\n");
            for (name, desc) in &context.api_references {
                output.push_str(&format!("### `{}`\n\n{}\n\n", name, desc));
            }
        }

        output.push_str("## Implementation\n\n");
        output.push_str(content);

        // Add examples
        if !context.examples.is_empty() {
            output.push_str("\n\n## Examples\n\n");
            for (i, example) in context.examples.iter().enumerate() {
                output.push_str(&format!("### Example {}\n\n{}\n\n", i + 1, example));
            }
        }

        output
    }

    fn format_debug(&self, content: &str, context: &FormattingContext) -> String {
        let mut output = String::new();

        output.push_str("## Debug Output\n\n");

        // Add execution trace
        if !context.execution_trace.is_empty() {
            output.push_str("### Execution Trace\n\n");
            for step in &context.execution_trace {
                output.push_str(&format!("- {}\n", step));
            }
            output.push('\n');
        }

        // Add tool calls
        if !context.tool_calls.is_empty() {
            output.push_str("### Tool Calls\n\n");
            for (tool, params) in &context.tool_calls {
                output.push_str(&format!("**{}**\n", tool));
                output.push_str(&format!("```json\n{}\n```\n\n", params));
            }
        }

        // Add timing info
        if !context.timings.is_empty() {
            output.push_str("### Timing\n\n");
            for (operation, duration) in &context.timings {
                output.push_str(&format!("- {}: {}ms\n", operation, duration));
            }
            output.push('\n');
        }

        output.push_str("### Response\n\n");
        output.push_str(content);

        // Add state
        if !context.state.is_empty() {
            output.push_str("\n\n### State\n\n");
            for (key, value) in &context.state {
                output.push_str(&format!("- {}: {}\n", key, value));
            }
        }

        output
    }
}

/// Context for formatting
#[derive(Clone, Debug, Default)]
pub struct FormattingContext {
    pub reasoning: Option<String>,
    pub patterns_used: Vec<String>,
    pub alternatives: Vec<String>,
    pub learning_questions: Vec<String>,
    pub exercises: Vec<String>,
    pub further_reading: Vec<String>,
    pub overview: Option<String>,
    pub api_references: Vec<(String, String)>,
    pub examples: Vec<String>,
    pub execution_trace: Vec<String>,
    pub tool_calls: Vec<(String, String)>,
    pub timings: Vec<(String, u64)>,
    pub state: Vec<(String, String)>,
}

impl FormattingContext {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_reasoning(mut self, reasoning: &str) -> Self {
        self.reasoning = Some(reasoning.to_string());
        self
    }

    pub fn with_pattern(mut self, pattern: &str) -> Self {
        self.patterns_used.push(pattern.to_string());
        self
    }

    pub fn with_timing(mut self, operation: &str, duration_ms: u64) -> Self {
        self.timings.push((operation.to_string(), duration_ms));
        self
    }
}

/// Style manager for switching between styles
pub struct StyleManager {
    current: OutputStyle,
    configs: std::collections::HashMap<OutputStyle, OutputStyleConfig>,
}

impl StyleManager {
    pub fn new() -> Self {
        let mut configs = std::collections::HashMap::new();
        configs.insert(OutputStyle::Normal, OutputStyleConfig::default());
        configs.insert(OutputStyle::Explanatory, OutputStyleConfig {
            style: OutputStyle::Explanatory,
            ..Default::default()
        });
        configs.insert(OutputStyle::Learning, OutputStyleConfig {
            style: OutputStyle::Learning,
            ..Default::default()
        });
        configs.insert(OutputStyle::Code, OutputStyleConfig {
            style: OutputStyle::Code,
            show_line_numbers: false,
            syntax_highlighting: true,
            ..Default::default()
        });
        configs.insert(OutputStyle::Documentation, OutputStyleConfig {
            style: OutputStyle::Documentation,
            ..Default::default()
        });
        configs.insert(OutputStyle::Debug, OutputStyleConfig {
            style: OutputStyle::Debug,
            verbose_commands: true,
            ..Default::default()
        });

        Self {
            current: OutputStyle::Normal,
            configs,
        }
    }

    pub fn set_style(&mut self, style: OutputStyle) {
        self.current = style;
    }

    pub fn current_style(&self) -> OutputStyle {
        self.current.clone()
    }

    pub fn formatter(&self) -> StyleFormatter {
        let config = self.configs.get(&self.current).cloned().unwrap_or_default();
        StyleFormatter::new(config)
    }

    pub fn format(&self, content: &str, context: &FormattingContext) -> String {
        self.formatter().format(content, context)
    }
}

