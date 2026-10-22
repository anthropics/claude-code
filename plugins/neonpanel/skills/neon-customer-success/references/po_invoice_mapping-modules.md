# Po Invoice Mapping — Module Map

## po-lookup

Looking up a purchase order by its reference number using NeonPanel tools. Involves finding the company, searching for the PO project, and retrieving linked records (shipments, bills).

**Common user intents:**
- Look up PO 320250006
- Find a purchase order
- Get details for this PO number
- What's on this order?

**Common confusions:**
- Confusing PO reference numbers with internal project IDs
- Not realizing a PO may have multiple linked shipments or bills

**Artifacts to request:**
- PO reference number
- Company name (if ambiguous)

**Key objects:** Purchase Order, PO reference number, Company ID, Project record, Linked shipment, Linked bill

## invoice-formatting

Mapping purchase order data from NeonPanel into a structured invoice/document format. Covers field mapping (PO fields → invoice fields), line item formatting, totals calculation, and markdown output.

**Common user intents:**
- Generate an invoice from this PO
- Create a text invoice for PO 320250006
- Format this order as an invoice
- Map this PO to an invoice

**Common confusions:**
- Expecting PDF output (only markdown/text is supported)
- Confusing the PO total with invoice total when landed costs differ

**Key objects:** Invoice header, Line items table, Subtotal, Invoice template, Vendor info, PO-to-invoice field map

## cost-enrichment

Enriching the invoice with additional cost data — landed costs, COGS, unit costs — pulled from NeonPanel's costing tools.

**Common user intents:**
- Include landed costs on the invoice
- Show COGS per item
- Add freight and duties to the invoice
- What's the true cost per unit?

**Common confusions:**
- Confusing PO price with landed cost
- Not realizing landed cost includes freight, duties, and other charges

**Artifacts to request:**
- Whether to include landed costs or just PO prices

**Key objects:** Landed cost, COGS, Unit cost, Freight, Duties, Cost breakdown
