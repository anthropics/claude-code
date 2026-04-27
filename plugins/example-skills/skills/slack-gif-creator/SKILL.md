---
name: slack-gif-creator
description: This skill should be used when the user asks to "create a GIF", "make an animated GIF", "generate a GIF for Slack", "create a reaction GIF", "make an emoji GIF", "animate text as a GIF", "create a looping animation as GIF", or export any animation as a GIF file.
version: 1.0.0
---

# Slack GIF Creator

This skill guides creating GIF animations — from simple text animations to complex visual effects — suitable for Slack, social media, or any context where GIFs are used.

## Tool Selection

| Use Case | Tool | Approach |
|----------|------|----------|
| Code-generated animation | Python + Pillow | Script draws frames → save as GIF |
| Canvas-based animation | HTML Canvas + gif.js | Capture canvas frames → encode GIF |
| Text animations | Python + Pillow | Render text at each frame |
| Data visualizations | matplotlib + imageio | Animate chart data |
| Simple shapes/patterns | Python + Pillow | Pure drawing |

## Python / Pillow Approach (Most Reliable)

```bash
pip install Pillow
```

```python
from PIL import Image, ImageDraw, ImageFont
import math

def create_gif(filename="output.gif", frames=30, duration=50):
    images = []
    width, height = 400, 200

    for frame in range(frames):
        # Create frame
        img = Image.new('RGB', (width, height), color='#1a1a2e')
        draw = ImageDraw.Draw(img)

        # Animate something (e.g., bouncing circle)
        t = frame / frames
        x = int(50 + (width - 100) * t)
        y = int(height / 2 + 40 * math.sin(t * math.PI * 2))

        draw.ellipse([x-20, y-20, x+20, y+20], fill='#FF6B35')

        images.append(img)

    # Save as GIF
    images[0].save(
        filename,
        save_all=True,
        append_images=images[1:],
        loop=0,          # 0 = loop forever
        duration=duration # ms per frame (50 = 20fps)
    )
    print(f"Saved {filename}")

create_gif()
```

## Text Animation GIF

```python
from PIL import Image, ImageDraw, ImageFont

def text_bounce_gif(text="Hello!", output="text.gif"):
    width, height = 400, 120
    frames = 20
    images = []

    for i in range(frames):
        img = Image.new('RGBA', (width, height), (26, 26, 46, 255))
        draw = ImageDraw.Draw(img)

        # Try to use a system font
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 48)
        except:
            font = ImageFont.load_default()

        # Animate: scale effect using position offset
        offset_y = int(5 * abs(math.sin(i / frames * math.pi * 2)))
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        x = (width - text_width) // 2
        y = (height - 48) // 2 - offset_y

        # Shadow
        draw.text((x+2, y+2), text, fill=(0, 0, 0, 128), font=font)
        # Main text
        draw.text((x, y), text, fill='#FFD700', font=font)

        images.append(img)

    images[0].save(output, save_all=True, append_images=images[1:], loop=0, duration=80)
```

## Matplotlib Animation → GIF

```python
import matplotlib.pyplot as plt
import matplotlib.animation as animation
import numpy as np

fig, ax = plt.subplots(figsize=(6, 4), facecolor='#1a1a2e')
ax.set_facecolor('#1a1a2e')
ax.set_xlim(0, 2 * np.pi)
ax.set_ylim(-1.5, 1.5)
ax.spines['bottom'].set_color('#444')
line, = ax.plot([], [], color='#FF6B35', linewidth=2)

def init():
    line.set_data([], [])
    return line,

def animate(frame):
    x = np.linspace(0, 2 * np.pi, 200)
    y = np.sin(x + frame * 0.2)
    line.set_data(x, y)
    return line,

anim = animation.FuncAnimation(fig, animate, init_func=init, frames=60, interval=50)
anim.save('wave.gif', writer='pillow', fps=20)
plt.close()
```

## Slack GIF Optimization

Slack has limits — optimize GIFs:

```python
# Optimize for Slack (< 2MB preferred, < 10MB max)
# Recommended settings:
# - Size: 400x300 or smaller
# - Duration: 2-5 seconds
# - FPS: 15-20
# - Colors: reduce palette

img.save(
    "slack.gif",
    save_all=True,
    append_images=rest,
    loop=0,
    duration=60,       # 60ms = ~16fps
    optimize=True,     # Enable optimization
    colors=128         # Reduce color palette (max 256)
)
```

## Quick Patterns

### Loading Spinner

```python
for frame in range(12):
    angle = frame * 30  # 12 frames × 30° = 360°
    # Draw arc segment from angle to angle+90
    draw.arc([cx-r, cy-r, cx+r, cy+r], angle, angle+270, fill='white', width=4)
```

### Progress Bar

```python
for frame in range(frames):
    progress = frame / frames
    bar_width = int(300 * progress)
    draw.rectangle([50, 90, 50 + bar_width, 110], fill='#00C896')
```

### Typing Indicator (three dots)

```python
dots = ['.', '..', '...', '....']
for i, dot_text in enumerate(dots * 5):
    draw.text((cx, cy), dot_text, fill='white', font=font, anchor='mm')
```

## Best Practices

- Keep GIFs under 2MB for Slack (8MB for other platforms)
- Loop count: use `loop=0` for infinite loop, `loop=1` for play-once
- Frame duration: 40–80ms per frame (12–25fps) looks smooth
- Use `optimize=True` and limit colors to reduce file size
- For text: ensure readable contrast; dark background + bright text works well
- Dimensions: 400×200 to 600×400 px is a good range for Slack GIFs
