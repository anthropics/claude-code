# Data Import — Canonical Claims

These are verified facts. Only make claims that appear in this list.

- Supported bulk upload types are Inventory Orders, Bills, Shipments, Invoices, and Forecasts.
- NeonPanel uploads accept CSV files only.
- Each upload template contains an instruction sheet and an example data sheet.
- Template selection should be determined before validation or transformation.
- If the user provides a non-CSV file, it should be aligned and converted into the NeonPanel CSV template format.
- If the user provides multiple files, only one source file should be processed unless the second file is explicitly a template/reference for mapping.
- Column mappings may be assumed only when ambiguity is low; ambiguous mappings require user confirmation.
- Issue reporting should focus only on missing required fields, invalid formats, duplicates, or mismatched templates.
- Amazon Removal Order Detail reports should be treated as a Shipment upload source when Order Type is Return, and mapped to the Shipment Upload Template.
- For Amazon Removal Order Detail files, confirmation is required for company, receiving warehouse, and country before finalizing the CSV.
- Invoices, Inventory Orders (POs), and Inventory Adjustments each have exactly ONE warehouse — the location where goods are placed or sold from. It is impossible to receive the same order into multiple warehouses; each warehouse requires a separate order.
- Shipments (all types — FBA, inventory shipments, etc.) have exactly TWO warehouses: an Origin (where goods are sent from) and a Destination (where goods are sent to).
- Bills do not have a warehouse column; they are linked to Inventory Orders or Shipments which carry the warehouse association.
- When uploading data, each row in Inventory Orders, Invoices, and Inventory Adjustments must specify one warehouse. If the user mentions multiple warehouses for the same order, they need separate orders — one per warehouse.
