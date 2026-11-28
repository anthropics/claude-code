# Catalog Management — Canonical Claims

These are verified facts. Only make claims that appear in this list.

- Products are master records that define what you sell; Inventory tracks stock levels by warehouse.
- Product Families group related products together for organizational and reporting purposes.
- Parent Products are created by merging multiple SKUs into a single parent-child hierarchy.
- Services in NeonPanel include auto-generated Amazon services, custom services, and landed cost services.
- Amazon Global Logistics (AGL) services must be configured separately for freight cost tracking.
- Service Account Connections map services to Chart of Accounts entries for accurate accounting.
- Brands are organizational units that can be assigned to products for categorization and reporting.
- Vendors are suppliers that can be linked to products for procurement and cost tracking.
- Service Groups organize related services for easier management and reporting.
- Both Products and Inventory are required in NeonPanel: Products define what you sell, Inventory tracks warehouse stock levels.
- Product/SKU merging does NOT require zero inventory on the SKUs being merged. The 'Inventory exists' error during a product merge does not mean inventory must be zeroed out.
- Warehouse merging requires that the warehouse being merged has no transactions. This is a different rule from product/SKU merging — do not conflate the two.
- The 'Inventory exists' error when merging products/SKUs indicates a conflict with existing inventory records on the target or source product, not that inventory quantities must be zero.
- Product merge rules and warehouse merge rules have different prerequisites. Warehouse merges require no transactions on the source warehouse; product merges have their own distinct requirements around inventory record conflicts.
- When uncertain about the exact meaning of a merge error message, the agent should state it does not have verified documentation rather than guess at the cause.
- Common merge-related error messages in NeonPanel include 'Inventory exists', which relates to inventory record conflicts during product/SKU merging.
