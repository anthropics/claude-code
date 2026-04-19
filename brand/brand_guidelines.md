# Ethos Aegis Brand Guidelines

## Overview

Ethos Aegis is an agentic immune verification framework — a system that treats AI pipelines as living organisms requiring active digital immune defense. The visual identity reflects this biomimetic metaphor: precision engineering expressed through biological form, classical authority expressed through modern architecture.

---

## 1. Logo Usage

### Primary Wordmark

The Ethos Aegis logo consists of a **shield icon** paired with the **wordmark** in two typographic tiers:

- **"ETHOS AEGIS"** — uppercase serif, Aureate Gold (`#C9A84C`)
- **"Agentic Immune Veriflow"** — spaced-tracking sans-serif, Slate Gray (`#6B7A90`)

### Clear Space

Maintain a minimum clear space equal to the height of the capital "E" in the wordmark on all four sides. Never place the logo on a background lighter than `#1C2433` (Ink Black).

### Approved Backgrounds

| Background | Logo Variant |
|---|---|
| `#0D1117` Void Black | Full color (gold + green) |
| `#1C2433` Ink Black | Full color (gold + green) |
| White / Light | Dark monochrome (single-color black) |

### Prohibited Usage

- Do not rotate or skew the logo
- Do not recolor the wordmark outside of approved palettes
- Do not separate the shield icon from the wordmark for primary identity use
- Do not place on busy photographic backgrounds without a dark overlay

---

## 2. Typography System

### Heading Typeface — Serif Authority

**Recommended:** EB Garamond, Cormorant Garamond, or Georgia (fallback)

```css
font-family: 'EB Garamond', 'Cormorant Garamond', Georgia, serif;
font-weight: 600;
letter-spacing: 0.04em;
color: #C9A84C;
```

Used for: Section headers, product name, verdict labels, critical alerts.

### Body Typeface — Sans-Serif Clarity

**Recommended:** Inter, IBM Plex Sans, or system-ui (fallback)

```css
font-family: 'Inter', 'IBM Plex Sans', system-ui, sans-serif;
font-weight: 400;
line-height: 1.6;
color: #E8C96A;
```

Used for: Body copy, descriptions, metadata, tooltips.

### Monospace — Technical Precision

**Recommended:** JetBrains Mono, Fira Code, or monospace (fallback)

```css
font-family: 'JetBrains Mono', 'Fira Code', monospace;
font-weight: 400;
color: #00E57A;
```

Used for: Code blocks, verdict output, trace IDs, hash values.

### Type Scale

| Level | Size | Weight | Color |
|---|---|---|---|
| Display | 48px / 3rem | 700 | `#C9A84C` |
| H1 | 36px / 2.25rem | 600 | `#C9A84C` |
| H2 | 28px / 1.75rem | 600 | `#E8C96A` |
| H3 | 22px / 1.375rem | 500 | `#E8C96A` |
| Body | 16px / 1rem | 400 | `#9BAAB8` |
| Small | 13px / 0.8125rem | 400 | `#6B7A90` |
| Code | 14px / 0.875rem | 400 | `#00E57A` |

---

## 3. Color Palette Reference

See [`color_scheme.md`](./color_scheme.md) for the complete color system.

### Quick Reference

| Token | Hex | Usage |
|---|---|---|
| `--color-primary-gold` | `#C9A84C` | Brand primary, CTA, emphasis |
| `--color-primary-black` | `#0D1117` | Background base |
| `--color-primary-green` | `#00E57A` | Sanctified, success, vitality |
| `--color-primary-red` | `#FF4F5E` | Condemned, critical, danger |
| `--color-secondary-bronze` | `#8B6E2A` | Earth tone accent, legacy |
| `--color-secondary-sage` | `#6B7A90` | Neutral, borders, secondary text |
| `--color-secondary-cream` | `#E8C96A` | Warm highlight, knowledge |

---

## 4. Component Patterns

### Verdict Badge

Verdict badges use a pill shape with a left border accent:

```html
<span class="verdict verdict--sanctified">✓ Sanctified</span>
<span class="verdict verdict--condemned">✗ Condemned</span>
```

```css
.verdict {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  padding: 0.25em 0.75em;
  border-radius: 9999px;
  border-left: 3px solid currentColor;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  background: rgba(13, 17, 23, 0.8);
}
.verdict--sanctified { color: #00E57A; }
.verdict--trace      { color: #4D9FFF; }
.verdict--quarantine { color: #F5C842; }
.verdict--grave      { color: #FF9A3C; }
.verdict--condemned  { color: #FF4F5E; }
```

### Sentinel Cell Chip

```html
<span class="sentinel-chip">⬡ VanguardProbe</span>
```

```css
.sentinel-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  padding: 0.2em 0.6em;
  border: 1px solid #C9A84C44;
  border-radius: 4px;
  background: #1C2433;
  color: #C9A84C;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 0.8125rem;
  font-weight: 500;
}
```

### Card / Panel

```css
.panel {
  background: #1C2433;
  border: 1px solid #C9A84C22;
  border-top: 2px solid #C9A84C;
  border-radius: 6px;
  padding: 1.5rem;
}
```

### Alert / Notice

```css
.alert {
  padding: 1rem 1.25rem;
  border-left: 4px solid var(--alert-color, #C9A84C);
  background: color-mix(in srgb, var(--alert-color, #C9A84C) 8%, #0D1117);
  border-radius: 0 4px 4px 0;
}
```

---

## 5. Grid & Layout Architecture

The Ethos Aegis visual style incorporates a **technical grid overlay** — a subtle dot or line grid that references both circuit boards and cellular biology.

```css
.grid-background {
  background-image:
    radial-gradient(circle, #C9A84C18 1px, transparent 1px);
  background-size: 28px 28px;
  background-position: 0 0;
}
```

Primary layouts use an **8-column grid** at 1280px max-width with 24px gutters.

---

## 6. Iconography

- **Shield** — The primary icon; represents immune defense and verification
- **Hexagon** — Represents sentinel cells (biological/honeycomb)
- **DNA helix** — Represents the agentic pipeline lineage
- **Viral sphere** — Represents threat actors (Maligna classes)
- **Checkmark / X** — Verdict outcome indicators

All icons should be monoline or filled at 2px stroke weight, in SVG format at 24×24px base size.

---

## 7. Voice & Tone

| Attribute | Description |
|---|---|
| **Authoritative** | Speaks with precision; no ambiguity in verdicts |
| **Clinical** | Technical, factual; avoids marketing hyperbole |
| **Biomimetic** | Uses biological metaphor (cells, organisms, immune response) |
| **Vigilant** | Assumes adversarial context by default |
| **Principled** | Every decision is traceable to an ethical axiom |

### Writing Examples

✓ **Correct:** "VanguardProbe detected a MoralMaligna pattern in the upstream agent context."  
✗ **Incorrect:** "We found a potential issue that might be a problem."

✓ **Correct:** "Verdict: Condemned. Confidence: 0.94. Threat Class: SystemicMaligna."  
✗ **Incorrect:** "This looks bad. We're not sure but it could be dangerous."

---

## 8. Application Examples

### GitHub Repository

- **Repository description:** Use the tagline: *"Agentic Immune Verification — defending AI pipelines through biomimetic trust architecture."*
- **Topics:** `ai-safety`, `llm`, `verification`, `immune-system`, `agentic`, `ethics`
- **Social preview:** Use `brand/social_banner.svg`
- **Favicon / avatar:** Use `brand/favicon.svg`

### README Badges

```markdown
![Verdict](https://img.shields.io/badge/verdict-sanctified-00E57A?style=flat-square&logo=shield&logoColor=white)
![Threat Class](https://img.shields.io/badge/threat-none-0D1117?style=flat-square)
![Sentinel](https://img.shields.io/badge/sentinel-VanguardProbe-C9A84C?style=flat-square)
```

### Issue Labels

All GitHub issues use branded labels from `.github/scripts/setup_labels.sh`. Verdict labels use their corresponding palette colors; sentinel cell labels use gold-family tones; threat labels use severity-mapped colors.

---

## 9. Dark Mode

All Ethos Aegis interfaces are **dark-first**. The light-mode variant is a secondary consideration using inverted foreground/background with the same accent palette.

```css
@media (prefers-color-scheme: light) {
  :root {
    --bg-base: #F5F0E8;
    --bg-surface: #EDE7D9;
    --text-primary: #0D1117;
    --text-secondary: #1C2433;
    --accent-primary: #8B6E2A;   /* darker gold for light bg contrast */
    --accent-green: #00804A;
    --accent-red: #C0002A;
  }
}
```

---

*Last updated: 2026 — Ethos Aegis Branding v1.0*
