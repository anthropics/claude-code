---
name: docx
description: This skill should be used when the user asks to "create a Word document", "read a docx file", "add text to Word", "format a Word document", "add tables to Word", "insert images into docx", "generate a report as Word", or work with .docx files using python-docx, mammoth, or similar libraries.
version: 1.0.0
---

# Word Document Processing (DOCX)

This skill covers creating, reading, and modifying Word documents programmatically.

## Library Selection

| Environment | Library | Install |
|-------------|---------|---------|
| Python | `python-docx` | `pip install python-docx` |
| Node.js (read) | `mammoth` | `npm install mammoth` |
| Node.js (create) | `docx` | `npm install docx` |

## Core Operations

### Creating a Document (Python/python-docx)

```python
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH

doc = Document()

# Title
title = doc.add_heading('Report Title', level=0)
title.alignment = WD_ALIGN_PARAGRAPH.CENTER

# Paragraph with formatting
p = doc.add_paragraph()
run = p.add_run('Bold text ')
run.bold = True
run.font.size = Pt(12)
run = p.add_run('and normal text.')

# Styled paragraph
doc.add_paragraph('Introduction paragraph here.')

doc.save('output.docx')
```

### Reading a Document

```python
from docx import Document

doc = Document('input.docx')

# Read all paragraphs
for para in doc.paragraphs:
    print(para.style.name, para.text)

# Read all tables
for table in doc.tables:
    for row in table.rows:
        for cell in row.cells:
            print(cell.text, end='\t')
        print()
```

### Adding Tables

```python
# Create table
table = doc.add_table(rows=1, cols=3)
table.style = 'Table Grid'

# Header row
hdr = table.rows[0].cells
hdr[0].text = 'Name'
hdr[1].text = 'Department'
hdr[2].text = 'Score'

# Data rows
data = [('Alice', 'Engineering', '95'), ('Bob', 'Design', '88')]
for name, dept, score in data:
    row = table.add_row().cells
    row[0].text = name
    row[1].text = dept
    row[2].text = score
```

### Adding Images

```python
doc.add_picture('logo.png', width=Inches(2.0))
```

### Styles and Formatting

```python
from docx.shared import Pt, RGBColor
from docx.oxml.ns import qn

# Add heading levels
doc.add_heading('Section 1', level=1)
doc.add_heading('Subsection 1.1', level=2)

# Custom paragraph style
para = doc.add_paragraph('Custom styled text')
para.style = doc.styles['Quote']

# Direct font formatting
run = para.add_run('highlighted')
run.font.color.rgb = RGBColor(0xFF, 0x00, 0x00)
run.font.highlight_color = 4  # Yellow highlight
```

### Node.js / docx library

```javascript
const { Document, Paragraph, TextRun, HeadingLevel } = require('docx');
const fs = require('fs');

const doc = new Document({
  sections: [{
    children: [
      new Paragraph({
        text: "Document Title",
        heading: HeadingLevel.HEADING_1,
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "Bold text", bold: true }),
          new TextRun(" and normal text."),
        ],
      }),
    ],
  }],
});

const buffer = await Packer.toBuffer(doc);
fs.writeFileSync("output.docx", buffer);
```

### Converting DOCX to HTML (mammoth)

```javascript
const mammoth = require('mammoth');

const result = await mammoth.convertToHtml({ path: 'input.docx' });
console.log(result.value); // HTML string
```

## Best Practices

- Use built-in styles (`'Heading 1'`, `'Normal'`, `'Table Grid'`) for consistent formatting
- Add page breaks with `doc.add_page_break()` between major sections
- Use `Inches()` and `Pt()` for measurements rather than raw numbers
- For template-based documents, open an existing `.docx` as the base: `Document('template.docx')`
- Preserve document metadata by modifying `doc.core_properties` (author, title, etc.)
