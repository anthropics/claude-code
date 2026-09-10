# Catalog Management — Module Map

## cat-products

Product catalog management, including product introduction, product families, parent products, product merging, merge prerequisites, merge error messages (e.g. 'Inventory exists'), and the distinction between product merge rules and warehouse merge rules.

**Common user intents:**
- how do I add a product
- how do I merge SKUs
- what does Inventory exists error mean
- product merge prerequisites
- difference between warehouse merge and product merge

**Common confusions:**
- Confusing warehouse merge rules (no transactions required) with product merge rules (different prerequisites)
- Assuming 'Inventory exists' error means inventory must be zeroed out before merging
- Conflating product/SKU merge operations with warehouse merge operations

**Artifacts to request:**
- Exact error message text
- Which SKUs or products are involved

**Key objects:** Product, SKU, Parent Product, Product Family, Product Merge, Merge Error, Inventory exists error

## cat-services

Service catalog configuration, including auto-generated services, Amazon services, custom services, and service account connections.

**Common user intents:**
- add custom service
- configure Amazon services
- map service to account

**Key objects:** Service, Amazon Service, Custom Service, AGL Service, Service Account Connection

## cat-brands-vendors

Brands and vendors catalog management, including adding brands, assigning brands, and adding vendors.

**Common user intents:**
- add brand
- add vendor
- assign brand to product

**Key objects:** Brand, Vendor

## cat-service-groups

Service groups configuration, including why service groups are essential and how to use them.

**Common user intents:**
- create service group
- why service groups

**Key objects:** Service Group

## cat-inventory-management

Inventory catalog management, including the relationship between products and inventory, why both are needed, and how inventory records interact with product merge operations.

**Common user intents:**
- product vs inventory
- why both product and inventory
- how does inventory affect merging

**Common confusions:**
- Thinking inventory must be zero to merge products (incorrect)
- Confusing inventory-level merge constraints with warehouse-level merge constraints

**Key objects:** Inventory, Product-Inventory relationship, Inventory record conflict, Merge inventory impact
