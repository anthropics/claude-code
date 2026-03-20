---
name: xlsx
description: This skill should be used when the user asks to "create an Excel spreadsheet", "read an xlsx file", "write to Excel", "add formulas to a spreadsheet", "format Excel cells", "create charts in Excel", "parse spreadsheet data", or work with .xlsx/.xls files using openpyxl, xlsx.js, or similar libraries.
version: 1.0.0
---

# Excel Spreadsheet Processing (XLSX)

This skill covers creating, reading, modifying, and formatting Excel spreadsheets programmatically using popular libraries.

## Library Selection

Choose the appropriate library based on the user's environment:

| Environment | Library | Install |
|-------------|---------|---------|
| Python | `openpyxl` | `pip install openpyxl` |
| Python (data-heavy) | `pandas` + `openpyxl` | `pip install pandas openpyxl` |
| Node.js | `xlsx` (SheetJS) | `npm install xlsx` |
| Node.js (write-only) | `exceljs` | `npm install exceljs` |

## Core Operations

### Reading a Spreadsheet (Python/openpyxl)

```python
from openpyxl import load_workbook

wb = load_workbook('data.xlsx')
ws = wb.active  # or wb['Sheet1']

# Read all rows
for row in ws.iter_rows(values_only=True):
    print(row)

# Read specific cell
value = ws['A1'].value
value = ws.cell(row=1, column=1).value
```

### Creating a Spreadsheet (Python/openpyxl)

```python
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter

wb = Workbook()
ws = wb.active
ws.title = "Report"

# Write data
ws['A1'] = "Header"
ws.append(["Name", "Value", "Status"])

# Apply styles
ws['A1'].font = Font(bold=True, size=14)
ws['A1'].fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
ws['A1'].alignment = Alignment(horizontal='center')

# Set column width
ws.column_dimensions['A'].width = 20

# Add formula
ws['C2'] = "=SUM(B2:B10)"

wb.save('output.xlsx')
```

### Reading with pandas

```python
import pandas as pd

# Read all sheets
df = pd.read_excel('data.xlsx', sheet_name='Sheet1')

# Read multiple sheets
dfs = pd.read_excel('data.xlsx', sheet_name=None)  # dict of DataFrames

# Write DataFrame to Excel
with pd.ExcelWriter('output.xlsx', engine='openpyxl') as writer:
    df.to_excel(writer, sheet_name='Data', index=False)
```

### Node.js / SheetJS

```javascript
const XLSX = require('xlsx');

// Read
const workbook = XLSX.readFile('data.xlsx');
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet);

// Write
const newWb = XLSX.utils.book_new();
const newWs = XLSX.utils.json_to_sheet(data);
XLSX.utils.book_append_sheet(newWb, newWs, 'Sheet1');
XLSX.writeFile(newWb, 'output.xlsx');
```

## Common Tasks

### Adding Charts (openpyxl)

```python
from openpyxl.chart import BarChart, Reference

chart = BarChart()
chart.title = "Sales Data"
data = Reference(ws, min_col=2, min_row=1, max_row=10)
categories = Reference(ws, min_col=1, min_row=2, max_row=10)
chart.add_data(data, titles_from_data=True)
chart.set_categories(categories)
ws.add_chart(chart, "E2")
```

### Conditional Formatting

```python
from openpyxl.formatting.rule import ColorScaleRule, DataBarRule

# Color scale
rule = ColorScaleRule(
    start_color='F8696B', mid_color='FFEB84', end_color='63BE7B'
)
ws.conditional_formatting.add('B2:B20', rule)
```

### Auto-filter and Freeze Panes

```python
ws.auto_filter.ref = ws.dimensions
ws.freeze_panes = 'A2'  # Freeze first row
```

## Best Practices

- Always close/save workbooks: use `wb.save()` or context managers
- Use `values_only=True` in `iter_rows()` for performance when reading large files
- For large datasets, prefer pandas for reading and openpyxl for writing with formatting
- Use named styles (`wb.add_named_style()`) for consistent formatting across cells
- Validate file extensions before processing: accept both `.xlsx` and `.xls` (though `.xls` needs `xlrd`)
