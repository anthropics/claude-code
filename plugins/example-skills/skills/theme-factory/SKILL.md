---
name: theme-factory
description: This skill should be used when the user asks to "create a color theme", "design a theme", "generate a dark theme", "create a light/dark mode", "build a design system colors", "create a theme for my app", "generate CSS variables for a theme", "create a Tailwind theme", or design cohesive color schemes and visual tokens for applications.
version: 1.0.0
---

# Theme Factory

This skill guides the creation of cohesive color themes and design token systems for web applications and design systems.

## Theme Creation Process

1. **Identify the brand personality**: Modern/minimal, vibrant/energetic, professional/corporate, playful/creative
2. **Choose a base hue**: The primary color anchors the theme
3. **Build a tonal palette**: Light to dark variants of the primary hue
4. **Add semantic colors**: Success, warning, error, info
5. **Define neutrals**: Background, surface, border, and text shades
6. **Validate contrast**: Ensure WCAG AA compliance (4.5:1 for body text)

## CSS Custom Properties (Recommended)

```css
:root {
  /* === Primary Palette === */
  --color-primary-50:  #eff6ff;
  --color-primary-100: #dbeafe;
  --color-primary-200: #bfdbfe;
  --color-primary-300: #93c5fd;
  --color-primary-400: #60a5fa;
  --color-primary-500: #3b82f6;  /* Base */
  --color-primary-600: #2563eb;
  --color-primary-700: #1d4ed8;
  --color-primary-800: #1e40af;
  --color-primary-900: #1e3a8a;

  /* === Semantic Colors === */
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-error:   #ef4444;
  --color-info:    #3b82f6;

  /* === Neutrals === */
  --color-neutral-50:  #f9fafb;
  --color-neutral-100: #f3f4f6;
  --color-neutral-200: #e5e7eb;
  --color-neutral-300: #d1d5db;
  --color-neutral-400: #9ca3af;
  --color-neutral-500: #6b7280;
  --color-neutral-600: #4b5563;
  --color-neutral-700: #374151;
  --color-neutral-800: #1f2937;
  --color-neutral-900: #111827;

  /* === Semantic Aliases (Light Mode) === */
  --color-bg:           var(--color-neutral-50);
  --color-surface:      #ffffff;
  --color-border:       var(--color-neutral-200);
  --color-text:         var(--color-neutral-900);
  --color-text-muted:   var(--color-neutral-500);
  --color-accent:       var(--color-primary-500);
  --color-accent-hover: var(--color-primary-600);
}

/* Dark Mode */
[data-theme="dark"] {
  --color-bg:         var(--color-neutral-900);
  --color-surface:    var(--color-neutral-800);
  --color-border:     var(--color-neutral-700);
  --color-text:       var(--color-neutral-50);
  --color-text-muted: var(--color-neutral-400);
}
```

## Dark/Light Toggle

```javascript
// Toggle theme
const toggle = () => {
    const current = document.documentElement.getAttribute('data-theme');
    document.documentElement.setAttribute(
        'data-theme',
        current === 'dark' ? 'light' : 'dark'
    );
    localStorage.setItem('theme', document.documentElement.getAttribute('data-theme'));
};

// Restore on load
const saved = localStorage.getItem('theme') ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
document.documentElement.setAttribute('data-theme', saved);
```

## Tailwind CSS Theme

```javascript
// tailwind.config.js
const colors = require('tailwindcss/colors');

module.exports = {
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                primary: {
                    50:  '#eff6ff',
                    500: '#3b82f6',
                    600: '#2563eb',
                    900: '#1e3a8a',
                },
                brand: {
                    bg:      '#0f172a',
                    surface: '#1e293b',
                    border:  '#334155',
                }
            },
            fontFamily: {
                sans: ['Inter var', 'system-ui', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            },
            borderRadius: {
                DEFAULT: '8px',
                lg: '12px',
                xl: '16px',
            },
            boxShadow: {
                soft: '0 2px 8px 0 rgba(0,0,0,0.08)',
                card: '0 4px 24px 0 rgba(0,0,0,0.12)',
            }
        }
    }
}
```

## Common Theme Presets

### Minimal Light

```css
:root {
  --bg: #ffffff; --surface: #f8fafc; --border: #e2e8f0;
  --text: #0f172a; --muted: #64748b;
  --accent: #6366f1; --accent-hover: #4f46e5;
}
```

### Dark Hacker

```css
:root {
  --bg: #0d1117; --surface: #161b22; --border: #30363d;
  --text: #e6edf3; --muted: #8b949e;
  --accent: #58a6ff; --accent-hover: #79c0ff;
}
```

### Warm Earth

```css
:root {
  --bg: #fdf6ec; --surface: #fff8f0; --border: #e8d5b7;
  --text: #2c1810; --muted: #8b6347;
  --accent: #c2611f; --accent-hover: #a0521a;
}
```

### Cyberpunk Neon

```css
:root {
  --bg: #0a0a0f; --surface: #12121a; --border: #1a1a2e;
  --text: #e0e0ff; --muted: #6060a0;
  --accent: #00ffcc; --accent-hover: #00e6b8;
}
```

## Generating Palettes Programmatically

```javascript
// Generate tonal palette from a base hue
function generatePalette(hue, saturation = 70) {
    const lightnesses = [97, 93, 85, 73, 59, 47, 37, 29, 22, 16];
    return lightnesses.map((l, i) => ({
        step: (i + 1) * 100,
        value: `hsl(${hue}, ${saturation}%, ${l}%)`
    }));
}

// Example: generatePalette(217) → blue palette
```

## Accessibility Validation

Always check contrast ratios:

```javascript
// Quick contrast ratio check
function getLuminance(hex) {
    const rgb = parseInt(hex.slice(1), 16);
    const r = (rgb >> 16) / 255, g = ((rgb >> 8) & 0xff) / 255, b = (rgb & 0xff) / 255;
    const toLinear = c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastRatio(hex1, hex2) {
    const l1 = getLuminance(hex1), l2 = getLuminance(hex2);
    const lighter = Math.max(l1, l2), darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
}

// WCAG AA: text needs ≥ 4.5:1, large text ≥ 3:1
```

## Best Practices

- Use semantic aliases (`--color-bg`, `--color-text`) not raw values in component CSS
- Always test both light and dark modes before finalizing
- Include hover/focus/active state variants for interactive colors
- Verify minimum 4.5:1 contrast for body text against its background
- Export themes as JSON tokens for cross-platform use (iOS, Android, Figma)
