# Amazon Listing Compliance — Playbook

# Amazon Listing Compliance Playbooks

## Tools-First Data Retrieval (MANDATORY — Run Before Asking Any Questions)

Before composing ANY question to the user, run through this checklist to determine if the data can be retrieved via tools instead.

### Step 1: Identify What You Need
- List every data point required to complete the user's request (e.g., product dimensions, PPC data, competitor listings, return reasons, variation details, inventory levels).

### Step 2: Check Tool Availability for Each Data Point

| Data needed | Tool to use | Ask user? |
|---|---|---|
| Product details, specs, dimensions | NeonPanel `getInventoryDetails` | NO — pull from tool |
| Inventory levels, warehouse data | NeonPanel `listInventoryItems`, `listWarehouses` | NO — pull from tool |
| COGS, unit costs, landed costs | NeonPanel `getInventoryCogs`, `getInventoryLandedCost` | NO — pull from tool |
| Competitor listings, pricing, reviews | BrightData product scraping | NO — pull from tool |
| Competitor bullet points, titles | BrightData product scraping | NO — pull from tool |
| Search volume, keyword data | Brand Analytics / available tools | NO — pull from tool |
| Return reasons, customer complaints | NeonPanel reports if available | Check tool first, ask only if unavailable |
| PPC performance data | NeonPanel reports if available | Check tool first, ask only if unavailable |
| Internal business strategy or goals | No tool available | YES — ask the user |
| Future product plans or unreleased items | No tool available | YES — ask the user |
| Subjective preferences (tone, angle, positioning) | No tool available | YES — ask the user |
| Brand guidelines or voice requirements | No tool available | YES — ask the user |
| Cost targets or margin goals not in NeonPanel | No tool available | YES — ask the user |

### Step 3: Retrieve First, Then Ask
1. Call all available tools in parallel to gather retrievable data.
2. Review what you received — identify any genuine gaps.
3. Only THEN ask the user for the remaining items (should typically be 1-3 questions, not 14).

### Step 4: Self-Check
- If you are about to ask more than 3 questions, STOP.
- Re-read your question list and cross-check each item against the tool availability table above.
- Remove any question where a tool could provide the answer.
- Proceed only with genuinely un-retrievable items.

## Prohibited Content Quick-Check (Mandatory Pre-Output Gate)

Run this check on ALL generated listing copy BEFORE presenting it to the user. This is a mandatory gate — copy must not be shown until it passes.

### 1. Price Scan
- Search for: dollar signs ($), cent symbols (¢), "cost per", "per unit", "per pad", "per piece", "per count", "only $", "just $", "for $", any specific monetary value
- If found: Remove the entire price reference. Replace with benefit-focused language that doesn't mention cost.
- Examples of violations: "$0.08/pad", "pack is $0.05/pad", "only $12.99", "less than $1 per piece"
- Correct approach: Focus on value proposition without specific numbers (e.g., "economical bulk pack" instead of "$0.05/pad")

### 2. Review & Rating Scan
- Search for: star ratings (any number + "star"), review counts (any number + "reviews"), "rated", "rating", "customer favorite", "best seller", "top rated", "highly rated", "thousands of reviews"
- If found: Remove the entire review/rating reference. Do not rephrase — remove completely.
- Examples of violations: "4.6-star rating from 2,600+ reviews", "thousands of 5-star reviews", "top-rated product"
- Correct approach: Describe product qualities directly without referencing customer feedback metrics

### 3. Cross-Product Reference Scan
- Search for: "use our", "pair with our", "try our", "see our", "our [other product name]", "works great with our", references to other ASINs, other product names from the seller's catalog
- If found: Remove the cross-reference entirely. Each listing must stand alone.
- Examples of violations: "use our Felt Pads for heavy furniture", "pair with our furniture sliders", "see our full line of floor protectors"
- Correct approach: Describe only the product being listed. Do not reference the seller's other products.

### 4. Final Confirmation
- After removing all violations, re-read the copy to ensure it still makes sense and flows naturally.
- Confirm: "Prohibited content check passed — no prices, reviews, or cross-product references found."

## Pre-Submission Compliance Checklist

Run this checklist against ALL generated listing copy before presenting it to the user. Every item must pass.

1. **Prohibited Content Quick-Check (MANDATORY FIRST STEP)** — Run the Prohibited Content Quick-Check playbook above. Copy must pass all three scans (price, review/rating, cross-product) before proceeding.
2. **No ALL CAPS** — Scan every bullet point for fully capitalized words used as headers or emphasis. Replace with sentence case or title case. Example: ✘ "ULTRA THIN DESIGN" → ✓ "Ultra Thin Design" or "Ultra thin design — ..."
3. **No price mentions** — Confirmed by Quick-Check step 1 above. Double-check: search for dollar signs ($), cent symbols (¢), and phrases like "cost per", "only $", "just $", "per unit", "per pad", or any specific monetary value.
4. **No review or rating references** — Confirmed by Quick-Check step 2 above. Double-check: search for star ratings, review counts, or phrases like "rated", "reviews", "stars", "customer favorite".
5. **No cross-product references** — Confirmed by Quick-Check step 3 above. Double-check: check for mentions of other products, ASINs, competitor names, or phrases like "use our", "pair with", "compared to", "unlike other", "vs", "better than".
6. **No promotional claims in titles** — Check the title for discount language, savings claims, urgency language, or subjective superlatives. Example: ✘ "Save 10% vs Buying Separately" → ✓ Remove from title entirely.
7. **Verify all unit conversions (MANDATORY)** — For every measurement that includes a conversion, calculate it using exact factors. Do NOT rely on memory. Use the Unit Conversion Validation playbook below. Example: ✘ "0.2 inch (2mm)" [WRONG: 0.2 × 25.4 = 5.08mm] → ✓ "0.2 inches (5.08mm)" or "2mm (0.08 in)".
8. **Correct units for marketplace** — US listings use inches, pounds, ounces, Fahrenheit as primary units. Metric may appear in parentheses.
9. **No time-sensitive or variable data** — Check for stock levels, shipping times, seasonal references, or any data that changes over time.
10. **Factual accuracy** — Verify that all product claims (dimensions, quantities, materials, performance) are accurate and match the provided specs.
11. **Title format** — Confirm the title contains: Brand + Key Feature + Product Type + Size/Quantity. No promotional language, no ALL CAPS (except brand names that are officially capitalized).

## Unit Conversion Validation

Run this procedure for EVERY unit conversion that appears in listing copy. Never skip this step.

### Reference Conversion Factors

| Conversion | Factor | Formula |
|---|---|---|
| Inches → Millimeters | 1 in = 25.4 mm | inches × 25.4 = mm |
| Millimeters → Inches | 1 mm = 0.03937 in | mm ÷ 25.4 = inches |
| Feet → Millimeters | 1 ft = 304.8 mm | feet × 304.8 = mm |
| Ounces (fluid) → Milliliters | 1 fl oz = 29.5735 ml | fl oz × 29.5735 = ml |
| Milliliters → Fluid Ounces | 1 ml = 0.03381 fl oz | ml ÷ 29.5735 = fl oz |
| Pounds → Kilograms | 1 lb = 0.4536 kg | lbs × 0.4536 = kg |
| Kilograms → Pounds | 1 kg = 2.2046 lbs | kg × 2.2046 = lbs |
| Ounces (weight) → Grams | 1 oz = 28.3495 g | oz × 28.3495 = g |
| Grams → Ounces | 1 g = 0.03527 oz | g ÷ 28.3495 = oz |

### Known Error Patterns

- ✘ 0.2 inches = 2 mm → ✓ 0.2 inches = 5.08 mm (0.2 × 25.4 = 5.08)
- ✘ 2 mm = 0.2 inches → ✓ 2 mm = 0.079 inches (2 ÷ 25.4 = 0.0787)
- Watch for "convenient" round numbers — if a conversion looks suspiciously clean, recalculate.

### Validation Steps

1. **Identify** every measurement in the copy that includes a unit conversion (e.g., "X inches (Y mm)").
2. **Look up** the correct conversion factor from the reference table above.
3. **Calculate** using the exact formula. Show your work: e.g., 0.2 in × 25.4 = 5.08 mm.
4. **Reverse-check** — convert the result back to the original unit to confirm: 5.08 mm ÷ 25.4 = 0.2 in ✓.
5. **Compare** your calculated value against what's in the copy. If they don't match, correct it.
6. **Flag suspiciously round numbers** — if a converted value is a clean round number (e.g., 2mm, 5mm, 10mm), double-check it. Real conversions are rarely perfectly round.
7. **Round appropriately** — round to 2 decimal places for inches, whole numbers for mm. Never round in a way that changes the measurement by more than 1%.
8. **Document** — when presenting the copy, note that unit conversions have been verified.

## Handling Compliance Violations Found During Review

1. Identify the specific violation and which rule it breaks.
2. Flag it clearly to the user with the original text and the rule violated.
3. Provide a corrected alternative that preserves the marketing intent while being compliant.
4. If multiple violations are found, list all of them — do not fix one and miss others.
5. After corrections, re-run the full checklist to confirm no new violations were introduced.

## Generating Compliant Listing Copy from Scratch

1. Confirm the target marketplace (US, UK, EU, etc.) to determine unit and formatting standards.
2. **Run the Tools-First Data Retrieval playbook** — pull all available product data, competitor info, and market data from NeonPanel and BrightData BEFORE asking the user any questions.
3. Gather ONLY genuinely missing info from the user — typically limited to: target positioning, preferred tone, specific marketing angles, or specs not available in tools.
4. Draft the title: Brand + Key Feature + Product Type + Size/Quantity. No promotional language.
5. Draft bullet points using sentence case or title case for soft headers. Focus on benefits and features.
6. **Run the Prohibited Content Quick-Check** — scan draft for any prices, reviews, or cross-product references. Remove all violations before proceeding.
7. For any measurements, run the **Unit Conversion Validation** playbook to verify all conversions.
8. Run the full **Pre-Submission Compliance Checklist** against the draft.
9. Fix any violations found.
10. Present the validated copy to the user with a note confirming compliance checks passed and unit conversions verified.