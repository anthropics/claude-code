# Product Catalog — Module Map

## listing-management

Creation, editing, and management of product listings across multiple sales channels and marketplaces.

**Common user intents:**
- create listing
- update product
- publish listing
- edit product details
- manage listings

**Key objects:** product_listing, channel, marketplace, listing_status, title, description, images

## sku-data

Management of SKU-level product data including attributes, variants, inventory mapping, and data quality.

**Common user intents:**
- add SKU
- update SKU data
- product variants
- SKU attributes
- barcode lookup

**Key objects:** sku, product_variant, attributes, inventory_mapping, data_quality, barcode

## catalog-updates

Bulk catalog operations, data synchronization, import/export workflows, and catalog maintenance tasks.

**Common user intents:**
- bulk update products
- import catalog
- export products
- sync catalog
- catalog changes

**Key objects:** bulk_update, import_job, export_job, sync_status, catalog_version, change_log
