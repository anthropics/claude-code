//! IDE features - Symbol search, code navigation, completions
//!
//! Provides IDE-like features including:
//! - Workspace-wide symbol search
//! - Go to definition
//! - Find all references
//! - Code completions
//! - Inline diagnostics

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use lsp_types::*;
use regex::Regex;
use tracing::{debug, error, info, instrument, warn};
use thiserror::Error;
use tree_sitter::{Language, Node, Parser, Point, Query, QueryCursor, Tree};

/// IDE feature errors
#[derive(Debug, Error)]
pub enum IDEError {
    #[error("Parse error: {0}")]
    Parse(String),
    
    #[error("Symbol not found: {0}")]
    SymbolNotFound(String),
    
    #[error("Language not supported: {0}")]
    UnsupportedLanguage(String),
    
    #[error("LSP error: {0}")]
    LSP(String),
    
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

/// Symbol index for workspace
pub struct SymbolIndex {
    symbols: Vec<Symbol>,
    file_indices: HashMap<PathBuf, Vec<usize>>,
    name_index: HashMap<String, Vec<usize>>,
    by_kind: HashMap<SymbolKind, Vec<usize>>,
}

/// A code symbol
#[derive(Clone, Debug)]
pub struct Symbol {
    pub name: String,
    pub kind: SymbolKind,
    pub container_name: Option<String>,
    pub location: Location,
    pub signature: Option<String>,
    pub documentation: Option<String>,
    pub children: Vec<usize>,
}

/// Symbol kinds
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum SymbolKind {
    File,
    Module,
    Namespace,
    Package,
    Class,
    Method,
    Property,
    Field,
    Constructor,
    Enum,
    Interface,
    Function,
    Variable,
    Constant,
    String,
    Number,
    Boolean,
    Array,
    Object,
    Key,
    Null,
    EnumMember,
    Struct,
    Event,
    Operator,
    TypeParameter,
}

/// Location in a file
#[derive(Clone, Debug)]
pub struct Location {
    pub path: PathBuf,
    pub range: Range,
}

/// Text range
#[derive(Clone, Copy, Debug)]
pub struct Range {
    pub start: Position,
    pub end: Position,
}

/// Position in file
#[derive(Clone, Copy, Debug, Default)]
pub struct Position {
    pub line: usize,
    pub character: usize,
}

impl SymbolIndex {
    pub fn new() -> Self {
        Self {
            symbols: Vec::new(),
            file_indices: HashMap::new(),
            name_index: HashMap::new(),
            by_kind: HashMap::new(),
        }
    }
    
    /// Index a file
    #[instrument(skip(self, content))]
    pub fn index_file(&mut self, path: &Path, content: &str) -> Result<(), IDEError> {
        let language = Self::detect_language(path)?;
        let symbols = self.parse_symbols(content, language, path)?;
        
        // Remove old symbols for this file
        if let Some(old_indices) = self.file_indices.remove(path) {
            for idx in old_indices {
                // Mark as stale by setting kind to Null
                if let Some(symbol) = self.symbols.get_mut(idx) {
                    symbol.kind = SymbolKind::Null;
                }
            }
        }
        
        // Add new symbols
        let mut file_indices = Vec::new();
        for symbol in symbols {
            let idx = self.symbols.len();
            
            // Index by name
            self.name_index
                .entry(symbol.name.clone())
                .or_default()
                .push(idx);
            
            // Index by kind
            self.by_kind
                .entry(symbol.kind)
                .or_default()
                .push(idx);
            
            self.symbols.push(symbol);
            file_indices.push(idx);
        }
        
        self.file_indices.insert(path.to_path_buf(), file_indices);
        
        info!("Indexed {} symbols in {:?}", file_indices.len(), path);
        Ok(())
    }
    
    /// Detect language from file extension
    fn detect_language(path: &Path) -> Result<Language, IDEError> {
        let ext = path.extension()
            .and_then(|e| e.to_str())
            .unwrap_or("");
        
        match ext {
            "rs" => tree_sitter_rust::LANGUAGE.into(),
            "js" => tree_sitter_javascript::LANGUAGE.into(),
            "ts" => tree_sitter_typescript::LANGUAGE_TSX.into(),
            "tsx" => tree_sitter_typescript::LANGUAGE_TSX.into(),
            "py" => tree_sitter_python::LANGUAGE.into(),
            "go" => tree_sitter_go::LANGUAGE.into(),
            "java" => tree_sitter_java::LANGUAGE.into(),
            "cpp" | "cc" | "cxx" | "hpp" | "h" => tree_sitter_cpp::LANGUAGE.into(),
            "c" => tree_sitter_c::LANGUAGE.into(),
            "rb" => tree_sitter_ruby::LANGUAGE.into(),
            _ => return Err(IDEError::UnsupportedLanguage(ext.to_string())),
        }
    }
    
    /// Parse symbols using tree-sitter
    fn parse_symbols(&self, content: &str, language: Language, path: &Path) -> Result<Vec<Symbol>, IDEError> {
        let mut parser = Parser::new();
        parser.set_language(&language)
            .map_err(|e| IDEError::Parse(format!("Failed to set language: {:?}", e)))?;
        
        let tree = parser.parse(content, None)
            .ok_or_else(|| IDEError::Parse("Failed to parse file".to_string()))?;
        
        let root = tree.root_node();
        let mut symbols = Vec::new();
        
        self.walk_tree_for_symbols(&root, content, path, &mut symbols, None, 0);
        
        Ok(symbols)
    }
    
    /// Recursively walk tree for symbols
    fn walk_tree_for_symbols(
        &self,
        node: &Node,
        content: &str,
        path: &Path,
        symbols: &mut Vec<Symbol>,
        container: Option<String>,
        depth: usize,
    ) {
        if depth > 100 {
            return;
        }
        
        let kind = node.kind();
        
        // Extract symbol based on node type
        if let Some((name, symbol_kind)) = self.get_symbol_info(node, content, kind) {
            let start = node.start_position();
            let end = node.end_position();
            
            let symbol = Symbol {
                name: name.clone(),
                kind: symbol_kind,
                container_name: container.clone(),
                location: Location {
                    path: path.to_path_buf(),
                    range: Range {
                        start: Position { line: start.row, character: start.column },
                        end: Position { line: end.row, character: end.column },
                    },
                },
                signature: self.get_signature(node, content),
                documentation: self.get_documentation(node, content),
                children: Vec::new(),
            };
            
            symbols.push(symbol);
        }
        
        // Recurse into children
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            let new_container = if let Some((name, kind)) = self.get_symbol_info(node, content, kind) {
                if kind == SymbolKind::Class || kind == SymbolKind::Module || kind == SymbolKind::Struct {
                    Some(name)
                } else {
                    container.clone()
                }
            } else {
                container.clone()
            };
            
            self.walk_tree_for_symbols(&child, content, path, symbols, new_container, depth + 1);
        }
    }
    
    /// Get symbol info from node
    fn get_symbol_info(&self, node: &Node, content: &str, kind: &str) -> Option<(String, SymbolKind)> {
        match kind {
            "function_item" | "function_declaration" => {
                node.child_by_field_name("name")
                    .map(|n| (n.utf8_text(content.as_bytes()).ok()?.to_string(), SymbolKind::Function))
            }
            "method_definition" => {
                node.child_by_field_name("name")
                    .map(|n| (n.utf8_text(content.as_bytes()).ok()?.to_string(), SymbolKind::Method))
            }
            "class_declaration" | "class_definition" | "struct_item" => {
                node.child_by_field_name("name")
                    .map(|n| (n.utf8_text(content.as_bytes()).ok()?.to_string(), SymbolKind::Class))
            }
            "interface_declaration" | "trait_item" => {
                node.child_by_field_name("name")
                    .map(|n| (n.utf8_text(content.as_bytes()).ok()?.to_string(), SymbolKind::Interface))
            }
            "enum_declaration" | "enum_item" => {
                node.child_by_field_name("name")
                    .map(|n| (n.utf8_text(content.as_bytes()).ok()?.to_string(), SymbolKind::Enum))
            }
            "variable_declaration" | "const_declaration" | "let_declaration" => {
                node.child_by_field_name("name")
                    .map(|n| (n.utf8_text(content.as_bytes()).ok()?.to_string(), SymbolKind::Variable))
            }
            "field_declaration" | "property_identifier" => {
                node.child_by_field_name("name")
                    .map(|n| (n.utf8_text(content.as_bytes()).ok()?.to_string(), SymbolKind::Field))
            }
            "module" | "mod_item" => {
                node.child_by_field_name("name")
                    .map(|n| (n.utf8_text(content.as_bytes()).ok()?.to_string(), SymbolKind::Module))
            }
            _ => None,
        }
    }
    
    /// Get signature from node
    fn get_signature(&self, node: &Node, content: &str) -> Option<String> {
        // Extract function signature
        let text = node.utf8_text(content.as_bytes()).ok()?;
        
        // Get first line (signature)
        let signature = text.lines().next()?.to_string();
        
        // Truncate if too long
        if signature.len() > 100 {
            Some(format!("{}...", &signature[..97]))
        } else {
            Some(signature)
        }
    }
    
    /// Get documentation comment
    fn get_documentation(&self, node: &Node, content: &str) -> Option<String> {
        let start_line = node.start_position().row;
        
        // Look for comment nodes before this node
        // This is simplified - real implementation would parse doc comments
        let lines: Vec<&str> = content.lines().collect();
        
        let mut doc_lines = Vec::new();
        let mut line_idx = start_line.saturating_sub(1);
        
        while line_idx > 0 {
            let line = lines.get(line_idx)?;
            let trimmed = line.trim();
            
            if trimmed.starts_with("//") || trimmed.starts_with("#") || trimmed.starts_with("///") {
                doc_lines.push(trimmed.trim_start_matches('/').trim().to_string());
            } else if trimmed.starts_with("/*") || trimmed.starts_with("*") {
                doc_lines.push(trimmed.trim_start_matches('*').trim().to_string());
            } else if !trimmed.is_empty() {
                break;
            }
            
            line_idx = line_idx.saturating_sub(1);
        }
        
        if doc_lines.is_empty() {
            None
        } else {
            doc_lines.reverse();
            Some(doc_lines.join("\n"))
        }
    }
    
    /// Search symbols by name
    pub fn search_symbols(&self, query: &str) -> Vec<&Symbol> {
        let pattern = Regex::new(&format!("(?i){}", regex::escape(query))).unwrap();
        
        self.symbols.iter()
            .filter(|s| s.kind != SymbolKind::Null)
            .filter(|s| pattern.is_match(&s.name))
            .collect()
    }
    
    /// Find exact symbol by name
    pub fn find_symbol(&self, name: &str) -> Option<&Symbol> {
        self.name_index.get(name)
            .and_then(|indices| {
                indices.iter()
                    .filter_map(|&idx| self.symbols.get(idx))
                    .find(|s| s.kind != SymbolKind::Null)
            })
    }
    
    /// Get symbols by kind
    pub fn get_symbols_by_kind(&self, kind: SymbolKind) -> Vec<&Symbol> {
        self.by_kind.get(&kind)
            .map(|indices| {
                indices.iter()
                    .filter_map(|&idx| self.symbols.get(idx))
                    .filter(|s| s.kind != SymbolKind::Null)
                    .collect()
            })
            .unwrap_or_default()
    }
    
    /// Get all symbols in a file
    pub fn get_file_symbols(&self, path: &Path) -> Vec<&Symbol> {
        self.file_indices.get(path)
            .map(|indices| {
                indices.iter()
                    .filter_map(|&idx| self.symbols.get(idx))
                    .filter(|s| s.kind != SymbolKind::Null)
                    .collect()
            })
            .unwrap_or_default()
    }
    
    /// Find references to a symbol
    pub fn find_references(&self, symbol_name: &str, symbol_path: &Path) -> Vec<Location> {
        let mut references = Vec::new();
        
        // Simple text-based search for now
        // Full implementation would use tree-sitter queries
        for (path, indices) in &self.file_indices {
            // Skip the definition file for finding references only
            if path == symbol_path {
                continue;
            }
            
            // In a real implementation, we'd search the file content
            // This is a placeholder
        }
        
        references
    }
    
    /// Get symbol at position
    pub fn symbol_at_position(&self, path: &Path, position: Position) -> Option<&Symbol> {
        self.file_indices.get(path)
            .and_then(|indices| {
                indices.iter()
                    .filter_map(|&idx| self.symbols.get(idx))
                    .find(|s| {
                        let range = &s.location.range;
                        position.line >= range.start.line && 
                        position.line <= range.end.line
                    })
            })
    }
}

/// Code completion engine
pub struct CompletionEngine {
    symbol_index: SymbolIndex,
    snippets: HashMap<String, String>,
}

impl CompletionEngine {
    pub fn new(symbol_index: SymbolIndex) -> Self {
        let mut snippets = HashMap::new();
        
        // Common snippets
        snippets.insert("fn".to_string(), "fn ${1:name}(${2:params}) -> ${3:ReturnType} {\n    $0\n}".to_string());
        snippets.insert("struct".to_string(), "struct ${1:Name} {\n    $0\n}".to_string());
        snippets.insert("impl".to_string(), "impl ${1:Type} {\n    $0\n}".to_string());
        snippets.insert("for".to_string(), "for ${1:item} in ${2:iterable} {\n    $0\n}".to_string());
        snippets.insert("if".to_string(), "if ${1:condition} {\n    $0\n}".to_string());
        snippets.insert("match".to_string(), "match ${1:expr} {\n    ${2:pat} => ${3:expr},\n}".to_string());
        
        Self {
            symbol_index,
            snippets,
        }
    }
    
    /// Get completions at position
    pub fn get_completions(
        &self,
        path: &Path,
        content: &str,
        position: Position,
        trigger: Option<String>,
    ) -> Vec<CompletionItem> {
        let mut completions = Vec::new();
        
        // Get current word being typed
        let prefix = self.get_word_prefix(content, position);
        
        // Add symbol completions
        let symbols = if prefix.len() >= 2 {
            self.symbol_index.search_symbols(&prefix)
        } else {
            Vec::new()
        };
        
        for symbol in symbols {
            completions.push(CompletionItem {
                label: symbol.name.clone(),
                kind: Some(Self::to_lsp_kind(symbol.kind)),
                detail: symbol.signature.clone(),
                documentation: symbol.documentation.as_ref().map(|d| {
                    Documentation::MarkupContent(MarkupContent {
                        kind: MarkupKind::Markdown,
                        value: d.clone(),
                    })
                }),
                ..Default::default()
            });
        }
        
        // Add snippet completions
        for (trigger_word, snippet) in &self.snippets {
            if trigger_word.starts_with(&prefix) || prefix.is_empty() {
                completions.push(CompletionItem {
                    label: trigger_word.clone(),
                    kind: Some(CompletionItemKind::SNIPPET),
                    insert_text: Some(snippet.clone()),
                    insert_text_format: Some(InsertTextFormat::SNIPPET),
                    ..Default::default()
                });
            }
        }
        
        // Sort by relevance
        completions.sort_by(|a, b| {
            let a_matches = a.label.starts_with(&prefix);
            let b_matches = b.label.starts_with(&prefix);
            
            match (a_matches, b_matches) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => a.label.cmp(&b.label),
            }
        });
        
        completions.truncate(50); // Limit results
        completions
    }
    
    /// Get word prefix at position
    fn get_word_prefix(&self, content: &str, position: Position) -> String {
        let lines: Vec<&str> = content.lines().collect();
        
        if let Some(line) = lines.get(position.line) {
            let char_pos = position.character.min(line.len());
            let before = &line[..char_pos];
            
            // Find word boundaries
            let word_chars: &[char] = &['a', 'z', 'A', 'Z', '0', '9', '_'];
            
            before.chars().rev()
                .take_while(|c| c.is_alphanumeric() || *c == '_')
                .collect::<String>()
                .chars()
                .rev()
                .collect()
        } else {
            String::new()
        }
    }
    
    /// Convert symbol kind to LSP kind
    fn to_lsp_kind(kind: SymbolKind) -> CompletionItemKind {
        match kind {
            SymbolKind::Function => CompletionItemKind::FUNCTION,
            SymbolKind::Method => CompletionItemKind::METHOD,
            SymbolKind::Class => CompletionItemKind::CLASS,
            SymbolKind::Interface => CompletionItemKind::INTERFACE,
            SymbolKind::Variable => CompletionItemKind::VARIABLE,
            SymbolKind::Constant => CompletionItemKind::CONSTANT,
            SymbolKind::Field => CompletionItemKind::FIELD,
            SymbolKind::Property => CompletionItemKind::PROPERTY,
            SymbolKind::Enum => CompletionItemKind::ENUM,
            SymbolKind::Module => CompletionItemKind::MODULE,
            SymbolKind::Struct => CompletionItemKind::STRUCT,
            _ => CompletionItemKind::TEXT,
        }
    }
}

/// Inline diagnostics collector
pub struct DiagnosticsCollector {
    diagnostics: HashMap<PathBuf, Vec<Diagnostic>>,
}

impl DiagnosticsCollector {
    pub fn new() -> Self {
        Self {
            diagnostics: HashMap::new(),
        }
    }
    
    /// Add diagnostic for a file
    pub fn add_diagnostic(&mut self, path: PathBuf, diagnostic: Diagnostic) {
        self.diagnostics
            .entry(path)
            .or_default()
            .push(diagnostic);
    }
    
    /// Get diagnostics for a file
    pub fn get_diagnostics(&self, path: &Path) -> &[Diagnostic] {
        self.diagnostics.get(path).map(|v| v.as_slice()).unwrap_or(&[])
    }
    
    /// Clear diagnostics for a file
    pub fn clear_file(&mut self, path: &Path) {
        self.diagnostics.remove(path);
    }
    
    /// Clear all diagnostics
    pub fn clear_all(&mut self) {
        self.diagnostics.clear();
    }
    
    /// Get total diagnostic count
    pub fn total_count(&self) -> usize {
        self.diagnostics.values().map(|v| v.len()).sum()
    }
    
    /// Get count by severity
    pub fn count_by_severity(&self) -> HashMap<DiagnosticSeverity, usize> {
        let mut counts = HashMap::new();
        
        for diags in self.diagnostics.values() {
            for diag in diags {
                if let Some(severity) = diag.severity {
                    *counts.entry(severity).or_insert(0) += 1;
                }
            }
        }
        
        counts
    }
}

// LSP types re-exports for convenience
pub use lsp_types::{
    CompletionItem, CompletionItemKind, Diagnostic, DiagnosticSeverity,
    Documentation, InsertTextFormat, MarkupContent, MarkupKind,
};

