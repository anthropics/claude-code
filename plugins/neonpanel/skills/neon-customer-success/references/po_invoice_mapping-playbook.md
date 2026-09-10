# Po Invoice Mapping — Playbook

# PO to Invoice Mapping Playbooks

## Generate Invoice from Purchase Order

1. Get the PO reference number from the user (e.g., 320250006).
2. If the company is ambiguous, ask which company to search in. Otherwise use the default/known company.
3. Call `search_neonpanel_project_url` with the PO reference number to find the project.
4. From the results, identify the **Inventory Order (PO)** record and note its details (date, amount, status, linked records).
5. Call `neonpanel_getInventoryDetails` to retrieve line-item details for the PO (SKUs, descriptions, quantities, unit prices).
6. Map the retrieved data onto the invoice template below.
7. Calculate line totals (qty × unit price) and the grand total.
8. Output the formatted markdown invoice.
9. Offer to enrich with landed costs or COGS if the user wants more detail.

## Generate Invoice with Landed Costs

1. Follow steps 1–6 from "Generate Invoice from Purchase Order" above.
2. Call `neonpanel_getInventoryLandedCost` to retrieve landed cost data for the items.
3. Optionally call `neonpanel_getInventoryCogs` for COGS breakdown.
4. Add a **Cost Breakdown** section to the invoice showing:
   - Product cost (from PO)
   - Freight charges
   - Duties / tariffs
   - Other landed cost components
   - Total landed cost
5. Output the enriched invoice with the cost breakdown section appended.

## Invoice Markdown Template

Use this template structure when generating the invoice output. Adapt field names based on what the NeonPanel tools actually return — do NOT fabricate fields that weren't in the response.

```
# PURCHASE ORDER INVOICE

| | |
|---|---|
| **Vendor** | {vendor_name} |
| **PO Reference** | {po_reference_number} |
| **PO Date** | {po_date} |
| **Status** | {po_status} |
| **Shipment Status** | {shipment_status} |
| **Shipment Date** | {shipment_date} |

---

## Line Items

| # | SKU | Description | Qty | Unit Price | Line Total |
|---|-----|-------------|-----|------------|------------|
| 1 | {sku} | {description} | {qty} | ${unit_price} | ${line_total} |
| 2 | ... | ... | ... | ... | ... |

---

## Totals

| | |
|---|---|
| **Subtotal** | ${subtotal} |
| **Freight** | ${freight} |
| **Duties** | ${duties} |
| **Other Charges** | ${other} |
| **Grand Total** | ${grand_total} |

---

## Linked Records

| Type | Reference | Status | Link |
|------|-----------|--------|------|
| Shipment | {shipment_ref} | {status} | [Open]({url}) |
| Bill | {bill_ref} | {status} | [Open]({url}) |

---

*Generated from NeonPanel PO data. This is a formatted summary, not a legal invoice.*
```

## Handle Missing Data

1. If the PO is not found, inform the user and ask them to verify the reference number and company.
2. If line-item details are unavailable (tool returns only the PO summary), output a **summary invoice** with just the header and total amount — note that line items couldn't be retrieved.
3. If landed cost data is unavailable, output the basic invoice and note that landed costs are not yet available for this PO.
4. Never fill in placeholder values — if a field is missing, omit it or mark it as "N/A".