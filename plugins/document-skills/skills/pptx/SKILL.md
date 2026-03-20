---
name: pptx
description: This skill should be used when the user asks to "create a PowerPoint presentation", "make slides", "add content to pptx", "create a slide deck", "generate a presentation", "add charts to slides", or work with .pptx files using python-pptx or pptxgenjs.
version: 1.0.0
---

# PowerPoint Presentation Processing (PPTX)

This skill covers creating and modifying PowerPoint presentations programmatically.

## Library Selection

| Environment | Library | Install |
|-------------|---------|---------|
| Python | `python-pptx` | `pip install python-pptx` |
| Node.js | `pptxgenjs` | `npm install pptxgenjs` |

## Core Operations

### Creating a Presentation (Python/python-pptx)

```python
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN

prs = Presentation()

# Use built-in slide layouts
# 0: Title Slide, 1: Title and Content, 2: Section Header, etc.
slide_layout = prs.slide_layouts[0]
slide = prs.slides.add_slide(slide_layout)

# Set title and subtitle
title = slide.shapes.title
subtitle = slide.placeholders[1]
title.text = "Presentation Title"
subtitle.text = "Subtitle text here"

prs.save('output.pptx')
```

### Adding Content Slides

```python
# Title and Content layout
layout = prs.slide_layouts[1]
slide = prs.slides.add_slide(layout)

slide.shapes.title.text = "Key Points"
content = slide.placeholders[1]
tf = content.text_frame

# Add bullet points
tf.text = "First bullet point"
p = tf.add_paragraph()
p.text = "Second bullet point"
p.level = 0
p = tf.add_paragraph()
p.text = "Sub-bullet"
p.level = 1
```

### Adding Text Boxes

```python
from pptx.util import Inches, Pt

left = Inches(1)
top = Inches(2)
width = Inches(6)
height = Inches(1.5)

txBox = slide.shapes.add_textbox(left, top, width, height)
tf = txBox.text_frame
tf.word_wrap = True

p = tf.add_paragraph()
p.text = "Custom text box content"
p.font.size = Pt(18)
p.font.bold = True
p.font.color.rgb = RGBColor(0x00, 0x40, 0x80)
p.alignment = PP_ALIGN.CENTER
```

### Adding Images

```python
slide.shapes.add_picture('image.png', Inches(1), Inches(2), Inches(4), Inches(3))
```

### Adding Charts

```python
from pptx.chart.data import ChartData
from pptx.enum.chart import XL_CHART_TYPE

chart_data = ChartData()
chart_data.categories = ['Q1', 'Q2', 'Q3', 'Q4']
chart_data.add_series('Revenue', (42, 65, 78, 91))
chart_data.add_series('Costs',   (30, 40, 50, 60))

chart = slide.shapes.add_chart(
    XL_CHART_TYPE.COLUMN_CLUSTERED,
    Inches(1), Inches(2), Inches(8), Inches(4),
    chart_data
).chart

chart.has_legend = True
chart.chart_title.text_frame.text = "Quarterly Performance"
```

### Adding Tables

```python
rows, cols = 4, 3
table = slide.shapes.add_table(rows, cols, Inches(1), Inches(2), Inches(8), Inches(2)).table

# Set column widths
table.columns[0].width = Inches(3)
table.columns[1].width = Inches(2.5)
table.columns[2].width = Inches(2.5)

# Fill cells
headers = ['Name', 'Q1', 'Q2']
for i, h in enumerate(headers):
    cell = table.cell(0, i)
    cell.text = h
    cell.fill.solid()
    cell.fill.fore_color.rgb = RGBColor(0x4A, 0x72, 0xC4)
```

### Reading a Presentation

```python
prs = Presentation('input.pptx')

for i, slide in enumerate(prs.slides):
    print(f"Slide {i+1}:")
    for shape in slide.shapes:
        if shape.has_text_frame:
            for para in shape.text_frame.paragraphs:
                print(f"  {para.text}")
```

### Node.js / PptxGenJS

```javascript
const PptxGenJS = require('pptxgenjs');
const pptx = new PptxGenJS();

const slide = pptx.addSlide();

slide.addText("Hello World", {
    x: 1, y: 1, w: 8, h: 1,
    fontSize: 36, bold: true, color: '003366',
    align: 'center'
});

slide.addImage({ path: 'logo.png', x: 0.5, y: 0.5, w: 1.5, h: 1 });

slide.addChart(pptx.ChartType.bar, [
    { name: 'Revenue', labels: ['Q1','Q2','Q3'], values: [42,65,78] }
], { x: 1, y: 2, w: 8, h: 4 });

await pptx.writeFile({ fileName: 'output.pptx' });
```

## Best Practices

- Use slide layouts (0-10) to get properly formatted placeholder positions
- Keep slide masters intact when modifying existing presentations: open with `Presentation('template.pptx')`
- Use `Inches()` for position/size and `Pt()` for font sizes
- Set slide dimensions before adding slides for non-standard sizes: `prs.slide_width = Inches(13.33)`
- For consistent styling, apply changes to the slide master rather than individual slides
