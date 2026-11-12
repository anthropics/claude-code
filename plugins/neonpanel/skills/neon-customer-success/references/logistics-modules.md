# Logistics — Module Map

## log-warehouse

Warehouse and location operations — managing warehouse transfers, resolving location mismatches, inventory balance verification, duplicate FnSKU detection, and inter-warehouse movement tracking.

**Common user intents:**
- Transfer is stuck
- Location mismatch
- Inventory balance is wrong
- How do I verify end-of-month balances?
- Duplicate FnSKU issue
- Where is my inventory?

**Common confusions:**
- Not understanding that goods in transit are in a separate state between Origin and Destination
- Confusing warehouse-level inventory with SKU-level inventory
- Not checking the Inventory Duplicates Report regularly

**Artifacts to request:**
- Warehouse name or ID
- Transfer ID
- Date range for balance check
- FnSKU in question

**Key objects:** Warehouse, Location, Transfer, Inventory balance, Inventory audit, FnSKU duplicate, Transit state, Inventory Duplicates Report

## verified_facts-core

This module teaches the agent to rely only on verifiable logistics data (not assumptions) when answering questions about goods, their origin, and shipment details, including specialized items such as neon panels. It focuses on identifying, checking, and citing authoritative sources inside enterprise systems or trusted documents.

**Common user intents:**
- Are these goods, including the neon panel items, always shipped from the same origin location?
- From which warehouse or country were these specific goods actually sent?
- Can you verify the origin and HS/customs details for this neon panel shipment?
- Are the details about the goods’ origin and route based on confirmed system data or assumptions?
- Which shipment record proves where and when these goods were dispatched?

**Common confusions:**
- Assuming the usual or preferred origin is the same as the actual origin of a specific shipment.
- Treating provisional data (draft orders or planned routes) as confirmed facts about where goods were sent from.
- Believing the model can infer true origin or routing details without checking enterprise logistics systems.

**Artifacts to request:**
- shipment_or_tracking_IDs_(e.g., BOL_number,_PO,_SO,_or_consignment_ID)
- product_identifiers_(SKU,_neon_panel_model_number,_or_item_code)
- supporting_documents_or_screenshots_(e.g., bill_of_lading,_invoice,_WMS/TMS_screens)

**Key objects:** shipment_origin_records, bill_of_lading_and_invoices, product_master_data_(including_neon_panel_SKUs), scan_and_tracking_events, customs_and_compliance_documents
