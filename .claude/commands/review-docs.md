# Review Documentation

Adversarially evaluate the documentation at **$ARGUMENTS** using the fan-out → synthesize → apply pattern.

Read the target file(s) first. Then launch **6 parallel subagents**, each with one rubric:

1. **Convex Easy Wins** — Missing defaults, incorrect values, broken links, formatting inconsistencies, missing cross-references. What takes 1 line to fix but saves readers real confusion?

2. **Extending Capabilities** — Is the full parameter space documented (not just common params)? Are advanced features, composition patterns, edge cases, and power-user workflows covered? Are extension points documented?

3. **Reducing Steps to Accurate Results** — Is there a Quick Reference for the 80% case? Are "Use this, not that" decision tables present? Are workflow patterns step-by-step? Can a reader find the right answer without reading the full document? Are common errors and fixes inline?

4. **Improvement-Integration Points** — Are limitations framed as improvement opportunities? Are automation opportunities identified (generators, CI checks, drift detectors)? Does the document suggest how the system could evolve?

5. **Accuracy & Source-of-Truth Fidelity** — Cross-reference every claim against source code, schemas, or runtime behavior. Find documentation lies: stated vs actual defaults, missing enum values, changed constraints, undocumented parameters.

6. **Structural & Navigational Quality** — Is the ToC complete and correctly linked? Is the glossary comprehensive? Are headings consistent and scannable? Is the metadata template uniform across all items? Are related items cross-referenced bidirectionally?

Each subagent must return: **Score (1-5)**, **Specific Findings**, **Concrete Recommendations**.

After all return: aggregate scores, deduplicate, prioritize (convex wins → accuracy → steps → capabilities → structure → integration), apply improvements, commit.

Stop when all dimensions are 4+/5 or a round yields fewer than 3 findings.
