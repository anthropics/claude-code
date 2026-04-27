# Document Skills Plugin

A collection of skills for working with common document formats: Excel spreadsheets, Word documents, PowerPoint presentations, and PDF files.

## Skills

| Skill | Description | Libraries |
|-------|-------------|-----------|
| [xlsx](./skills/xlsx/) | Create, read, and format Excel spreadsheets | openpyxl, pandas, SheetJS |
| [docx](./skills/docx/) | Create and modify Word documents | python-docx, docx (Node) |
| [pptx](./skills/pptx/) | Build PowerPoint presentations with slides, charts, and tables | python-pptx, pptxgenjs |
| [pdf](./skills/pdf/) | Read, create, merge, split, and process PDF files | pypdf, pdfplumber, reportlab, pdf-lib |

## Usage

These skills are auto-invoked when you ask Claude to work with the corresponding file formats. For example:

- "Create an Excel spreadsheet with sales data" → triggers `xlsx` skill
- "Generate a Word document report" → triggers `docx` skill
- "Build a slide deck for my presentation" → triggers `pptx` skill
- "Extract text from this PDF" → triggers `pdf` skill

## Installation

Include this plugin in your Claude Code configuration to enable document processing capabilities.
