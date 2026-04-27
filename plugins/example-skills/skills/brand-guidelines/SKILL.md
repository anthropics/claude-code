---
name: brand-guidelines
description: This skill should be used when the user asks to "apply brand guidelines", "use our brand colors", "follow brand standards", "create on-brand designs", "ensure brand consistency", "apply our style guide", or when the user provides brand assets and wants Claude to maintain visual consistency with their company's identity.
version: 1.0.0
---

# Brand Guidelines Application

This skill helps apply and maintain visual brand consistency across designs, documents, and digital assets.

## What Brand Guidelines Typically Include

Before applying guidelines, identify what the user has provided or needs:

1. **Color palette** — Primary, secondary, and accent colors (hex/RGB/CMYK)
2. **Typography** — Font families, weights, sizes for headings/body/captions
3. **Logo usage** — Spacing, size, color variations, don'ts
4. **Voice & tone** — Formal/informal, adjectives describing the brand
5. **Imagery style** — Photo treatment, illustration style
6. **Spacing & layout** — Grid system, margins, component spacing

## Extracting Guidelines from User Input

When users provide guidelines, extract and systematize them:

```markdown
Ask if not provided:
- "What are your primary brand colors? (hex codes preferred)"
- "What fonts does your brand use?"
- "Do you have a logo file or color variants of it?"
- "Formal or casual tone?"
```

## Applying to CSS/Design Systems

### CSS Custom Properties (recommended approach)

```css
:root {
  /* Colors */
  --color-primary: #0055A5;
  --color-secondary: #FF6B35;
  --color-accent: #00C896;
  --color-neutral-100: #F8F9FA;
  --color-neutral-900: #1A1A2E;

  /* Typography */
  --font-display: 'Brand Display Font', sans-serif;
  --font-body: 'Brand Body Font', Georgia, serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* Sizing scale */
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.25rem;
  --text-2xl: 1.5rem;
  --text-4xl: 2.25rem;

  /* Spacing */
  --space-unit: 8px;
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 16px;
}
```

### Tailwind Config (if using Tailwind)

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#0055A5',
          secondary: '#FF6B35',
          accent: '#00C896',
        }
      },
      fontFamily: {
        display: ['Brand Display', 'sans-serif'],
        body: ['Brand Body', 'Georgia', 'serif'],
      }
    }
  }
}
```

## Typography Hierarchy

Apply a consistent type scale:

| Element | Size | Weight | Style |
|---------|------|--------|-------|
| H1 | 2.25rem | 700 | Display font |
| H2 | 1.75rem | 600 | Display font |
| H3 | 1.375rem | 600 | Body font |
| Body | 1rem | 400 | Body font |
| Caption | 0.875rem | 400 | Body font |
| Button | 0.875rem | 600 | Body font, uppercase |

## Logo Usage Rules

When working with logos:

- Maintain clear space = at least 1x the logo height on all sides
- Never stretch, skew, or rotate logos
- Use approved color versions only (full color, white, black)
- Minimum size: typically 24px height for digital, 0.5" for print
- Don't add effects (shadows, outlines, gradients) unless specified

## Brand Voice in Copy

Apply voice guidelines to any text:

```
Formal brand: "We are committed to delivering excellence."
Casual brand: "We're here to make things easier for you."
Technical brand: "Configure your pipeline in under 5 minutes."
Playful brand: "Let's build something awesome together! 🚀"
```

## Consistency Checklist

Before finalizing any branded asset:

- [ ] Colors match brand palette (no off-brand colors)
- [ ] Typography uses only approved fonts and weights
- [ ] Logo used correctly with proper spacing
- [ ] Tone matches brand voice guidelines
- [ ] Imagery style consistent (photos vs illustrations, treatment)
- [ ] Spacing follows the grid/spacing system
- [ ] Accessible contrast ratios maintained (WCAG AA: 4.5:1 for text)

## Best Practices

- Store brand tokens as CSS variables or design tokens for easy global updates
- When brand assets aren't provided, ask before inventing brand elements
- Always verify color accessibility: use a contrast checker for text on backgrounds
- If guidelines conflict with accessibility, flag it and suggest compliant alternatives
- For multi-brand contexts, namespace CSS variables by brand: `--brand-acme-primary`
