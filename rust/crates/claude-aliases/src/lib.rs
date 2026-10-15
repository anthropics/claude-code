//! Tool Alias DSL parser and executor
//!
//! Supports syntax like:
//! - `@deploy: bash "npm run build && npm run deploy"`
//! - `@test: bash "cargo test --workspace"`
//! - `@format: bash "cargo fmt" && bash "cargo clippy"`
//! - `@complex: grep "TODO" --glob="*.rs" | file_edit path="{}" old="TODO" new="DONE"`

use nom::{
    IResult,
    branch::alt,
    bytes::complete::{tag, take_until, take_while1, escaped, is_not},
    character::complete::{char, space0, space1, alphanumeric1, none_of, multispace0},
    combinator::{map, opt, recognize, value, cut},
    multi::{many0, separated_list0, separated_list1},
    sequence::{delimited, preceded, separated_pair, tuple},
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;

/// Errors that can occur when parsing aliases
#[derive(Debug, Error, Clone, PartialEq)]
pub enum AliasError {
    #[error("Parse error at position {position}: {message}")]
    Parse { position: usize, message: String },
    
    #[error("Unknown alias: {0}")]
    UnknownAlias(String),
    
    #[error("Invalid parameter: {0}")]
    InvalidParameter(String),
    
    #[error("Circular alias reference detected: {0}")]
    CircularReference(String),
    
    #[error("Execution error: {0}")]
    Execution(String),
}

/// A single step in an alias pipeline
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AliasStep {
    /// The tool name to invoke
    pub tool: String,
    /// Parameters for the tool
    pub params: HashMap<String, String>,
    /// Whether this step should capture output for next step
    pub capture_output: bool,
}

/// A defined alias with one or more steps
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Alias {
    /// The alias name (e.g., "deploy", "test")
    pub name: String,
    /// Description of what this alias does
    pub description: String,
    /// The steps to execute
    pub steps: Vec<AliasStep>,
    /// Variables that can be substituted
    pub variables: HashMap<String, String>,
}

/// Parser for the Alias DSL
pub struct AliasParser {
    /// Known aliases for reference checking
    known_aliases: HashMap<String, Alias>,
}

impl Default for AliasParser {
    fn default() -> Self {
        Self::new()
    }
}

impl AliasParser {
    /// Create a new parser
    pub fn new() -> Self {
        Self {
            known_aliases: HashMap::new(),
        }
    }
    
    /// Create with pre-defined aliases
    pub fn with_aliases(aliases: HashMap<String, Alias>) -> Self {
        Self {
            known_aliases: aliases,
        }
    }
    
    /// Register an alias
    pub fn register(&mut self, alias: Alias) {
        self.known_aliases.insert(alias.name.clone(), alias);
    }
    
    /// Parse a complete alias definition from DSL text
    /// Format: `@name: description | step1 && step2 && ...`
    pub fn parse_definition(&self, input: &str) -> Result<Alias, AliasError> {
        match parse_alias_definition(input) {
            Ok((remaining, alias)) => {
                if !remaining.trim().is_empty() {
                    return Err(AliasError::Parse {
                        position: input.len() - remaining.len(),
                        message: format!("Unexpected trailing content: {}", remaining),
                    });
                }
                Ok(alias)
            }
            Err(nom::Err::Error(e)) | Err(nom::Err::Failure(e)) => {
                Err(AliasError::Parse {
                    position: e.input.as_ptr() as usize - input.as_ptr() as usize,
                    message: "Failed to parse alias definition".to_string(),
                })
            }
            Err(nom::Err::Incomplete(_)) => {
                Err(AliasError::Parse {
                    position: input.len(),
                    message: "Incomplete alias definition".to_string(),
                })
            }
        }
    }
    
    /// Parse an alias invocation
    /// Format: `@name arg1=value1 arg2="value 2"`
    pub fn parse_invocation(&self, input: &str) -> Result<(String, HashMap<String, String>), AliasError> {
        match parse_alias_invocation(input) {
            Ok((remaining, result)) => {
                if !remaining.trim().is_empty() {
                    return Err(AliasError::Parse {
                        position: input.len() - remaining.len(),
                        message: format!("Unexpected trailing content: {}", remaining),
                    });
                }
                Ok(result)
            }
            Err(nom::Err::Error(e)) | Err(nom::Err::Failure(e)) => {
                Err(AliasError::Parse {
                    position: e.input.as_ptr() as usize - input.as_ptr() as usize,
                    message: "Failed to parse alias invocation".to_string(),
                })
            }
            Err(nom::Err::Incomplete(_)) => {
                Err(AliasError::Parse {
                    position: input.len(),
                    message: "Incomplete alias invocation".to_string(),
                })
            }
        }
    }
    
    /// Expand an alias invocation into concrete steps
    pub fn expand(&self, name: &str, args: HashMap<String, String>) -> Result<Vec<AliasStep>, AliasError> {
        let alias = self.known_aliases.get(name)
            .ok_or_else(|| AliasError::UnknownAlias(name.to_string()))?;
        
        let mut expanded = Vec::new();
        
        for step in &alias.steps {
            let mut params = HashMap::new();
            
            // Merge alias variables
            for (k, v) in &alias.variables {
                params.insert(k.clone(), v.clone());
            }
            
            // Merge step params with variable substitution
            for (k, v) in &step.params {
                let substituted = self.substitute_variables(v, &args)?;
                params.insert(k.clone(), substituted);
            }
            
            expanded.push(AliasStep {
                tool: step.tool.clone(),
                params,
                capture_output: step.capture_output,
            });
        }
        
        Ok(expanded)
    }
    
    /// Substitute ${var} and $var patterns in a string
    fn substitute_variables(&self, input: &str, vars: &HashMap<String, String>) -> Result<String, AliasError> {
        let mut result = input.to_string();
        
        // Replace ${var} patterns
        for (key, value) in vars {
            let pattern = format!("${{{}}}", key);
            result = result.replace(&pattern, value);
        }
        
        // Replace $var patterns (more naive, but works for simple cases)
        for (key, value) in vars {
            let pattern = format!("${}", key);
            // Only replace if not part of a larger ${...} pattern
            result = result.replace(&pattern, value);
        }
        
        // Check for unresolved variables
        if result.contains("${") {
            return Err(AliasError::InvalidParameter(
                format!("Unresolved variable in: {}", result)
            ));
        }
        
        Ok(result)
    }
    
    /// Get all registered aliases
    pub fn aliases(&self) -> &HashMap<String, Alias> {
        &self.known_aliases
    }
}

// ========== Nom Parsers ==========

/// Parse an identifier (alias name, tool name, etc.)
fn identifier(input: &str) -> IResult<&str, &str> {
    recognize(
        tuple((
            alt((alphanumeric1, tag("_"))),
            many0(alt((alphanumeric1, tag("_"), tag("-")))),
        ))
    )(input)
}

/// Parse a quoted string (double quotes with escape support)
fn quoted_string(input: &str) -> IResult<&str, String> {
    delimited(
        char('"'),
        map(
            escaped(
                is_not("\\\""),
                '\\',
                one_of("\"\\nrt0")
            ),
            |s: &str| s.to_string()
        ),
        char('"'),
    )(input)
}

/// Helper for one_of
fn one_of(chars: &str) -> impl Fn(&str) -> IResult<&str, char> + '_ {
    move |input: &str| {
        if let Some(c) = input.chars().next() {
            if chars.contains(c) {
                return Ok((&input[1..], c));
            }
        }
        Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::OneOf,
        )))
    }
}

/// Parse an unquoted string value
fn unquoted_value(input: &str) -> IResult<&str, String> {
    map(
        take_while1(|c: char| !c.is_whitespace() && c != '"' && c != '>' && c != '|'),
        |s: &str| s.to_string()
    )(input)
}

/// Parse a parameter value (quoted or unquoted)
fn param_value(input: &str) -> IResult<&str, String> {
    alt((quoted_string, unquoted_value))(input)
}

/// Parse a key=value parameter pair
fn param_pair(input: &str) -> IResult<&str, (String, String)> {
    separated_pair(
        map(identifier, |s: &str| s.to_string()),
        delimited(space0, char('='), space0),
        param_value
    )(input)
}

/// Parse tool invocation with parameters
/// Format: tool_name key1=value1 key2="value 2"
fn tool_invocation(input: &str) -> IResult<&str, AliasStep> {
    let (input, tool) = identifier(input)?;
    let (input, _) = space1(input)?;
    let (input, params) = separated_list0(space1, param_pair)(input)?;
    
    Ok((input, AliasStep {
        tool: tool.to_string(),
        params: params.into_iter().collect(),
        capture_output: false,
    }))
}

/// Parse a pipe symbol with capture
fn pipe_operator(input: &str) -> IResult<&str, bool> {
    alt((
        value(true, delimited(space0, tag("|>"), space0)),
        value(false, delimited(space0, char('|'), space0)),
    ))(input)
}

/// Parse a pipeline of tool invocations
fn tool_pipeline(input: &str) -> IResult<&str, Vec<AliasStep>> {
    let (input, first) = tool_invocation(input)?;
    let (input, rest) = many0(tuple((pipe_operator, tool_invocation)))(input)?;
    
    let mut steps = vec![first];
    for (capture, mut step) in rest {
        step.capture_output = capture;
        steps.push(step);
    }
    
    Ok((input, steps))
}

/// Parse alias name with @ prefix
fn alias_name(input: &str) -> IResult<&str, String> {
    preceded(
        char('@'),
        map(identifier, |s: &str| s.to_string())
    )(input)
}

/// Parse alias definition
/// Format: @name: description | step1 && step2
fn parse_alias_definition(input: &str) -> IResult<&str, Alias> {
    let (input, name) = alias_name(input)?;
    let (input, _) = delimited(space0, char(':'), space0)(input)?;
    
    // Parse description until we hit a separator
    let (input, description) = map(
        take_while1(|c: char| c != '|' && c != '&'),
        |s: &str| s.trim().to_string()
    )(input)?;
    
    let (input, _) = delimited(space0, char('|'), space0)(input)?;
    
    // Parse steps separated by &&
    let (input, steps) = separated_list1(
        delimited(space0, tag("&&"), space0),
        tool_invocation
    )(input)?;
    
    Ok((input, Alias {
        name,
        description,
        steps,
        variables: HashMap::new(),
    }))
}

/// Parse alias invocation
/// Format: @name arg1=value1 arg2="value"
fn parse_alias_invocation(input: &str) -> IResult<&str, (String, HashMap<String, String>)> {
    let (input, name) = alias_name(input)?;
    let (input, _) = space0(input)?;
    let (input, params) = separated_list0(space1, param_pair)(input)?;
    
    Ok((input, (name, params.into_iter().collect())))
}

// ========== Predefined Aliases ==========

/// Get a set of useful predefined aliases
pub fn predefined_aliases() -> HashMap<String, Alias> {
    let mut aliases = HashMap::new();
    
    // @test - Run tests
    aliases.insert("test".to_string(), Alias {
        name: "test".to_string(),
        description: "Run the test suite".to_string(),
        steps: vec![
            AliasStep {
                tool: "Bash".to_string(),
                params: [(
                    "command".to_string(),
                    "cargo test --workspace".to_string()
                )].into_iter().collect(),
                capture_output: false,
            }
        ],
        variables: HashMap::new(),
    });
    
    // @build - Build the project
    aliases.insert("build".to_string(), Alias {
        name: "build".to_string(),
        description: "Build the project in release mode".to_string(),
        steps: vec![
            AliasStep {
                tool: "Bash".to_string(),
                params: [(
                    "command".to_string(),
                    "cargo build --release".to_string()
                )].into_iter().collect(),
                capture_output: false,
            }
        ],
        variables: HashMap::new(),
    });
    
    // @check - Run checks
    aliases.insert("check".to_string(), Alias {
        name: "check".to_string(),
        description: "Run cargo check and clippy".to_string(),
        steps: vec![
            AliasStep {
                tool: "Bash".to_string(),
                params: [(
                    "command".to_string(),
                    "cargo check && cargo clippy -- -D warnings".to_string()
                )].into_iter().collect(),
                capture_output: false,
            }
        ],
        variables: HashMap::new(),
    });
    
    // @format - Format code
    aliases.insert("format".to_string(), Alias {
        name: "format".to_string(),
        description: "Format code with rustfmt".to_string(),
        steps: vec![
            AliasStep {
                tool: "Bash".to_string(),
                params: [(
                    "command".to_string(),
                    "cargo fmt".to_string()
                )].into_iter().collect(),
                capture_output: false,
            }
        ],
        variables: HashMap::new(),
    });
    
    // @clean - Clean build artifacts
    aliases.insert("clean".to_string(), Alias {
        name: "clean".to_string(),
        description: "Clean build artifacts".to_string(),
        steps: vec![
            AliasStep {
                tool: "Bash".to_string(),
                params: [(
                    "command".to_string(),
                    "cargo clean".to_string()
                )].into_iter().collect(),
                capture_output: false,
            }
        ],
        variables: HashMap::new(),
    });
    
    // @lint - Find issues
    aliases.insert("lint".to_string(), Alias {
        name: "lint".to_string(),
        description: "Find code issues with grep".to_string(),
        steps: vec![
            AliasStep {
                tool: "Grep".to_string(),
                params: [
                    ("pattern".to_string(), "TODO|FIXME|XXX|HACK".to_string()),
                    ("path".to_string(), ".".to_string()),
                ].into_iter().collect(),
                capture_output: false,
            }
        ],
        variables: HashMap::new(),
    });
    
    // @docs - Generate and open docs
    aliases.insert("docs".to_string(), Alias {
        name: "docs".to_string(),
        description: "Generate and open documentation".to_string(),
        steps: vec![
            AliasStep {
                tool: "Bash".to_string(),
                params: [(
                    "command".to_string(),
                    "cargo doc --open".to_string()
                )].into_iter().collect(),
                capture_output: false,
            }
        ],
        variables: HashMap::new(),
    });
    
    // @status - Git status
    aliases.insert("status".to_string(), Alias {
        name: "status".to_string(),
        description: "Show git status".to_string(),
        steps: vec![
            AliasStep {
                tool: "Git".to_string(),
                params: [(
                    "command".to_string(),
                    "status -sb".to_string()
                )].into_iter().collect(),
                capture_output: false,
            }
        ],
        variables: HashMap::new(),
    });
    
    aliases
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_parse_simple_alias() {
        let input = "@test: Run tests | bash command='cargo test'";
        let result = parse_alias_definition(input);
        assert!(result.is_ok());
        
        let (remaining, alias) = result.unwrap();
        assert!(remaining.is_empty());
        assert_eq!(alias.name, "test");
        assert_eq!(alias.description, "Run tests");
        assert_eq!(alias.steps.len(), 1);
        assert_eq!(alias.steps[0].tool, "bash");
    }
    
    #[test]
    fn test_parse_multi_step_alias() {
        let input = "@check: Run checks | bash command='cargo check' && bash command='cargo clippy'";
        let result = parse_alias_definition(input);
        assert!(result.is_ok());
        
        let (remaining, alias) = result.unwrap();
        assert!(remaining.is_empty());
        assert_eq!(alias.name, "check");
        assert_eq!(alias.steps.len(), 2);
    }
    
    #[test]
    fn test_parse_invocation() {
        let input = "@deploy env=production version=\"1.2.3\"";
        let result = parse_alias_invocation(input);
        assert!(result.is_ok());
        
        let (remaining, (name, params)) = result.unwrap();
        assert!(remaining.is_empty());
        assert_eq!(name, "deploy");
        assert_eq!(params.get("env"), Some(&"production".to_string()));
        assert_eq!(params.get("version"), Some(&"1.2.3".to_string()));
    }
    
    #[test]
    fn test_parser_integration() {
        let parser = AliasParser::with_aliases(predefined_aliases());
        
        // Test expanding a known alias
        let expanded = parser.expand("test", HashMap::new());
        assert!(expanded.is_ok());
        
        let steps = expanded.unwrap();
        assert_eq!(steps.len(), 1);
        assert_eq!(steps[0].tool, "Bash");
    }
    
    #[test]
    fn test_variable_substitution() {
        let parser = AliasParser::new();
        let mut vars = HashMap::new();
        vars.insert("name".to_string(), "world".to_string());
        
        let result = parser.substitute_variables("Hello ${name}!", &vars);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "Hello world!");
    }
}

