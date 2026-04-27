---
name: pdf
description: This skill should be used when the user asks to "read a PDF", "extract text from PDF", "convert PDF to text", "merge PDF files", "split a PDF", "create a PDF", "add watermark to PDF", "rotate PDF pages", or work with .pdf files using pypdf, pdfplumber, reportlab, or pdf-lib.
version: 1.0.0
---

# PDF File Processing

This skill covers reading, extracting text from, creating, and manipulating PDF files.

## Library Selection

| Task | Python Library | Node.js Library |
|------|---------------|----------------|
| Read/extract text | `pdfplumber` or `pypdf` | `pdf-parse` |
| Create PDFs | `reportlab` or `fpdf2` | `pdf-lib` or `pdfkit` |
| Merge/split/rotate | `pypdf` | `pdf-lib` |
| Convert HTML → PDF | `weasyprint` | `puppeteer` or `wkhtmltopdf` |

Install: `pip install pypdf pdfplumber reportlab fpdf2`

## Core Operations

### Extracting Text (pdfplumber — best for tables/layout)

```python
import pdfplumber

with pdfplumber.open('document.pdf') as pdf:
    for page in pdf.pages:
        text = page.extract_text()
        print(text)

        # Extract tables
        tables = page.extract_tables()
        for table in tables:
            for row in table:
                print(row)
```

### Extracting Text (pypdf — lightweight)

```python
from pypdf import PdfReader

reader = PdfReader('document.pdf')

# Metadata
print(reader.metadata.title)
print(f"Pages: {len(reader.pages)}")

# Extract text
for page in reader.pages:
    print(page.extract_text())
```

### Merging PDFs

```python
from pypdf import PdfMerger

merger = PdfMerger()
for pdf_path in ['file1.pdf', 'file2.pdf', 'file3.pdf']:
    merger.append(pdf_path)

merger.write('merged.pdf')
merger.close()
```

### Splitting a PDF

```python
from pypdf import PdfReader, PdfWriter

reader = PdfReader('document.pdf')

# Split into individual pages
for i, page in enumerate(reader.pages):
    writer = PdfWriter()
    writer.add_page(page)
    with open(f'page_{i+1}.pdf', 'wb') as f:
        writer.write(f)

# Extract page range (pages 2-5)
writer = PdfWriter()
for page in reader.pages[1:5]:
    writer.add_page(page)
with open('pages_2_to_5.pdf', 'wb') as f:
    writer.write(f)
```

### Rotating Pages

```python
from pypdf import PdfReader, PdfWriter

reader = PdfReader('document.pdf')
writer = PdfWriter()

for page in reader.pages:
    page.rotate(90)  # 90, 180, or 270
    writer.add_page(page)

with open('rotated.pdf', 'wb') as f:
    writer.write(f)
```

### Creating a PDF (reportlab)

```python
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table
from reportlab.lib.units import inch

doc = SimpleDocTemplate('output.pdf', pagesize=letter)
styles = getSampleStyleSheet()
story = []

# Add title
story.append(Paragraph("Report Title", styles['Title']))
story.append(Spacer(1, 0.2 * inch))

# Add paragraphs
story.append(Paragraph("This is body text.", styles['BodyText']))

# Add table
data = [['Name', 'Value'], ['Item A', '100'], ['Item B', '200']]
table = Table(data)
story.append(table)

doc.build(story)
```

### Creating a PDF (fpdf2 — simpler API)

```python
from fpdf import FPDF

pdf = FPDF()
pdf.add_page()
pdf.set_font('Helvetica', 'B', 16)
pdf.cell(0, 10, 'Document Title', ln=True, align='C')
pdf.set_font('Helvetica', size=12)
pdf.multi_cell(0, 8, 'Long paragraph text goes here...')
pdf.output('output.pdf')
```

### Adding Watermarks

```python
from pypdf import PdfReader, PdfWriter

watermark = PdfReader('watermark.pdf')
reader = PdfReader('document.pdf')
writer = PdfWriter()

for page in reader.pages:
    page.merge_page(watermark.pages[0])
    writer.add_page(page)

with open('watermarked.pdf', 'wb') as f:
    writer.write(f)
```

### Node.js / pdf-lib

```javascript
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');

// Create
const pdfDoc = await PDFDocument.create();
const page = pdfDoc.addPage([600, 400]);
const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
page.drawText('Hello World', { x: 50, y: 350, size: 30, font, color: rgb(0, 0, 0) });
const bytes = await pdfDoc.save();
fs.writeFileSync('output.pdf', bytes);

// Merge
const merged = await PDFDocument.create();
for (const path of ['a.pdf', 'b.pdf']) {
    const src = await PDFDocument.load(fs.readFileSync(path));
    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach(p => merged.addPage(p));
}
fs.writeFileSync('merged.pdf', await merged.save());
```

## Best Practices

- Use `pdfplumber` over `pypdf` when extracting structured text or tables (better accuracy)
- For scanned PDFs (images), use OCR: `pytesseract` with `pdf2image` to convert pages to images first
- Always use context managers (`with` statement) when reading PDFs to ensure file handles are closed
- Check PDF encryption before processing: `reader.is_encrypted`
- For large PDFs, process page by page rather than loading all pages into memory
