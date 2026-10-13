# Catalog Management — Playbook

# Catalog Management Playbooks

## Add a New Product

1. Navigate to the Products section in NeonPanel.
2. Click "Add Product" or "New Product".
3. Enter the product name, SKU, and basic details.
4. Assign the product to a Product Family if applicable (optional).
5. Configure pricing and availability settings.
6. Save the product.
7. Verify the product appears in the catalog.

## Create a Product Family

1. Navigate to the Products section.
2. Click "Product Families" or "Manage Families".
3. Click "New Family".
4. Enter the family name and description.
5. Select the parent product (if creating a parent-child hierarchy).
6. Add child SKUs to the family.
7. Save the family.
8. Verify the family structure in the product hierarchy.

## Merge Products into a Parent Product

1. Identify the SKUs to merge.
2. Navigate to the Products section.
3. Select the primary SKU (this becomes the parent).
4. Click "Create Parent Product" or "Merge Products".
5. Select the child SKUs to merge.
6. Confirm the merge operation.
7. Verify the parent-child hierarchy is created.
8. Update any affected inventory or orders.

## Troubleshoot Product/SKU Merge Errors

1. Identify the exact error message displayed (e.g., "Inventory exists").
2. Determine whether the user is merging **products/SKUs** or **warehouses** — the rules are different.
3. If merging **products/SKUs**:
   - The "Inventory exists" error indicates a conflict with existing inventory records, NOT that inventory quantities must be zero.
   - Do NOT advise the user to zero out inventory as a fix — this is incorrect.
   - If the exact cause of the error is not covered in verified facts, state that clearly and escalate rather than guessing.
4. If merging **warehouses**:
   - Warehouse merging requires that the source warehouse has **no transactions**.
   - This is a completely different rule from product/SKU merging — do not conflate them.
5. If the error message is not recognized or documented, tell the user: "I don't have verified documentation on this specific error. Let me escalate to get you an accurate answer."
6. Never fabricate an explanation for a merge error — always ground the answer in verified facts or escalate.

## Configure a Custom Service

1. Navigate to the Services catalog.
2. Click "Add Service" or "New Service".
3. Select the service type (Amazon, Custom, or AGL).
4. Enter the service name and description.
5. Configure service parameters (if applicable).
6. Map the service to a Chart of Accounts entry.
7. Save the service.
8. Verify the service appears in the Services list.

## Map a Service to an Account

1. Navigate to the Services catalog.
2. Find the service to map.
3. Click "Edit" or "Configure Mapping".
4. Select the target account from the Chart of Accounts.
5. Confirm the mapping.
6. Save the changes.
7. Verify the mapping in the Service-Account Mapping report.

## Add a Brand

1. Navigate to the Brands section.
2. Click "Add Brand" or "New Brand".
3. Enter the brand name and details.
4. Save the brand.
5. Verify the brand appears in the Brands list.

## Assign a Brand to a Product

1. Navigate to the Products section.
2. Find the product to assign a brand to.
3. Click "Edit" or "Configure".
4. Select the brand from the Brand dropdown.
5. Save the changes.
6. Verify the brand assignment in the product details.

## Add a Vendor

1. Navigate to the Vendors section.
2. Click "Add Vendor" or "New Vendor".
3. Enter the vendor name, contact details, and terms.
4. Save the vendor.
5. Verify the vendor appears in the Vendors list.

## Create a Service Group

1. Navigate to the Service Groups section.
2. Click "Create Group" or "New Group".
3. Enter the group name and description.
4. Select services to include in the group.
5. Confirm the grouping logic.
6. Save the group.
7. Verify the group appears in the Service Groups list.

## Analyze Product Returns

1. Navigate to the Product Returns dashboard.
2. Review the Trend Graph to see return patterns over time.
3. Check the Average Refund Rates by product or category.
4. Identify the Biggest Contributors to returns.
5. Use filters to drill down by warehouse, time period, or product family.
6. Export the data for further analysis if needed.
7. Document findings and recommendations.