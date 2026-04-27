---
name: canvas-design
description: This skill should be used when the user asks to "draw on HTML canvas", "create canvas animations", "use the Canvas API", "draw shapes with canvas", "create 2D graphics with canvas", "animate on canvas", "build a canvas game", or implement visual designs using the HTML5 Canvas 2D rendering context.
version: 1.0.0
---

# HTML Canvas Design

This skill covers creating 2D graphics, animations, and interactive visuals using the HTML5 Canvas API.

## Canvas Setup

Always start with proper setup:

```html
<!DOCTYPE html>
<html>
<body style="margin:0; overflow:hidden; background:#1a1a2e">
<canvas id="canvas"></canvas>
<script>
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Responsive canvas with device pixel ratio support
function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.scale(dpr, dpr);
}
window.addEventListener('resize', resize);
resize();
</script>
</body>
</html>
```

## Drawing Primitives

### Shapes

```javascript
// Rectangle
ctx.fillStyle = '#4A72C4';
ctx.fillRect(x, y, width, height);
ctx.strokeRect(x, y, width, height);

// Circle / Arc
ctx.beginPath();
ctx.arc(cx, cy, radius, 0, Math.PI * 2);
ctx.fillStyle = '#FF6B35';
ctx.fill();

// Triangle / Polygon
ctx.beginPath();
ctx.moveTo(x1, y1);
ctx.lineTo(x2, y2);
ctx.lineTo(x3, y3);
ctx.closePath();
ctx.fill();

// Rounded rectangle
ctx.beginPath();
ctx.roundRect(x, y, w, h, radius); // Modern browsers
ctx.fill();
```

### Paths and Curves

```javascript
// Bezier curve
ctx.beginPath();
ctx.moveTo(50, 300);
ctx.bezierCurveTo(150, 50, 350, 50, 450, 300);
ctx.stroke();

// Quadratic curve
ctx.beginPath();
ctx.moveTo(50, 300);
ctx.quadraticCurveTo(250, 50, 450, 300);
ctx.stroke();
```

### Text

```javascript
ctx.font = 'bold 48px "Space Grotesk", sans-serif';
ctx.fillStyle = '#fff';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('Hello Canvas', canvas.width / 2, canvas.height / 2);

// Text with shadow
ctx.shadowColor = 'rgba(0,0,0,0.5)';
ctx.shadowBlur = 10;
ctx.shadowOffsetY = 4;
```

## Styling

### Gradients

```javascript
// Linear gradient
const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
grad.addColorStop(0, '#667eea');
grad.addColorStop(1, '#764ba2');
ctx.fillStyle = grad;

// Radial gradient
const radial = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
radial.addColorStop(0, '#fff');
radial.addColorStop(1, 'transparent');
```

### Patterns and Images

```javascript
const img = new Image();
img.src = 'texture.png';
img.onload = () => {
    const pattern = ctx.createPattern(img, 'repeat');
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
};
```

### Compositing

```javascript
ctx.globalAlpha = 0.5;  // Transparency
ctx.globalCompositeOperation = 'screen'; // Blend modes
// Options: 'multiply', 'screen', 'overlay', 'lighter', 'destination-out'
```

## Animation Loop

```javascript
let animId;
function animate(timestamp) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update state
    angle += 0.02;
    x = Math.sin(angle) * 100 + canvas.width / 2;
    y = Math.cos(angle) * 100 + canvas.height / 2;

    // Draw
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${timestamp * 0.1 % 360}, 70%, 60%)`;
    ctx.fill();

    animId = requestAnimationFrame(animate);
}
animate(0);

// Stop: cancelAnimationFrame(animId);
```

## Transforms

```javascript
ctx.save();              // Push state
ctx.translate(cx, cy);   // Move origin
ctx.rotate(angle);       // Rotate (radians)
ctx.scale(sx, sy);       // Scale
// ... draw centered at origin ...
ctx.restore();           // Pop state
```

## Interaction

```javascript
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
    // Use mouseX, mouseY for hit detection or effects
});
```

## Performance Tips

- Call `ctx.save()` / `ctx.restore()` around state changes
- Batch draw calls — minimize `beginPath()`/`fill()`/`stroke()` calls
- Use `offscreen canvas` for complex static layers: `const offscreen = new OffscreenCanvas(w, h)`
- Clear only dirty regions: `ctx.clearRect(dirtyX, dirtyY, dirtyW, dirtyH)`
- Avoid reading pixel data (`getImageData`) in animation loops — it's slow
- Use integer pixel positions to avoid sub-pixel rendering: `Math.round(x)`
