# Code Complexity Analyzer

Analyze the complexity of code with detailed metrics focusing on cognitive and cyclomatic complexity, identifying potential refactoring opportunities.

## Steps

1. Parse the provided code file and analyze its structure (functions, methods, classes).
2. Calculate key complexity metrics:
   - Cyclomatic complexity (McCabe's complexity)
   - Cognitive complexity
   - Nesting depth
   - Function/method length
   - Comment-to-code ratio
3. Identify hot spots where complexity exceeds defined thresholds.
4. Generate refactoring suggestions for high-complexity areas.
5. Provide visualization data for complexity heatmapping.

## Output Format

Output the results in a structured JSON format including:
- Overall complexity metrics
- Per-function/method complexity breakdown
- Identified hotspots
- Refactoring recommendations

JSON Template:
```json
{
  "file_summary": {
    "path": "src/example.js",
    "total_lines": 250,
    "code_lines": 200,
    "comment_lines": 30,
    "empty_lines": 20,
    "avg_cyclomatic_complexity": 8.5,
    "avg_cognitive_complexity": 12.3,
    "max_cyclomatic_complexity": 25,
    "max_cognitive_complexity": 35
  },
  "hotspots": [
    {
      "name": "processData",
      "start_line": 45,
      "end_line": 98,
      "lines": 54,
      "cyclomatic_complexity": 25,
      "cognitive_complexity": 35,
      "nesting_depth": 6,
      "complexity_factors": [
        {"type": "conditional_nesting", "count": 8, "impact": "high"},
        {"type": "loop_complexity", "count": 5, "impact": "medium"},
        {"type": "lack_of_abstraction", "impact": "high"}
      ]
    }
  ],
  "refactoring_suggestions": [
    {
      "target": "processData",
      "line_range": "45-98",
      "issue": "High cognitive complexity (35) exceeds threshold (15)",
      "suggestions": [
        "Extract conditional blocks at lines 58-72 into separate methods",
        "Replace nested loops at lines 75-92 with functional programming approaches",
        "Consider applying the Strategy pattern to separate different processing algorithms"
      ],
      "priority": "high"
    }
  ],
  "visualization_data": {
    "heatmap": [
      {"line_range": "1-30", "complexity": "low"},
      {"line_range": "31-44", "complexity": "medium"},
      {"line_range": "45-98", "complexity": "very_high"},
      {"line_range": "99-250", "complexity": "low"}
    ]
  }
}
```

## Parameters

- `path`: File path to analyze (required)
- `threshold`: Complexity threshold for flagging (default: 10)
- `metrics`: Specific metrics to calculate (default: "all")
- `format`: Output format (json, html, text) (default: json)
- `ignorePatterns`: Patterns of code to ignore (default: "comments,tests")

## Examples

### Basic Usage
```
/analyze-complexity --path=src/services/data-processor.js
```

### With Custom Threshold
```
/analyze-complexity --path=src/controllers/auth-controller.js --threshold=15
```

### Specific Metrics Only
```
/analyze-complexity --path=lib/utils.js --metrics=cognitive,nesting
```

### Different Output Format
```
/analyze-complexity --path=src/core/engine.js --format=html
```

## Complexity Metrics Explanation

### Cyclomatic Complexity
Measures the number of linearly independent paths through a program's source code. Calculated based on control flow structures (if statements, loops, etc.).

Interpretation:
- 1-10: Simple, well-structured code
- 11-20: Moderately complex, consider refactoring
- 21-50: Complex, difficult to maintain, high priority for refactoring
- 50+: Unmaintainable, critical priority for refactoring

### Cognitive Complexity
Measures how difficult code is to understand for humans. Accounts for:
- Nesting depth
- Control flow jumps
- Structural complexity
- Logical operations

Interpretation:
- 0-5: Easy to understand
- 6-10: Moderately readable
- 11-20: Difficult to understand at a glance
- 21+: Very difficult to understand, high refactoring priority

### Nesting Depth
Measures the deepest level of nested control structures.

Interpretation:
- 0-2: Good practice
- 3-4: Acceptable but watch for deeper nesting
- 5+: Too deep, consider restructuring

## Refactoring Strategies

The analyzer suggests specific refactoring techniques based on the type of complexity:

1. **Extract Method/Function**
   - For long methods/functions
   - For code blocks with distinct functionality

2. **Replace Conditionals**
   - Replace complex if-else chains with polymorphism
   - Use pattern matching or lookup tables for complex switches

3. **Simplify Control Flow**
   - Replace deep nesting with early returns
   - Use guard clauses
   - Consolidate duplicate conditions

4. **Functional Approaches**
   - Replace loops with map/filter/reduce
   - Use composition instead of imperative code

5. **Design Patterns**
   - Strategy Pattern for varying algorithms
   - State Pattern for state-dependent behavior
   - Command Pattern for complex operations

## Notes

- Analysis is language-specific with optimized parsers for JavaScript/TypeScript, Python, Java, and C/C++
- Suggestions are tailored to the language's idiomatic patterns and best practices
- Large files may take longer to analyze due to comprehensive metric calculations
- Consider using this tool as part of CI/CD pipeline to prevent complexity increases over time