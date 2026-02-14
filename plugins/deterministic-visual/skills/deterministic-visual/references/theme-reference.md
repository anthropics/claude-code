# Theme Reference — beautiful-mermaid Compatible

## Theme Architecture

beautiful-mermaid uses a **two-color foundation** system:

- **bg** — Background color (canvas/terminal background)
- **fg** — Foreground color (primary text and lines)

All other colors derive from these two via `color-mix()` in CSS. For enriched mode, override specific slots:

| Slot | Purpose | Default derivation |
|------|---------|--------------------|
| `line` | Edge and connector lines | mix(fg, bg, 30%) |
| `accent` | Primary highlight, active elements | User-defined |
| `muted` | Secondary text, labels | mix(fg, bg, 50%) |
| `surface` | Node backgrounds | mix(bg, fg, 5%) |
| `border` | Node borders | mix(fg, bg, 20%) |

## ANSI Color Mapping

For terminal rendering, beautiful-mermaid RGB values map to ANSI escape codes:

```
RGB(r, g, b) → \033[38;2;{r};{g};{b}m   (24-bit true color)
```

### Fallback: 256-Color Palette

For terminals without true color:

```javascript
function rgbTo256(r, g, b) {
  // Check grayscale first (232-255)
  if (r === g && g === b) {
    if (r < 8) return 16;
    if (r > 248) return 231;
    return Math.round((r - 8) / 247 * 24) + 232;
  }
  // 6x6x6 color cube (16-231)
  return 16 + (36 * Math.round(r / 255 * 5))
            + (6 * Math.round(g / 255 * 5))
            + Math.round(b / 255 * 5);
}
```

## Built-In Themes

### vercel-dark
```
bg: #000000  fg: #ededed  accent: #0070f3
line: #444444  muted: #888888  surface: #111111  border: #333333
nodeColors: #0070f3 #7c3aed #ec4899 #eab308 #10b981
```
Best for: Default dark terminals, high contrast displays

### vercel-light
```
bg: #ffffff  fg: #000000  accent: #0070f3
line: #d4d4d4  muted: #737373  surface: #fafafa  border: #e5e5e5
nodeColors: #0070f3 #7c3aed #db2777 #ca8a04 #059669
```
Best for: Light terminal themes, printing

### dracula
```
bg: #282a36  fg: #f8f8f2  accent: #bd93f9
line: #44475a  muted: #6272a4  surface: #303241  border: #44475a
nodeColors: #ff79c6 #bd93f9 #8be9fd #50fa7b #ffb86c
```
Best for: Purple-accented aesthetics, long coding sessions

### nord
```
bg: #2e3440  fg: #d8dee9  accent: #88c0d0
line: #3b4252  muted: #4c566a  surface: #3b4252  border: #434c5e
nodeColors: #88c0d0 #81a1c1 #5e81ac #a3be8c #bf616a
```
Best for: Cool blue tones, Arctic aesthetics

### tokyo-night
```
bg: #1a1b26  fg: #c0caf5  accent: #7aa2f7
line: #292e42  muted: #565f89  surface: #24283b  border: #292e42
nodeColors: #7aa2f7 #bb9af7 #ff9e64 #9ece6a #f7768e
```
Best for: Warm accents on cool backgrounds

### catppuccin-mocha
```
bg: #1e1e2e  fg: #cdd6f4  accent: #89b4fa
line: #313244  muted: #6c7086  surface: #24273a  border: #313244
nodeColors: #89b4fa #cba6f7 #f9e2af #a6e3a1 #f38ba8
```
Best for: Soft pastels on dark backgrounds

### github-dark
```
bg: #0d1117  fg: #e6edf3  accent: #58a6ff
line: #30363d  muted: #7d8590  surface: #161b22  border: #30363d
nodeColors: #58a6ff #bc8cff #ff7b72 #3fb950 #d29922
```
Best for: GitHub-native appearance

### rose-pine
```
bg: #191724  fg: #e0def4  accent: #c4a7e7
line: #26233a  muted: #6e6a86  surface: #1e1c2c  border: #26233a
nodeColors: #c4a7e7 #ebbcba #f6c177 #9ccfd8 #31748f
```
Best for: Muted romantic aesthetics

### gruvbox-dark
```
bg: #282828  fg: #ebdbb2  accent: #fabd2f
line: #3c3836  muted: #928374  surface: #32302f  border: #3c3836
nodeColors: #fabd2f #b8bb26 #d3869b #8ec07c #fe8019
```
Best for: Warm retro aesthetics

### monokai
```
bg: #272822  fg: #f8f8f2  accent: #66d9ef
line: #3e3d32  muted: #75715e  surface: #31322b  border: #3e3d32
nodeColors: #f92672 #66d9ef #a6e22e #fd971f #ae81ff
```
Best for: Classic syntax highlighting colors

## Theme Selection Guide

| Context | Recommended Theme |
|---------|------------------|
| Dark terminal (default) | `vercel-dark` |
| Light terminal | `vercel-light` |
| Presentations | `dracula` or `catppuccin-mocha` |
| Documentation | `github-dark` |
| Accessibility (high contrast) | `vercel-dark` |
| Aesthetics priority | `rose-pine` or `tokyo-night` |
| Retro / warm feel | `gruvbox-dark` or `monokai` |

## Custom Theme Creation

Define a custom theme by providing RGB arrays:

```javascript
const customTheme = {
  bg: [30, 30, 46],
  fg: [205, 214, 244],
  accent: [137, 180, 250],
  line: [49, 50, 68],
  muted: [108, 112, 134],
  surface: [36, 39, 58],
  border: [49, 50, 68],
  nodeColors: [
    [137, 180, 250],  // Blue
    [203, 166, 247],  // Purple
    [249, 226, 175],  // Yellow
    [166, 227, 161],  // Green
    [243, 139, 168],  // Red
  ],
};
```

The `nodeColors` array cycles for nodes: node 0 gets color 0, node 1 gets color 1, etc.
