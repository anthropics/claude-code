# Ghostty-Style ASCII Animation Specification

## Overview

This specification defines how to produce terminal-native animations inspired by Ghostty's ASCII art rendering approach. The key insight from Ghostty is rendering complex visuals as styled text characters at high frame rates, achieving smooth animation without GPU-accelerated graphics primitives.

## Architecture

```
Mermaid Source → Parser → Layout Engine → Frame Generator → Terminal Player
                                              ↓
                                        Frame Buffer[]
                                              ↓
                                    ANSI Escape Renderer
                                              ↓
                                      stdout (60fps)
```

## Frame Model

Each animation frame is a complete terminal screen buffer:

```
Frame = {
  width:  number     // columns (typically 120)
  height: number     // rows (auto-computed from diagram)
  cells:  Cell[][]   // 2D grid of character cells
}

Cell = {
  char:   string     // single Unicode character
  fg:     [r,g,b]    // foreground color (RGB)
  bg:     [r,g,b]    // background color (RGB, optional)
  bold:   boolean    // bold weight
  dim:    boolean    // dimmed intensity
}
```

## Animation Strategies

### 1. Progressive Reveal (default)

Elements appear rank-by-rank following topological order:

```
Frame 0:  [ empty canvas ]
Frame 1:  [ root node appears ]
Frame 2:  [ root node + first edge ]
Frame 3:  [ root node + edge + child node ]
...
Frame N:  [ all elements visible ]
```

Timing: Each element holds for `1000 / fps * frames_per_element` milliseconds.

### 2. Typewriter

Characters appear left-to-right, top-to-bottom across the canvas:

```
Frame 0:  ╭
Frame 1:  ╭─
Frame 2:  ╭──
Frame 3:  ╭───
Frame 4:  ╭────╮
...
```

### 3. Pulse

All elements are visible; colors cycle through the theme palette:

```
Frame 0:  Node A = accent[0], Node B = accent[1]
Frame 1:  Node A = accent[1], Node B = accent[2]
Frame 2:  Node A = accent[2], Node B = accent[3]
...
```

### 4. Flow

Particles (●) travel along edges from source to target:

```
Frame 0:  A ──────── B  (particle at A)
Frame 1:  A ─●─────── B
Frame 2:  A ───●────── B
Frame 3:  A ─────●──── B
Frame 4:  A ───────●── B
Frame 5:  A ──────── B  (particle arrives at B)
```

## Terminal Rendering

### Cursor Control

- `\033[H` — Move cursor to home (0,0) — used between frames for flicker-free update
- `\033[2J` — Clear screen — used once at animation start
- `\033[?25l` — Hide cursor during animation
- `\033[?25h` — Show cursor on exit (MUST be in cleanup handler)

### Color Encoding

Use 24-bit true color for maximum fidelity with beautiful-mermaid themes:

```
Foreground: \033[38;2;{r};{g};{b}m
Background: \033[48;2;{r};{g};{b}m
Reset:      \033[0m
```

Fallback to 256-color for terminals without true color support:

```
Foreground: \033[38;5;{n}m   (n = 16 + 36*r + 6*g + b, where r,g,b ∈ [0..5])
Background: \033[48;5;{n}m
```

### Frame Rate Control

```javascript
const frameDelay = Math.floor(1000 / fps);

for (const frame of frames) {
  const start = Date.now();
  process.stdout.write('\033[H' + frame);
  const elapsed = Date.now() - start;
  await sleep(Math.max(0, frameDelay - elapsed));
}
```

## Unicode Box-Drawing Reference

### Core Characters

| Purpose | Characters | Usage |
|---------|-----------|-------|
| Rounded corners | ╭ ╮ ╰ ╯ | Node boxes (default) |
| Sharp corners | ┌ ┐ └ ┘ | Rect nodes, containers |
| Horizontal | ─ ═ ┈ | Edges, borders |
| Vertical | │ ║ ┊ | Edges, lifelines |
| Arrows | → ← ↑ ↓ ▶ ◀ ▲ ▼ | Edge direction |
| Tees | ├ ┤ ┬ ┴ ┼ | Junctions |
| Dots | ● ○ ◆ ◇ ■ □ | Markers, particles |
| Blocks | █ ▓ ▒ ░ | Fill, progress bars |

### Node Shapes in ASCII

```
Rectangle:        Rounded:          Diamond:          Circle:
┌──────────┐      ╭──────────╮      ◇                (──────────)
│  Label   │      │  Label   │     ╱ ╲               (  Label   )
└──────────┘      ╰──────────╯    ◇Label◇             (──────────)
                                   ╲ ╱
                                    ◇

Parallelogram:    Subroutine:
/──────────/      ┌┤──────────├┐
│  Label   │      │  Label     │
/──────────/      └┤──────────├┘
```

## Integration with beautiful-mermaid

When `@vercel/beautiful-mermaid` is available as a dependency:

```javascript
import { renderMermaidAscii } from '@vercel/beautiful-mermaid';

// Use beautiful-mermaid for high-quality static ASCII rendering
const ascii = renderMermaidAscii(mermaidSource, {
  theme: 'vercel-dark',
  width: 120,
});

// Then use our frame engine to animate the static output
const frames = animateAsciiOutput(ascii, { strategy: 'typewriter', fps: 30 });
```

When beautiful-mermaid is NOT available, the built-in parser and renderer provide a compatible (though simpler) output.

## Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Parse time | < 10ms | For diagrams with ≤ 50 nodes |
| Layout time | < 20ms | Rank-based positioning |
| Frame generation | < 50ms total | All frames for animation |
| Render FPS | 30-60fps | Configurable, 30 default |
| Memory | < 50MB | For 1000-frame animations |
| Startup | < 100ms | Time to first frame |

## Cleanup

CRITICAL: Always restore terminal state on exit:

```javascript
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

function cleanup() {
  process.stdout.write('\033[?25h'); // show cursor
  process.stdout.write('\033[0m');   // reset colors
}
```
