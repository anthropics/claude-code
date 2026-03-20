---
name: web-artifacts-builder
description: This skill should be used when the user asks to "build a web demo", "create an interactive prototype", "make a self-contained HTML page", "build a web artifact", "create a single-file web app", "make a shareable web demo", "build a playground", or create any self-contained interactive web page that can run without a build step.
version: 1.0.0
---

# Web Artifacts Builder

This skill guides creating self-contained, interactive web artifacts — single HTML files that combine HTML, CSS, and JavaScript into a shareable, runnable demo or prototype.

## Core Principle

Web artifacts are **single HTML files** that:
- Run without a build step or server
- Include all dependencies via CDN
- Work when opened directly in a browser or pasted into a preview tool
- Are visually polished and immediately impressive

## Template Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Demo Title</title>
<style>
  /* Reset and base */
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Inter', system-ui, sans-serif;
    background: #0f172a;
    color: #e2e8f0;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  /* Your styles here */
</style>
</head>
<body>
  <!-- Content here -->
  <script>
    // Your JavaScript here
  </script>
</body>
</html>
```

## CDN References for Common Libraries

Include only what's needed:

```html
<!-- React 18 -->
<script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>

<!-- Vue 3 -->
<script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>

<!-- Alpine.js (lightweight reactivity) -->
<script defer src="https://unpkg.com/alpinejs@3/dist/cdn.min.js"></script>

<!-- Chart.js -->
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

<!-- D3.js -->
<script src="https://d3js.org/d3.v7.min.js"></script>

<!-- Three.js -->
<script src="https://unpkg.com/three@0.160.0/build/three.min.js"></script>

<!-- Tailwind CSS (play CDN) -->
<script src="https://cdn.tailwindcss.com"></script>

<!-- Marked (markdown parser) -->
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>

<!-- Tone.js (audio) -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js"></script>
```

## Common Artifact Types

### Interactive Dashboard

```html
<div id="dashboard" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px,1fr)); gap:16px; padding:24px">
  <div class="card" id="stat-1">
    <div class="label">Total Users</div>
    <div class="value">0</div>
  </div>
</div>
<script>
// Live-updating stats
function updateStats() {
    document.querySelector('#stat-1 .value').textContent =
        Math.floor(Math.random() * 10000).toLocaleString();
}
setInterval(updateStats, 2000);
updateStats();
</script>
```

### Interactive Calculator / Tool

```html
<div class="tool-container">
  <input id="input" type="number" placeholder="Enter value">
  <button onclick="calculate()">Calculate</button>
  <div id="result"></div>
</div>
<script>
function calculate() {
    const val = parseFloat(document.getElementById('input').value);
    document.getElementById('result').textContent = `Result: ${val * 2}`;
}
</script>
```

### Data Visualization

```html
<canvas id="chart" width="800" height="400"></canvas>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script>
new Chart(document.getElementById('chart'), {
    type: 'line',
    data: {
        labels: ['Jan','Feb','Mar','Apr','May'],
        datasets: [{
            label: 'Revenue',
            data: [12, 19, 8, 15, 22],
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99,102,241,0.1)',
            tension: 0.4,
            fill: true
        }]
    },
    options: { responsive: true, plugins: { legend: { position: 'top' } } }
});
</script>
```

### Form / Survey

```html
<form id="survey" onsubmit="handleSubmit(event)">
  <div class="field">
    <label for="name">Name</label>
    <input id="name" type="text" required>
  </div>
  <button type="submit">Submit</button>
</form>
<div id="results" hidden></div>
<script>
function handleSubmit(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    document.getElementById('results').hidden = false;
    document.getElementById('results').textContent = JSON.stringify(data, null, 2);
}
</script>
```

## Design Guidelines for Artifacts

Apply these for visually impressive results:

- **Dark themes** tend to look more polished for demos; use `#0f172a` or `#111827` backgrounds
- **Card components**: rounded corners (`border-radius: 12px`), subtle borders, soft shadows
- **Smooth transitions**: `transition: all 0.2s ease` on interactive elements
- **Loading states**: Show skeleton screens or spinners for async operations
- **Micro-interactions**: Hover effects, click feedback, success animations

## CSS Essentials for Polished Look

```css
.card {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px;
    padding: 24px;
    backdrop-filter: blur(8px);
    transition: transform 0.2s, box-shadow 0.2s;
}
.card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
}
button {
    background: #6366f1;
    color: white;
    border: none;
    padding: 10px 24px;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    transition: background 0.15s;
}
button:hover { background: #4f46e5; }
button:active { transform: scale(0.97); }
```

## Best Practices

- Always include a viewport meta tag for mobile compatibility
- Use `defer` on script tags to avoid blocking page render
- Handle edge cases: empty states, invalid inputs, loading states
- Add keyboard accessibility: focusable elements, `aria-label` attributes
- Test in multiple browsers before declaring done
- For complex artifacts, add a brief comment explaining the structure at the top
- Prefer semantic HTML elements (`<button>`, `<form>`, `<nav>`) over `<div>` for everything
