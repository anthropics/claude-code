# Logistics — Playbook

# Logistics Playbooks

## Handle Warehouse Transfer Issues

1. Ask the user for the transfer ID or the Origin and Destination warehouses.
2. Check the transfer status: created, in transit, or completed.
3. If the transfer is "stuck" (created but not moving):
   - Verify that the goods are available at the Origin warehouse.
   - Check if there are any holds or blocks on the transfer.
4. If the transfer shows incorrect quantities:
   - Compare the transfer record against the actual goods shipped.
   - Check for partial transfers (some items may have shipped separately).
5. Remember: goods in transit exist in a separate state between Origin and Destination — they've left the Origin but haven't been received at the Destination yet.
6. If the issue can't be resolved, collect: transfer ID, warehouse names, expected vs actual quantities, and escalate.

## Resolve Location Mismatches

1. Ask the user what the mismatch is — wrong warehouse, wrong location within a warehouse, or wrong inventory count.
2. For wrong warehouse assignment:
   - Check the document type: POs and Invoices have one warehouse, Shipments have two (Origin + Destination).
   - Verify the warehouse was correctly specified during creation.
3. For wrong inventory count at a location:
   - Check for recent transfers, adjustments, or imports that may have affected the count.
   - Compare NeonPanel records against the physical count or 3PL report.
4. If the mismatch is between NeonPanel and a 3PL system, use the Inventory Audit report to identify discrepancies.

## Verify Inventory Balances (End-of-Month)

1. Go to the Inventory Audit report in NeonPanel.
2. Select the warehouse and set the date range to the month being closed.
3. Perform a detailed comparison of 'Actual' inventory balances versus NeonPanel FIFO-calculated balances.
4. Identify significant discrepancies between actual and calculated balances.
5. Investigate root causes for any major variances:
   - Missed receipts or shipments not recorded.
   - Unrecorded inventory adjustments.
   - Timing differences (goods received but not yet entered).
   - Transfer discrepancies (goods in transit not properly resolved).
6. Document findings and report significant issues for further investigation.
7. Resolve discrepancies before closing the month.

## Fix Inventory Duplicates (End-of-Month)

1. Access the Inventory Duplicates report in NeonPanel.
2. Review the report to identify any FnSKU that is linked to multiple SKUs within the same marketplace.
3. For each duplicate found:
   - Determine which SKU mapping is correct (check the product listing on the marketplace).
   - Identify which mapping is the error.
4. Resolve the duplicate by correcting the FnSKU-to-SKU association in NeonPanel.
5. Verify that the correction doesn't affect any open orders or shipments.
6. Document all changes made and report any issues that couldn't be resolved.
7. This should be done regularly (at least monthly) to prevent inventory tracking errors from accumulating.