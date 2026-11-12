# Neonpanel Onboarding — Playbook

# NeonPanel Onboarding Playbooks

## Amazon Data Connection and Processing

1. Confirm the client has Amazon Seller Central access and knows which marketplaces to connect.
2. Guide the client through connecting their Amazon account in NeonPanel.
3. Explain that NeonPanel will automatically import warehouses, inventory, orders, fees, and shipments from Amazon.
4. Inform the client that NeonPanel processes and validates this data — it is not immediately ready after connection.
5. NeonPanel handles duplicate SKU cleanup and catalog validation during this phase.
6. NeonPanel pre-fills inventory data from Amazon into the Initial Amazon Inventory Project.
7. Inform the client they will need to enter or confirm per-unit costs in the next phase.

## Client Data Collection (Non-Amazon)

1. Explain that the client is responsible for providing all non-Amazon data.
2. Request the following from the client:
   - 3PL warehouse balance reports (current stock levels at each non-Amazon warehouse)
   - Open PO spreadsheets (in-production purchase orders)
   - In-transit shipment details (on-the-water shipments)
   - Freight and customs invoices (for landed cost inputs)
3. Set a clear deadline for data submission — delays here delay the entire onboarding.
4. Remind the client that NeonPanel does not have access to non-Amazon data sources.
5. If the client is unsure what data to provide, walk through each category with examples.

## Amazon Inventory Cost Entry

1. Direct the client to the Initial Amazon Inventory Project in NeonPanel.
2. Explain that NeonPanel has pre-filled inventory quantities from Amazon, but per-unit costs must be entered by the client.
3. Emphasize that cost accuracy is critical — it affects all downstream FIFO calculations, COGS, and profitability reporting.
4. If the client doesn't know exact costs, suggest using supplier invoices or purchase records as reference.
5. Have the client review and confirm all costs before proceeding.

## Operational Data Validation

1. Explain the split responsibility: NeonPanel validates technical correctness (format, duplicates, references); the client validates business accuracy (correct quantities, costs, vendors).
2. For warehouse balances: NeonPanel checks data format; client confirms actual stock levels match.
3. For in-production POs: NeonPanel validates structure; client confirms PO details are current and accurate.
4. For on-the-water shipments: NeonPanel validates shipment records; client confirms shipment status and expected arrival.
5. Flag any discrepancies found during technical validation and ask the client to resolve business-side issues.

## Chart of Accounts and Accounting Setup

1. Ask the client whether they want to use NeonPanel's default Chart of Accounts or their own custom CoA.
2. If using a custom CoA: explain that this requires reconfiguring service-account mappings in the Services catalog.
3. NeonPanel can propose default service-account mappings, but the client must review and approve them.
4. Guide the client through connecting their accounting system (QuickBooks Online or Xero).
5. Ensure the client has accounting system credentials ready before attempting connection.
6. Have the client define their accounting policy preferences (e.g., how to handle specific transaction types).
7. Review and finalize all mappings before proceeding to dry-run.

## Service-Account Mapping

1. Navigate to the Services catalog in NeonPanel.
2. Review the auto-generated service list (Amazon services, Shopify services, landed cost services).
3. For each service, verify the mapped Chart of Accounts entry is correct.
4. If using a custom CoA, reconfigure each service-account mapping to match the client's accounts.
5. Have the client approve all mappings before proceeding.
6. Document any services that don't have a clear account mapping — these need client decision.

## Dry-Run Testing

1. Explain that dry-run is a test run of the full data flow — it is NOT automatic and requires active review.
2. NeonPanel runs the dry-run and generates a validation report.
3. Review the validation report with the client, checking for:
   - Data accuracy (do the numbers look right?)
   - Missing records (are all expected transactions present?)
   - Mapping correctness (are transactions hitting the right accounts?)
4. If discrepancies are found, they MUST be resolved before go-live.
5. Document all issues found and assign owners (NeonPanel vs. client) for resolution.
6. Re-run the dry-run after fixes are applied to confirm resolution.

## Go-Live Approval

1. Confirm all dry-run discrepancies have been resolved.
2. Confirm starting balances have been entered and verified.
3. Present the go-live checklist to the client:
   - Amazon data imported and validated ✓
   - Non-Amazon data provided and validated ✓
   - Costs entered in Initial Amazon Inventory Project ✓
   - Chart of Accounts finalized ✓
   - Service-account mappings approved ✓
   - Dry-run passed with no unresolved issues ✓
   - Starting balances entered and verified ✓
4. Get explicit client approval to proceed with go-live.
5. Set the go-live date and communicate the monitoring period.
6. Transition to live sync.

## Post-Go-Live Support

1. Inform the client that NeonPanel provides post-go-live monitoring and support.
2. NeonPanel conducts health checks to ensure data is flowing correctly.
3. Offer optimization guidance for:
   - Forecasting setup
   - Profitability analysis configuration
   - New channel or warehouse additions
4. Remind the client that new channels and warehouses require additional setup — they are not automatically configured.
5. Explain ongoing client responsibilities (see Data Maintenance playbook).

## Ongoing Data Maintenance (Client Responsibility)

1. Explain that after go-live, the client is responsible for maintaining accurate data:
   - Enter new POs as they are placed
   - Upload freight invoices promptly for accurate landed cost tracking
   - Maintain inventory records (adjustments, transfers)
   - Report structural changes (new warehouses, new sales channels)
2. Emphasize that delayed freight invoice uploads will result in incomplete landed cost data.
3. For new warehouse additions: guide the client through the setup process or escalate to NeonPanel support.
4. For new sales channel additions: explain that additional configuration is required and coordinate with NeonPanel.

## Responsibility Clarification (Who Does What)

1. When a client asks "who does what?", use this framework:
   - **NeonPanel handles**: Amazon data import/processing, technical validation, duplicate cleanup, catalog validation, dry-run execution, post-go-live health checks, optimization guidance.
   - **Client handles**: Non-Amazon data provision, cost entry, business accuracy validation, CoA finalization, accounting policy decisions, mapping approval, go-live approval, ongoing data maintenance.
   - **Shared**: Dry-run review (NeonPanel runs it, client validates results), discrepancy resolution (depends on the issue source).
2. If a specific task is ambiguous, check the module definitions for the relevant onboarding phase.
3. When in doubt, clarify with the client rather than assuming responsibility.