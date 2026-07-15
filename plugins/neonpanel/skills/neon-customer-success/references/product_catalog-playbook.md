# Product Catalog — Playbook

# Product Catalog Playbooks

## 1. Update Product Listing

**When to use:** Need to create, edit, or update a product listing on one or more sales channels.

**Steps:**
1. **Identify product and channel:**
   - Locate product by SKU, product ID, or name
   - Determine target sales channel(s) (Amazon, Shopify, eBay, etc.)
   - Check current listing status (draft, active, inactive)

2. **Gather listing information:**
   - **Required fields:** Title, description, price, SKU, images
   - **Optional fields:** Bullet points, keywords, category, brand, condition
   - **Channel-specific:** Review channel requirements and restrictions
   - **Images:** Verify images meet channel specifications (size, format, count)

3. **Validate data:**
   - Check for required field completeness
   - Validate price format and currency
   - Ensure SKU is unique and properly formatted
   - Verify images are accessible and meet requirements
   - Review description for prohibited content or keywords

4. **Update listing:**
   - Edit product data in catalog system
   - Apply changes to target channel(s)
   - Preview changes if available
   - Save draft or publish immediately based on workflow

5. **Verify update:**
   - Check listing status after update
   - Confirm changes appear correctly on channel
   - Review for any errors or warnings
   - Test listing visibility and functionality

6. **Document changes:**
   - Log update in catalog change history
   - Note any channel-specific issues or requirements
   - Update product master record if needed

**Expected outcome:** Product listing updated successfully across target channels with all required information validated and published.

---

## 2. Bulk Catalog Changes

**When to use:** Need to update multiple products at once (price changes, category updates, attribute changes, etc.).

**Steps:**
1. **Plan bulk operation:**
   - Identify products to update (by SKU, category, brand, or filter)
   - Define changes to apply (price adjustment, attribute update, status change)
   - Determine affected channels
   - Estimate impact and validate business case

2. **Prepare update file:**
   - Export current product data for selected products
   - Create update spreadsheet or CSV with changes
   - Include SKU or product ID for matching
   - Format data according to import template requirements

3. **Validate bulk data:**
   - Check data format and completeness
   - Validate SKU/product ID matching
   - Review changes for accuracy and consistency
   - Test on small subset (10-20 products) first

4. **Schedule bulk update:**
   - Choose off-peak hours if possible
   - Create import job in catalog system
   - Upload update file
   - Configure import settings (validation level, error handling)

5. **Monitor import:**
   - Track import job progress
   - Review validation results and errors
   - Fix any data errors and re-import if needed
   - Verify successful updates

6. **Sync to channels:**
   - Trigger catalog sync to affected channels
   - Monitor sync status and errors
   - Verify changes appear on channels
   - Check for channel-specific issues

7. **Verify and document:**
   - Spot-check updated products on channels
   - Review change log for accuracy
   - Document bulk operation details
   - Notify stakeholders of completion

**Expected outcome:** Bulk changes applied successfully to all target products, synced to channels, and verified with minimal errors.

---

## 3. SKU Troubleshooting

**When to use:** SKU data issues, inventory mapping problems, or product variant errors.

**Steps:**
1. **Identify the issue:**
   - **SKU not found:** SKU doesn't exist in catalog
   - **Inventory mismatch:** SKU not mapped to inventory correctly
   - **Variant error:** Product variant relationship broken
   - **Data quality:** Missing or incorrect SKU attributes
   - **Duplicate SKU:** Multiple products with same SKU

2. **Gather SKU information:**
   - Retrieve SKU details from catalog
   - Check SKU in inventory system
   - Review product variant relationships
   - Check for duplicate SKUs
   - Review SKU history and changes

3. **Diagnose root cause:**
   - **Missing SKU:** Check if product exists but SKU missing
   - **Mapping issue:** Verify inventory system integration
   - **Variant issue:** Check parent-child product relationships
   - **Data issue:** Review attribute completeness and validation rules
   - **Duplicate:** Identify source of duplicate creation

4. **Resolve issue:**
   - **Create missing SKU:** Add SKU to product if missing
   - **Fix mapping:** Update inventory system mapping
   - **Repair variants:** Re-link variant relationships
   - **Update data:** Correct missing or incorrect attributes
   - **Merge duplicates:** Consolidate duplicate SKUs if needed

5. **Verify resolution:**
   - Check SKU appears correctly in catalog
   - Verify inventory mapping works
   - Test SKU lookup and search
   - Confirm variant relationships correct
   - Validate data quality checks pass

6. **Prevent recurrence:**
   - Review data validation rules
   - Update SKU creation workflow if needed
   - Document issue and resolution
   - Add monitoring or alerts if applicable

**Expected outcome:** SKU issue identified, root cause diagnosed, problem resolved, and prevention measures implemented.