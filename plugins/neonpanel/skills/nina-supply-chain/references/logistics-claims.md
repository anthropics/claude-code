# Logistics — Canonical Claims

These are verified facts. Only make claims that appear in this list.

- Shipments in NeonPanel always involve two warehouses: an Origin (where goods are sent from) and a Destination (where goods are sent to). This applies to all shipment types including FBA shipments, inventory shipments, and inter-warehouse transfers.
- Inventory Orders (POs) and Invoices are single-warehouse documents — they reference the one warehouse where goods are placed or sold from. A single order cannot span multiple warehouses; each warehouse requires a separate order.
- Inventory Adjustments are single-warehouse operations — they adjust stock at one specific warehouse location.
- NeonPanel tracks goods in transit between Origin and Destination warehouses. Goods leave the Origin warehouse and appear in a transit state until received at the Destination warehouse.
- FBA Shipments send goods from a seller's warehouse (Origin) to an Amazon fulfillment center (Destination).
- The Inventory Audit report compares 'Actual' inventory balances with NeonPanel's FIFO-calculated balances to identify discrepancies.
- End-of-month inventory balance verification should compare 'Actual' balances versus NeonPanel FIFO balances in the Inventory Audit report.
- The Inventory Duplicates report identifies cases where a single FnSKU for a particular marketplace is associated with more than one SKU, which must be resolved to ensure accurate inventory tracking.
- Inventory duplicate issues (one FnSKU linked to multiple SKUs in the same marketplace) should be checked and resolved regularly via the NeonPanel Inventory Duplicates Report.
