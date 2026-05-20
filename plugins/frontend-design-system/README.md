# Frontend Design System

A Claude Code plugin that generates a **design spec before writing code** — wireframes, color theory, and design tokens that the implementation phase builds against.

## What It Does

Most AI-generated frontends look the same because they skip the design step. This plugin adds it back with a two-phase workflow:

**Phase 1 — Design Spec:**
- ASCII wireframe with annotations for layout, interactions, and responsive behavior
- Color system built from OKLCH color theory (harmony rules, semantic scales, contrast validation)
- Complete design tokens as CSS custom properties (colors, typography, spacing, motion)

**Phase 2 — Implementation:**
- Code references the wireframe as a layout target
- Every value uses design tokens — no magic numbers
- Visual quality rules enforce distinctive, accessible output

## Why This Exists

The core problem with AI-generated UI isn't creativity — it's consistency and correctness. A prompt that says "be bold" produces one good component. But across a multi-page app, without a shared design system, every component makes independent aesthetic choices that clash.

This plugin solves that by generating the design system first, then constraining implementation to use it. The result is an interface where colors, typography, spacing, and interaction patterns are coherent across every view.

### Color Theory, Not Color Guessing

Instead of picking arbitrary hex values, the color system uses:
- **OKLCH color space** for perceptually uniform palettes (same perceived lightness across hues)
- **Harmony rules** (complementary, analogous, triadic, split-complementary) grounded in color theory
- **12-step semantic scales** where each step has a defined role (background, border, text, etc.)
- **WCAG contrast validation** — every text/background pair is checked mathematically, not eyeballed

### Wireframe-First, Not Code-First

ASCII wireframes are generated for every view before any code is written. These wireframes:
- Define spatial layout using box-drawing characters
- Include annotations for interactions, responsive behavior, and animation
- Serve as the acceptance criteria for implementation

## Usage

When you ask Claude to build frontend interfaces, it will automatically:

1. Ask about purpose, audience, and aesthetic direction
2. Generate wireframes for each view
3. Build a color system using color theory
4. Output complete design tokens
5. Present the full spec for review
6. Implement code that matches the spec

```
"Create a dashboard for a music streaming app"
"Build a landing page for a developer tools company"
"Design a settings panel with dark mode support"
```

## Structure

```
frontend-design-system/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   └── frontend-design-system/
│       └── SKILL.md
└── README.md
```

## Installation

Copy this directory into your Claude Code plugins folder, or add it to your project's `.claude/plugins/` directory.

---

Crafted by Shareef (shareef@shareefellis.com)
