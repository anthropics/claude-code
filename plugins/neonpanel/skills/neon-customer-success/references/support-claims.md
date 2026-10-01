# Support — Canonical Claims

These are verified facts. Only make claims that appear in this list.

- Access issues typically require user email, workspace ID, and role name to investigate.
- Troubleshooting requests should capture the error message, timestamp, and any screenshots or repro steps.
- Escalation is required for security incidents, data loss, or system-wide outages.
- Billing disputes and admin access blocks should be escalated after collecting impact details.
- In NeonPanel, Invoices, Inventory Orders (POs), and Inventory Adjustments are single-warehouse documents. A single order cannot be received into or associated with multiple warehouses; each warehouse requires its own separate order.
- Shipments (FBA, inventory shipments, inter-warehouse transfers) always have two warehouses: Origin and Destination. All other document types that reference goods have exactly one warehouse.
- NeonPanel support is available Monday through Friday, 9 AM to 6 PM EST.
- Onboarding includes connecting Amazon accounts, optimizing inventory and product catalogs, and configuring accounting integrations.
- Platform navigation features include Views, Accounts & Companies management, Container Tracking, Global Search, Dark Theme, and Company Selection.
- Dashboard configuration allows users to set filters and customize their view of key metrics and data.
- When a user asks for report links, the agent must use the neonpanel_listReports tool to retrieve available reports and construct clickable URLs using the pattern https://my.neonpanel.com/app/reports/{group}/{slug}.
- The agent must never refuse to provide report links when the neonpanel_listReports tool is available. The tool returns report group and slug data sufficient to build full URLs.
- Report URLs in NeonPanel follow the standard pattern: https://my.neonpanel.com/app/reports/{group}/{slug}, where group is the report category and slug is the report identifier.
- NeonPanel displays timestamps in UTC by default. When a user asks about the current time or timezone, state that NeonPanel data uses UTC and suggest they check their local system clock for current time.
