# Code Complexity Analysis

Analyze the complexity of the provided code with special attention to cognitive complexity metrics.

## Usage
/analyze-complexity $ARGUMENTS

## Parameters
- path: File path to analyze
- threshold: Complexity threshold (default: 10)

## Example
/analyze-complexity src/app.js --threshold=15

The command will:
1. Calculate cyclomatic complexity
2. Measure cognitive complexity
3. Identify complex functions or methods
4. Suggest refactoring opportunities
5. Generate a complexity heatmap

Results are returned in a structured format with metrics and actionable recommendations.
