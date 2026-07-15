# Inventory Validation — Module Map

## sku-resolution

Resolving product identifiers to specific SKUs: handling parent ASINs (which map to multiple children), child ASINs, SKU codes, and product family names. Confirming the correct marketplace.

**Common user intents:**
- Find this product
- Look up this ASIN
- Which SKUs are under this parent?
- Resolve this identifier

**Common confusions:**
- Treating a parent ASIN as a single product
- Not specifying marketplace
- Assuming SKU codes are unique across marketplaces

**Artifacts to request:**
- Product identifier
- Company ID
- Marketplace

**Key objects:** Parent ASIN, Child ASIN, SKU code, Product family, Marketplace, neonpanel_listInventoryItems

## config-verification

Verifying that all required planning configuration exists for a SKU: lead time, safety stock, forecast scenario assignment, planning status (actively sold), and vendor/MOQ settings.

**Common user intents:**
- Is this SKU ready for planning?
- Check the configuration
- What's missing?

**Common confusions:**
- Assuming company defaults always exist
- Not checking each SKU independently
- Confusing SKU-level config with company-level defaults

**Key objects:** Lead time days, Safety stock days, Forecast scenario assignment, Planning base status, Vendor info, MOQ, Company defaults

## warehouse-verification

Verifying warehouse identity and type: detecting warehouse clones (same name, different IDs), distinguishing AWD from FBA, and confirming warehouse types (FBA, AWD, 3PL, own).

**Common user intents:**
- Check the warehouses
- Are there duplicate warehouses?
- Is this AWD or FBA?

**Common confusions:**
- Matching warehouses by name instead of ID
- Treating AWD inventory as FBA-available
- Not checking for clones

**Artifacts to request:**
- Company ID

**Key objects:** Warehouse ID, Warehouse name, Warehouse type, Warehouse clone, AWD vs FBA, neonpanel_listWarehouses
