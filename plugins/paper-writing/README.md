# Paper Writing Plugin

A structured workflow for developing academic ideas into rigorous, well-argued paper content with detailed discussion and logical review.

## Overview

The Paper Writing Plugin helps researchers transform raw ideas into structured academic arguments. Instead of staring at a blank page, it guides you through understanding, researching, arguing, writing, and reviewing — resulting in well-reasoned content ready to incorporate into your paper.

## Command: `/paper-writing`

Launches a guided paper writing workflow with 6 phases.

**Usage:**
```bash
/paper-writing Large language models can serve as effective peer reviewers for academic papers
```

Or simply:
```bash
/paper-writing
```

## The 6-Phase Workflow

### Phase 1: Idea Understanding
Deeply understands your core idea, its context, discipline, and target audience.

### Phase 2: Research Landscape Analysis
Launches `literature-analyzer` agents to map the scholarly terrain — key frameworks, debates, gaps, and positioning opportunities.

### Phase 3: Argument Development
Launches `argument-builder` agents to construct a multi-layered argument with supporting points, counterarguments, and rebuttals.

### Phase 4: Detailed Discussion Writing
Develops the argument into detailed academic prose with topic sentences, evidence integration points, and transitions.

### Phase 5: Logic & Quality Review
Launches `logic-reviewer` agents to check logical validity, detect fallacies, and evaluate evidence sufficiency.

### Phase 6: Final Output
Delivers a complete package: refined thesis, argument outline, discussion text, key definitions, and citation suggestions.

## Agents

### `argument-builder`
Develops structured academic arguments from a core idea. Constructs logical reasoning chains, identifies evidence patterns, and anticipates counterarguments with rebuttals.

### `literature-analyzer`
Maps the research landscape around a given idea. Identifies theoretical frameworks, key debates, research gaps, and positioning strategies within existing scholarship.

### `logic-reviewer`
Reviews arguments for logical validity. Detects fallacies, checks reasoning consistency, evaluates evidence sufficiency, and suggests concrete improvements.

## Usage Tips

- **Be specific about your idea**: More detail leads to better argument development
- **Specify your field**: Different disciplines have different argumentation standards
- **Mention your target venue**: Journal/conference expectations shape the argument
- **Engage with the process**: Answer clarifying questions thoughtfully for better results
- **Iterate**: Use the output as a starting point and refine through conversation

## Version

1.0.0
