# Po Invoice Mapping — Canonical Claims

These are verified facts. Only make claims that appear in this list.

- The PO-to-invoice mapping produces a formatted markdown document, not a legally binding invoice.
- PO lookup requires a reference number (e.g., 320250006) and uses the search_neonpanel_project_url tool to find matching projects.
- A NeonPanel PO project may have linked records: shipments, bills, and inventory items.
- The invoice template includes: header (vendor, PO ref, date, status), line items table (SKU, description, qty, unit price, line total), and totals section.
- Landed costs (freight, duties, other charges) can be added to the invoice using neonpanel_getInventoryLandedCost.
- COGS data can be pulled via neonpanel_getInventoryCogs to show cost-of-goods-sold per item.
- All amounts on the generated invoice must come directly from NeonPanel tool responses — never estimate or fabricate figures.
- The invoice output is markdown-formatted text suitable for copying, sharing, or converting to PDF externally.
- When the source document is a Purchase Order, the generated document must default to Purchase Order formatting (title: PURCHASE ORDER, fields: PO Number, PO Date) — not Invoice formatting. Only use Invoice formatting when the user explicitly requests an invoice.
- The agent's current tools can retrieve PO header data (total amount, status, dates, linked records) but may not return line-item details (individual SKUs, quantities, unit costs). When line items are unavailable, inform the user immediately and offer workarounds (screenshot, copy-paste, CSV export).
- The built-in PDF generator supports only a title and sections with headings and plain text body content. It does not support tables, logos, colors, or advanced styling. Users should be informed of these limitations before PDF generation begins.
- Generated PDF download links may expire and can be blocked by browser popup blockers. If a user reports the link window closing immediately, suggest right-click 'Save Link As', trying a different browser, or using the markdown output as an alternative.
