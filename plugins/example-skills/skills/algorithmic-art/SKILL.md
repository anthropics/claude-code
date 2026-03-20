---
name: algorithmic-art
description: This skill should be used when the user asks to "create generative art", "make algorithmic art", "write code that draws patterns", "create fractal art", "generate visual patterns with code", "make a creative coding sketch", "create particle simulations", or build visually interesting programs using math and algorithms.
version: 1.0.0
---

# Algorithmic Art

This skill guides the creation of generative and algorithmic art using code — visual outputs driven by mathematical patterns, randomness, and computational rules.

## Core Aesthetic Directions

Choose a direction that fits the user's intent:

- **Geometric/Mathematical**: Fractals, spirographs, Lissajous curves, Voronoi diagrams
- **Particle Systems**: Flocking, gravity simulations, fluid dynamics
- **Noise-Based**: Perlin/simplex noise landscapes, organic textures
- **L-Systems**: Recursive plant-like structures
- **Cellular Automata**: Conway's Game of Life, reaction-diffusion patterns
- **Recursive/Fractal**: Mandelbrot, Julia sets, Sierpinski triangle

## Implementation Targets

### HTML Canvas (Browser)

Best for interactive, shareable sketches:

```html
<!DOCTYPE html>
<html>
<body style="margin:0;background:#000">
<canvas id="c"></canvas>
<script>
const c = document.getElementById('c');
const ctx = c.getContext('2d');
c.width = window.innerWidth;
c.height = window.innerHeight;

// Example: Lissajous curve
function draw() {
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.beginPath();
    const cx = c.width / 2, cy = c.height / 2;
    for (let t = 0; t < Math.PI * 2; t += 0.001) {
        const x = cx + 200 * Math.sin(3 * t + Math.PI / 4);
        const y = cy + 200 * Math.sin(2 * t);
        t === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#0ff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
}
draw();
</script>
</body>
</html>
```

### p5.js (Creative Coding)

Best for creative coding with clean API:

```javascript
// Include: <script src="https://cdn.jsdelivr.net/npm/p5@1.9.0/lib/p5.min.js"></script>
function setup() {
    createCanvas(800, 800);
    colorMode(HSB, 360, 100, 100, 1);
    noLoop();
}

function draw() {
    background(0);
    // Recursive tree
    translate(width / 2, height);
    stroke(120, 80, 90);
    branch(150);
}

function branch(len) {
    line(0, 0, 0, -len);
    translate(0, -len);
    if (len > 10) {
        push(); rotate(PI / 6); branch(len * 0.67); pop();
        push(); rotate(-PI / 6); branch(len * 0.67); pop();
    }
}
```

### Python (matplotlib / PIL)

Best for static high-quality outputs:

```python
import numpy as np
import matplotlib.pyplot as plt

# Mandelbrot set
width, height = 800, 600
x = np.linspace(-2.5, 1, width)
y = np.linspace(-1.25, 1.25, height)
C = x[np.newaxis, :] + 1j * y[:, np.newaxis]

Z = np.zeros_like(C)
M = np.zeros(C.shape, dtype=int)

for i in range(100):
    mask = np.abs(Z) <= 2
    Z[mask] = Z[mask] ** 2 + C[mask]
    M[mask] += 1

plt.figure(figsize=(12, 8))
plt.imshow(M, cmap='inferno', extent=[-2.5, 1, -1.25, 1.25])
plt.axis('off')
plt.tight_layout()
plt.savefig('mandelbrot.png', dpi=150, bbox_inches='tight')
```

## Key Techniques

### Perlin Noise (p5.js)

```javascript
let t = 0;
function draw() {
    for (let x = 0; x < width; x += 5) {
        const y = height/2 + noise(x * 0.01, t) * 200 - 100;
        ellipse(x, y, 3);
    }
    t += 0.01;
}
```

### Particle System

```javascript
const particles = [];
class Particle {
    constructor() {
        this.pos = createVector(random(width), random(height));
        this.vel = p5.Vector.random2D();
        this.life = 255;
    }
    update() {
        this.pos.add(this.vel);
        this.life -= 2;
    }
    draw() {
        stroke(255, this.life);
        point(this.pos.x, this.pos.y);
    }
}
```

## Best Practices

- Start with a clear aesthetic concept before coding
- Use `requestAnimationFrame` or `draw()` loops for animation
- Parameterize key values (speed, count, size) for easy experimentation
- Add interactivity (mouse position, keypress) to make pieces explorable
- Seed random number generators for reproducible outputs
- For static output, use high DPI rendering (canvas scale 2x, or matplotlib dpi 300+)
- Include color palette decisions deliberately — monochrome + accent or complementary schemes work well
