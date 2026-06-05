---
name: frontend-design-system
description: Design-first frontend development with wireframe specs and color theory. Use this skill when the user asks to build web components, pages, or applications. Generates a design spec (wireframe + color system + tokens) BEFORE writing code, then implements to match the spec. Produces distinctive, accessible, production-grade interfaces.
---

This skill implements a two-phase design-first workflow for frontend development. Phase 1 produces a design spec. Phase 2 implements code that matches the spec. This order is non-negotiable — never write UI code without a spec to build against.

## Phase 1: Design Spec

Before writing any implementation code, produce a complete design spec with three sections: wireframe, color system, and design tokens.

### 1A: Understand the Context

Before designing, understand what you're building:

- **Purpose**: What problem does this interface solve? Who uses it?
- **Aesthetic direction**: Commit to a specific direction. Not "modern" or "clean" — those are meaningless. Pick something with teeth: editorial/magazine, brutalist/raw, luxury/refined, retro-futuristic, organic/natural, industrial/utilitarian, art deco/geometric, soft/pastel, maximalist/layered, monochrome/typographic. Use these as starting points, not labels — the final aesthetic should feel original.
- **Constraints**: Framework, browser targets, accessibility level (AA minimum, AAA if specified), responsive breakpoints.
- **The memorable thing**: What's the one detail someone would describe to a friend? Every good interface has one. Decide it now.

### 1B: Wireframe

Generate an ASCII wireframe for each major view at the primary breakpoint. Use box-drawing characters for structure.

**The layout MUST reflect the chosen aesthetic direction.** Do not default to centered-nav-over-card-grid — that's the most common layout on the web and the fastest path to looking generic. An "editorial" aesthetic should use asymmetric columns or magazine-style flow. A "brutalist" aesthetic should use hard-aligned blocks with deliberate tension. An "industrial" aesthetic might use a dense sidebar-main split. The wireframe is your first opportunity to establish personality — don't waste it on a template.

Example (conventions only — your actual layout should be project-specific):

```
┌───────────────────────────────────────────────────┐
│ BRAND          ┌──────────────────────────────┐   │
│                │  ░░░░░░░░░░░░░░░░░░░░░░░░░░  │   │
│ Nav Item       │  Heading text here            │   │
│ Nav Item       │  Body text flows in this      │   │
│ Nav Item       │  main content area            │   │
│                │  [Action]      [Secondary]    │   │
│ [__Search__]   └──────────────────────────────┘   │
└───────────────────────────────────────────────────┘
```

**Wireframe conventions:**
- `[Button]` — interactive button
- `[__input__]` — text field
- `[Option ▼]` — dropdown/select
- `[✓] Label` — checkbox
- `(●) Label` — radio button
- `[████░░░░░░]` — progress bar
- `░░░░░░░░░░` — image/media placeholder
- `───` — divider/separator

**Below each wireframe**, add an annotation block:

```
ANNOTATIONS:
- header: sticky, 64px height, blur backdrop
- card-grid: 2 columns desktop, 1 column mobile (<768px)
- cards: hover, focus-visible → lift shadow + scale 1.02, 200ms ease
- [Action]: primary color, navigates to /signup
```

**Every interactive element MUST have a `:focus-visible` style defined in annotations.** Hover-only interactions are inaccessible to keyboard users. If an element has a hover state, it also has a focus-visible state. No exceptions.

If the project has multiple views (e.g., dashboard + detail page + settings), wireframe each one. Consistent structural elements (nav, sidebar) should be identical across wireframes.

For responsive projects, wireframe the primary breakpoint in full detail, then add a brief note describing what changes at other breakpoints (e.g., "Mobile: nav collapses to hamburger, card grid becomes single column, sidebar moves to bottom sheet").

### 1C: Color System

Build a color palette grounded in color theory, not arbitrary hex values.

**Step 1 — Choose a base hue.** This is the primary brand/accent color. Start from the aesthetic direction, not the domain.

Common associations exist (blue = trust, green = growth, etc.) but defaulting to them produces the most predictable result. Challenge the obvious choice: a developer tool doesn't have to be green-on-dark. A finance app doesn't have to be blue. Ask: **what color would be unexpected but still feel right for this aesthetic?**

A "luxury" bank might use deep gold (50°) or plum (310°) instead of corporate blue. A "brutalist" fitness app might use industrial yellow (85°) instead of energetic red. A CLI tool landing page could use warm amber (55°) instead of terminal green. The aesthetic direction — not the industry — should drive the hue.

**Step 2 — Generate a harmony.** From the base hue, choose a color relationship:

| Harmony | Rule | Best for |
|---------|------|----------|
| **Complementary** | Base + (base + 180°) | High-contrast, bold interfaces |
| **Analogous** | Base + (base ± 30°) | Harmonious, calm interfaces |
| **Split-complementary** | Base + (base + 150°) + (base + 210°) | Balanced contrast without harshness |
| **Triadic** | Base + (base + 120°) + (base + 240°) | Vibrant, playful interfaces |

In OKLCH, hue rotation preserves perceptual lightness — `oklch(0.7 0.15 H)` looks equally vivid at any hue, unlike HSL where "50% lightness" varies wildly across the spectrum.

**Step 3 — Build semantic scales.** For each hue in the harmony, generate a 12-step scale. Each step has a defined role:

| Step | Role | Lightness (L) | Usage |
|------|------|---------------|-------|
| 1 | App background | 0.97–0.99 | Page canvas |
| 2 | Subtle background | 0.94–0.96 | Cards, sections |
| 3 | Element background | 0.90–0.93 | Buttons (rest), inputs |
| 4 | Hovered element | 0.86–0.89 | Hover states |
| 5 | Active/selected | 0.82–0.85 | Active states, selected items |
| 6 | Subtle border | 0.77–0.80 | Dividers, subtle separators |
| 7 | Border | 0.70–0.75 | Input borders, focus rings |
| 8 | Strong border | 0.62–0.67 | Hovered borders |
| 9 | Solid background | 0.55–0.62 | Primary buttons, badges — highest chroma |
| 10 | Hovered solid | 0.50–0.57 | Hover on solid backgrounds |
| 11 | Low-contrast text | 0.40–0.48 | Secondary text, labels |
| 12 | High-contrast text | 0.25–0.35 | Headings, body text |

Also generate a neutral scale (gray with a slight tint of the base hue — this prevents the "dead gray" look). The neutral scale follows the same 12 steps.

**Lightness ramp tuning:** The ranges above produce an even, smooth ramp — good for standard UIs. But different aesthetics need different "contrast velocity." For **soft/pastel** styles, compress the ramp (smaller jumps between steps, staying in the 0.70–0.98 range). For **brutalist/high-contrast** styles, widen the jumps (skip the middle — go straight from light backgrounds to dark text with minimal mid-tones). For **moody/atmospheric** styles, cluster more steps in the dark end (0.15–0.45) and leave fewer for light. The ramp shape is an aesthetic choice, not a fixed formula.

**Step 4 — Validate contrast.** Check these critical pairs against WCAG 2.x (4.5:1 for normal text, 3:1 for large text):

| Pair | Minimum ratio | Why |
|------|--------------|-----|
| Step 12 on Step 1 | 4.5:1 | Body text on background |
| Step 12 on Step 2 | 4.5:1 | Body text on cards |
| Step 11 on Step 1 | 4.5:1 | Secondary text on background |
| Step 11 on Step 2 | 3:1 | Secondary text on cards (large text OK) |
| Step 1 on Step 9 | 4.5:1 | White text on primary buttons |

To calculate contrast ratio: convert both colors to sRGB, compute relative luminance `L = 0.2126R + 0.7152G + 0.0722B` (with gamma correction), then ratio = `(L_lighter + 0.05) / (L_darker + 0.05)`. If a pair fails, adjust the darker color's lightness down or the lighter color's lightness up until it passes. Do not skip this step — an inaccessible palette is a broken palette.

**Step 5 — Dark mode (if applicable).** Invert the lightness scale: step 1 becomes the darkest (L: 0.12–0.15), step 12 becomes the lightest (L: 0.93–0.97). Chroma may need slight reduction at high lightness to stay in gamut. The semantic roles stay the same — step 9 is still "solid background."

### 1D: Design Tokens

Output the complete design system as CSS custom properties. This is the single source of truth for implementation.

```css
:root {
  /* === Color: Primary (base hue) === */
  --color-primary-1: oklch(0.98 0.01 250);
  --color-primary-2: oklch(0.95 0.03 250);
  /* ... through step 12 */
  --color-primary-9: oklch(0.58 0.18 250);  /* solid backgrounds */
  --color-primary-12: oklch(0.30 0.08 250); /* high-contrast text */

  /* === Color: Accent (harmony hue) === */
  --color-accent-1: oklch(0.98 0.01 30);
  /* ... through step 12 */

  /* === Color: Neutral (tinted gray) === */
  --color-neutral-1: oklch(0.98 0.005 250);
  /* ... through step 12 */

  /* === Color: Semantic === */
  --color-success: oklch(0.58 0.16 155);
  --color-warning: oklch(0.75 0.15 75);
  --color-error: oklch(0.58 0.20 25);

  /* === Typography === */
  --font-display: 'Font Name', fallback, generic;
  --font-body: 'Font Name', fallback, generic;
  --font-mono: 'Font Name', fallback, monospace;

  --text-xs: 0.75rem;    /* 12px */
  --text-sm: 0.875rem;   /* 14px */
  --text-base: 1rem;     /* 16px */
  --text-lg: 1.25rem;    /* 20px */
  --text-xl: 1.5rem;     /* 24px */
  --text-2xl: 2rem;      /* 32px */
  --text-3xl: 2.5rem;    /* 40px */

  --leading-tight: 1.2;
  --leading-normal: 1.5;
  --leading-relaxed: 1.75;

  --tracking-tight: -0.02em;
  --tracking-normal: 0;
  --tracking-wide: 0.05em;

  /* === Spacing === */
  --space-1: 0.25rem;    /* 4px */
  --space-2: 0.5rem;     /* 8px */
  --space-3: 0.75rem;    /* 12px */
  --space-4: 1rem;       /* 16px */
  --space-6: 1.5rem;     /* 24px */
  --space-8: 2rem;       /* 32px */
  --space-12: 3rem;      /* 48px */
  --space-16: 4rem;      /* 64px */

  /* === Radius === */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 16px;
  --radius-full: 9999px;

  /* === Shadows === */
  --shadow-sm: 0 1px 2px oklch(0 0 0 / 0.05);
  --shadow-md: 0 4px 12px oklch(0 0 0 / 0.08);
  --shadow-lg: 0 12px 32px oklch(0 0 0 / 0.12);

  /* === Motion === */
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 400ms;
}
```

**Typography rules:**
- Choose fonts that match the aesthetic direction. Avoid overused defaults: Inter, Roboto, Arial, system-ui, Space Grotesk are banned unless the aesthetic specifically demands it.
- Pair a distinctive display font with a refined body font. Contrast in style (serif display + sans body, or geometric display + humanist body) creates visual interest.
- Google Fonts is free. Prefer fonts with variable weight support for flexibility.

**The design spec is complete when it has:** (1) ASCII wireframe with annotations for every view, (2) color system with harmony rationale and contrast validation, (3) full CSS custom properties block, (4) typography choices with rationale. Present the complete spec to the user before proceeding to Phase 2.

---

## Phase 2: Implementation

Now write the code. The design spec is your blueprint — implementation must match it.

### Structural rules

- **Reference the wireframe.** The ASCII wireframe defines what goes where. Every structural element in the wireframe must appear in the implementation. If you deviate, state why.
- **Use the tokens.** Every color, font, spacing, radius, and shadow value in the code must reference a CSS custom property from the design spec. No magic numbers. No inline hex values. `var(--color-primary-9)`, not `#3b82f6`.
- **Match the annotations.** Hover states, focus-visible states, responsive behavior, animation details specified in annotations must be implemented as described.
- **Use semantic HTML.** `<nav>`, `<main>`, `<section>`, `<header>`, `<footer>`, `<button>` — use the right element for the job. Clickable things are `<button>` or `<a>`, not `<div>`. Add ARIA labels where native semantics are insufficient (icon-only buttons, complex widgets). This is not optional polish — it's baseline correctness.
- **Focus states are mandatory.** Every interactive element needs a visible `:focus-visible` style. Use a focus ring (`outline` or `box-shadow`) that contrasts against the background. If an element has a hover effect, it also has a focus-visible effect.

### Visual quality rules

- **Color:** Choose a distribution model that matches the aesthetic, not a fixed default. **60-30-10** (60% neutral, 30% primary, 10% accent) is the safe standard — use it for refined or editorial aesthetics. **Monochrome 90/10** (90% neutrals, 10% single vivid accent) for minimalist work. **High-contrast 50/50** (two primary hues in near-equal measure) for brutalist or retro-futuristic styles. **Analogous wash** (70% of a warm or cool family, 30% neutral) for organic or immersive aesthetics. Pick the model consciously. If your harmony defines multiple accent hues, assign each a distinct role and document them in annotations so nothing goes unused.
- **Typography:** Set the type scale using the tokens. Display font for headings, body font for everything else. Establish clear hierarchy through size AND weight — don't rely on size alone. Letter-spacing matters: tighten headings (`--tracking-tight`), leave body at default.
- **Spatial composition:** The wireframe shows the structure. Within that structure, use spacing tokens consistently. Asymmetry and generous whitespace create sophistication. Grid-breaking elements (a full-bleed image, an oversized heading) create visual interest — use one per view, not everywhere.
- **Motion:** Prioritize page-load choreography (staggered reveals with `animation-delay`) over scattered micro-interactions. One well-orchestrated entrance creates more impact than twenty hover effects. For interactions: hover states should feel responsive (150ms), transitions should feel smooth (250ms with `--ease-out`).
- **Backgrounds and depth:** Avoid flat solid backgrounds. Add atmosphere: subtle gradients, noise textures (`background-image: url("data:image/svg+xml,...")`), layered transparencies, or tonal shifts between sections using adjacent scale steps (step 1 → step 2 → step 1).

### What to avoid

- Generic AI aesthetics: purple gradients on white, card grids with rounded corners, blue CTAs. If it looks like every other AI-generated page, start over.
- Same design twice: Every project should look different. Vary themes (light/dark), palettes, font choices, and layout patterns between projects. If you notice yourself reaching for the same combination, stop and choose differently.
- Decoration without purpose: Every visual element should serve the interface. A gradient that guides the eye toward the CTA is purposeful. A gradient that exists because gradients look cool is decoration.
- Ignoring the spec: If the wireframe shows a sidebar, build a sidebar. If the tokens define `--color-accent-9`, use it for accents. The spec exists so the result is coherent.

### Delivering the result

Output production-grade code (HTML/CSS/JS, React, Vue, Svelte — whatever fits the context). The code must:

1. Include the CSS custom properties block from the design spec (copy it verbatim into a `:root` block or theme file)
2. Reference tokens by variable name throughout — no hardcoded values
3. Match the wireframe layout at the primary breakpoint
4. Implement responsive behavior described in annotations
5. Include the motion/animation details from annotations
6. Pass the contrast requirements validated in the color system

The implementation is complete when someone comparing the wireframe to the built result would say "same thing."
