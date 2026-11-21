# Neonpanel Onboarding — Module Map

## onb-amazon-data

NeonPanel's responsibility for processing, validating, and preparing Amazon-sourced data after connection, including warehouses, inventory, orders, fees, and shipments.

**Common user intents:**
- What does NeonPanel do with Amazon data?
- Who validates Amazon imports?
- Who cleans up Amazon catalogs?
- What about duplicate SKUs?
- Who pre-fills inventory?

**Common confusions:**
- Thinking Amazon data is immediately ready after connection
- Not understanding that NeonPanel processes and validates before presenting data

**Artifacts to request:**
- Amazon Seller Central access
- List of Amazon marketplaces

**Key objects:** Amazon connection, Warehouse import, Inventory sync, Order import, Fee processing, Shipment import, Duplicate SKU cleanup, Catalog validation

## onb-operational-setup

Client and NeonPanel responsibilities for validating non-Amazon warehouse balances, in-production POs, on-the-water shipments, and inbound Amazon receiving data.

**Common user intents:**
- Who validates warehouse balances?
- What about in-production POs?
- Who checks on-the-water shipments?
- What does technical validation mean?

**Common confusions:**
- Thinking NeonPanel validates data accuracy — NeonPanel validates technical correctness, client validates business accuracy
- Not providing non-Amazon data on time

**Artifacts to request:**
- 3PL warehouse balances
- Open PO list
- In-transit shipment details

**Key objects:** Warehouse balance validation, In-production PO, On-the-water shipment, Inbound receiving, Technical validation, Data accuracy check

## onb-accounting-setup

Client and NeonPanel responsibilities for Chart of Accounts finalization, service-account mapping, and accounting policy decisions during onboarding.

**Common user intents:**
- Who decides the Chart of Accounts?
- Can NeonPanel propose a CoA?
- What accounts do I need?
- How does CoA affect mappings?

**Common confusions:**
- Not understanding that custom CoA requires reconfiguring service-account mappings
- Thinking NeonPanel decides accounting policy — client must define it

**Artifacts to request:**
- Current Chart of Accounts
- Accounting system credentials
- Accounting policy preferences

**Key objects:** Chart of Accounts (CoA), Service-account mapping, Accounting policy, QBO/Xero connection, Default CoA, Custom CoA

## onb-dry-run-go-live

NeonPanel and client responsibilities during dry-run testing, validation, approval, and the transition to live sync.

**Common user intents:**
- What happens in dry-run?
- Who runs the dry-run?
- What if there are discrepancies?
- When do we go live?
- What do I need to approve?

**Common confusions:**
- Thinking dry-run is automatic — it requires active review and approval
- Not understanding that discrepancies found in dry-run must be resolved before go-live

**Artifacts to request:**
- Preferred go-live date
- Stakeholder availability for approval

**Key objects:** Dry-run test, Validation report, Approval gate, Go-live date, Monitoring period, Discrepancy resolution

## onb-post-go-live

NeonPanel's ongoing support after go-live, including health checks, optimization, and guidance on forecasting, profitability analysis, and new channel/warehouse setup.

**Common user intents:**
- What happens after go-live?
- How long does NeonPanel monitor?
- What is a health check?
- Can NeonPanel help with forecasting?
- How do I add new channels?

**Common confusions:**
- Thinking support ends at go-live
- Not understanding that new channels/warehouses require additional setup

**Key objects:** Health check, Post-go-live monitoring, Optimization guidance, Forecasting setup, Profitability analysis, New channel setup, New warehouse setup

## onb-client-data-responsibility

Client's responsibility to provide all non-Amazon data: warehouse balances, PO details, shipment information, and landed cost inputs required for accurate onboarding.

**Common user intents:**
- What data do I need to provide?
- What about 3PL balances?
- Do I need PO details?
- What about freight and customs?
- When do I provide this?

**Common confusions:**
- Thinking NeonPanel has access to non-Amazon data
- Underestimating the amount of data needed
- Missing data deadlines

**Artifacts to request:**
- 3PL balance reports
- Open PO spreadsheets
- Freight and customs invoices

**Key objects:** Non-Amazon data, Warehouse balances, PO details, Shipment information, Landed cost inputs, Data deadline

## onb-client-amazon-costs

Client's responsibility to enter or confirm per-unit costs for Amazon inventory in the Initial Amazon Inventory Project prepared by NeonPanel.

**Common user intents:**
- Who enters Amazon costs?
- What is the Initial Amazon Inventory Project?
- Do I need to confirm costs?
- What if I don't know the costs?

**Common confusions:**
- Thinking NeonPanel knows the purchase costs for Amazon inventory
- Not understanding that cost accuracy affects all downstream FIFO calculations

**Artifacts to request:**
- Purchase cost records
- Supplier invoices

**Key objects:** Initial Amazon Inventory Project, Per-unit cost, Cost confirmation, Pre-filled inventory data

## onb-client-accounting-prep

Client's responsibility to finalize Chart of Accounts, define accounting policy, connect accounting systems, and approve mappings and financial outputs.

**Common user intents:**
- What accounting prep do I need to do?
- Who approves the mappings?
- When do I connect my accounting system?
- What if I don't have credentials?

**Common confusions:**
- Thinking NeonPanel handles all accounting decisions
- Not having accounting system credentials ready

**Artifacts to request:**
- Accounting system access
- Desired accounting policies

**Key objects:** CoA finalization, Accounting policy definition, System connection, Mapping approval, Financial output approval

## onb-client-data-maintenance

Client's ongoing responsibility to maintain accurate operational and financial data after go-live, including POs, freight invoices, inventory records, and structural changes.

**Common user intents:**
- What do I maintain after go-live?
- When do I upload new invoices?
- How do I add a new warehouse?
- What about new sales channels?

**Common confusions:**
- Thinking data maintenance is NeonPanel's responsibility after go-live
- Not uploading freight invoices promptly

**Key objects:** Ongoing PO entry, Freight invoice upload, Inventory record maintenance, Structural changes, New warehouse addition, New channel addition
