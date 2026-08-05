# Adversarial Review

Adversarially evaluate the target artifact using parallel subagents with strict rubrics. The target is: **$ARGUMENTS**

If the argument is a file path, read it. If it's a description, find the relevant files first.

---

## Execution

Launch **6 parallel subagents**, each assigned ONE rubric dimension. Each must return:
- **Score** (1-5, with 5 being best)
- **Specific findings** (line-level references where possible)
- **Concrete recommendations** (exact changes, not vague advice)

### R1: Convex Easy Wins
High-impact, low-effort fixes. Missing defaults, incorrect values, simple formatting inconsistencies, missing cross-references. Score 5 = nothing trivial left to fix.

### R2: Extending Capabilities
Does the artifact cover advanced usage, composition patterns, edge cases, extension points, power-user features? Score 5 = comprehensive advanced coverage.

### R3: Reducing Steps to Accurate Results
Can a reader go from question to answer efficiently? Quick references, decision tables, workflow patterns, inline error docs. Score 5 = minimal friction to any answer.

### R4: Improvement-Integration Points
Does the artifact identify where the system can be improved? Limitations as opportunities, automation potential, drift detection. Score 5 = clear improvement roadmap.

### R5: Accuracy & Source-of-Truth Fidelity
Cross-reference against actual source code, schemas, or runtime behavior. Find documentation lies, stale values, incomplete enums. Score 5 = fully verified.

### R6: Structural & Navigational Quality
ToC completeness, glossary coverage, heading consistency, metadata template uniformity, bidirectional cross-references. Score 5 = professional reference quality.

## After Evaluation

1. Present aggregate score table
2. Deduplicate overlapping findings across dimensions
3. Prioritize: convex wins → capability extensions → accuracy → structural
4. Apply all improvements
5. Commit with detailed changelog

If any dimension scores below 3/5 after application, run a focused follow-up on that dimension.
