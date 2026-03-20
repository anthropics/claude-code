---
name: doc-coauthoring
description: This skill should be used when the user asks to "help me write this document", "co-author a document", "improve my writing", "help draft this", "collaborate on writing", "polish my document", "fill in this template", "help me finish this report", or needs an AI writing partner for documents, reports, proposals, or any long-form content.
version: 1.0.0
---

# Document Co-Authoring

This skill provides guidance for effective AI-human document collaboration — drafting, improving, and completing documents together.

## Co-Authoring Modes

Identify the user's intent before proceeding:

| Mode | User Says | Approach |
|------|-----------|----------|
| **Draft from scratch** | "Write a proposal for..." | Generate full draft, then refine |
| **Complete partial doc** | "Finish this section..." | Match existing style, fill gaps |
| **Polish & improve** | "Make this better" | Preserve voice, enhance clarity |
| **Structural feedback** | "Review my outline" | Critique structure, suggest improvements |
| **Targeted edits** | "Rewrite this paragraph" | Focused revision of specific section |

## Starting a Collaboration

When the user provides a partial document or outline:

1. **Read the full document first** — understand the voice, tone, and style
2. **Identify the audience** — adjust formality and technical depth accordingly
3. **Note the structure** — headings, sections, length pattern
4. **Preserve the author's voice** — don't homogenize into generic AI prose

Questions to ask if unclear:
- "Who is the audience for this document?"
- "What tone do you want? (formal, conversational, technical)"
- "Are there sections you want to keep as-is?"
- "Do you have a target length?"

## Drafting Principles

### Match the Existing Voice

Before drafting, identify the author's writing characteristics:
- Sentence length (short/punchy vs. long/flowing)
- Vocabulary level (technical jargon vs. plain language)
- First/second/third person perspective
- Active vs. passive voice preference
- Use of headers, bullets, or dense paragraphs

### Structure First

For new documents, establish structure before writing:

```
Document types and their typical structures:

Technical Proposal:
  - Executive Summary
  - Problem Statement
  - Proposed Solution
  - Technical Approach
  - Timeline & Milestones
  - Budget
  - Team / Qualifications

Business Report:
  - Executive Summary
  - Background / Context
  - Findings
  - Analysis
  - Recommendations
  - Next Steps

One-Pager:
  - Hook / Opening
  - Core Message (3 points max)
  - Supporting Evidence
  - Call to Action
```

### Transitions and Coherence

When connecting sections or paragraphs, use explicit transition logic:
- **Continuation**: "Building on this...", "Furthermore...", "This leads to..."
- **Contrast**: "However...", "In contrast...", "While X, Y..."
- **Conclusion**: "Therefore...", "As a result...", "This demonstrates..."
- **Example**: "For instance...", "Consider...", "Take the case of..."

## Editing Modes

### Clarity Pass

Improve readability without changing meaning:
- Replace jargon with plain language (unless technical audience)
- Break run-on sentences
- Eliminate redundancy ("completely finished" → "finished")
- Strengthen weak verbs ("make use of" → "use")

### Concision Pass

Cut wordiness:
- Remove hedge words: "basically", "essentially", "sort of"
- Delete throat-clearing openings: "In order to...", "It is important to note that..."
- Merge short sentences that share a subject

### Tone Adjustment

Calibrate formality:

```
Too casual → More formal:
"We need to fix this ASAP" → "This issue requires immediate attention."

Too stiff → More natural:
"It is recommended that consideration be given to..." → "Consider..."
```

## Handling Sensitive Content

When co-authoring communications that may be sensitive:
- Confirm intended recipients and context before drafting
- Flag if content might be misinterpreted
- Offer alternative phrasings for ambiguous statements
- Distinguish between what the user wants to say vs. what will land well

## Collaborative Workflow

For longer documents, work iteratively:

1. Generate section draft
2. Ask: "Does this match what you had in mind? Any sections to revise?"
3. Refine based on feedback
4. Move to next section
5. Do a final pass for consistency when all sections are complete

## Output Formats

Deliver documents in the format the user needs:
- **Markdown** for developers, GitHub, notion-style tools
- **Plain text** for email, simple docs
- **Structured HTML** for web publishing
- **Formatted prose** for Word/PDF output

Always confirm format preference before writing lengthy content.
