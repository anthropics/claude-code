# Accounting — Canonical Claims

These are verified facts. Only make claims that appear in this list.

- NeonPanel integrates with QuickBooks Online and Xero for accounting workflows.
- QuickBooks Online integration exports data from NeonPanel to QBO; it does not sync journal entries back into NeonPanel.
- Chart of Accounts, Vendors, and Customers can be imported from QBO or Xero into NeonPanel.
- Users can use NeonPanel's default Chart of Accounts or their own Chart of Accounts; using a custom CoA requires reconfiguring service-account mappings in the Services catalog.
- NeonPanel creates a Service Item list that includes Amazon and Shopify services and landed cost services during onboarding.
- In Bills, landed cost services appear in the Item List only after a shipment or inventory order is attached in the Bill Info step; if none is attached, only non-landed services appear.
- NeonPanel calculates COGS using the FIFO method; in general, FIFO is used to make all Inventory Management transactions.
- Services in NeonPanel must be mapped to Service Accounts in the Chart of Accounts for accurate accounting and reporting.
- NeonPanel imports Amazon statements and Shopify orders, and generates invoices and journal entries based on that data.
- NeonPanel does not create Cash vs Accounts Payable transactions; those are recorded directly in the accounting system via their connection to banks.
- QuickBooks Online sync settings support Manual, On (Auto), and Off options.
- Inventory-related accounting transactions are warehouse-bound. Inventory Orders (POs) and Invoices reference exactly one warehouse. Shipments reference an Origin and a Destination warehouse. Bills are linked to orders or shipments which carry the warehouse association.
- FIFO transactions are calculated per warehouse. Moving goods between warehouses (via shipments) creates separate FIFO events at the Origin and Destination.
- Amazon Global Logistics (AGL) services must be configured separately for freight cost tracking and require a custom FBA Freight service and default AGL Services vendor account.
- Starting balances must be entered and verified before go-live to ensure accurate inventory and financial reporting.
- Transaction mapping defines how NeonPanel documents (Orders, Bills, Shipments, Invoices) flow into accounting systems and how warehouse associations are maintained.
- FIFO transaction quality metrics track the health and accuracy of COGS calculations per warehouse.
- Landed cost analytics provide visibility into service costs, freight expenses, and cost distribution across inventory movements.
- Inventory audits reconcile NeonPanel inventory records against 3PL or internal warehouse records to ensure data accuracy.
- Amazon Profit Analytics (beta) provides KPI dashboards, profit and loss analysis, and COGS variation tracking for Amazon sales channels.
- When a user asks about contributors, breakdowns, or causes of a metric, the agent must always drill down to the most granular level available (SKU or transaction level) in the first response — never use catch-all categories like Other or Untracked that hide the actual data.
