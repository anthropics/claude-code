# Amazon Listing Optimization — Playbook

# Amazon Listing Optimization Playbooks

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

### 4. Unsubstantiated Claims & Social Proof Scan
- Search for: "trusted by", "loved by", "#1", "number one", "best selling", "most popular", "America's favorite", "world's best", any number followed by "customers" or "users" (e.g., "78K+ customers"), "doctor recommended", "clinician approved", "dermatologist tested", "dentist recommended", "expert approved", "professionally recommended", "clinically proven", "lab tested", "FDA approved" (unless actually FDA-regulated), any professional endorsement or certification claim
- If found: Check whether the user has provided documented, verifiable proof of the claim. If NO proof exists, remove the claim entirely — do not rephrase or soften it. If proof IS provided and the claim is legally substantiated, it may remain.
- Examples of violations:
  - "Trusted by 78K+ Customers" → REMOVE (references review/customer count as social proof)
  - "Over 78,000 5-star reviews" → REMOVE (directly references reviews and ratings)
  - "Doctor Recommended Seat Cushion" → REMOVE unless user provides documented medical endorsement
  - "America's #1 Cushion" → REMOVE (unsubstantiated superlative claim)
  - "Clinically Proven to Reduce Pain" → REMOVE unless user provides clinical study documentation
- Correct approach: Describe product qualities, materials, and design features directly. Instead of "Doctor Recommended", describe the ergonomic design features. Instead of "Trusted by 78K+ Customers", describe the product benefits that earn customer satisfaction.
- **Why this matters**: Amazon explicitly prohibits reviews, quotes, testimonials, and promotional material in listing copy. Social proof statements that reference customer counts or ratings are a form of testimonial. Unsubstantiated professional endorsements are promotional claims that may also violate FTC guidelines.

### 5. Final Confirmation
- After removing all violations, re-read the copy to ensure it still makes sense and flows naturally.
- Confirm: "Prohibited content check passed — no prices, reviews, cross-product references, or unsubstantiated claims found."

## Self-Generated Copy Compliance Cross-Check (MANDATORY)

**This playbook applies whenever the agent generates, suggests, or drafts ANY listing copy — titles, bullets, descriptions, A+ Content text, or A/B test variations.**

The agent must validate its own generated output against the same compliance rules it uses to audit existing listings. This is a non-negotiable gate before presenting suggestions to the user.

### When This Applies
- Writing new listing copy from scratch
- Suggesting title alternatives or A/B test variations
- Recommending bullet point improvements
- Drafting product descriptions
- Proposing any text that would appear in an Amazon listing field

### Cross-Check Steps
1. **Generate the draft copy** as normal based on product data, keywords, and user requirements.
2. **STOP before presenting.** Do not show the draft to the user yet.
3. **Run the full Prohibited Content Quick-Check** (all 4 scans: Price, Review & Rating, Cross-Product, Unsubstantiated Claims & Social Proof) against every line of the generated copy.
4. **For each violation found:**
   - Remove the violating content entirely
   - Replace with a compliant alternative that preserves the marketing intent
   - Document what was removed and why (internally — do not burden the user with this unless they ask)
5. **Run the Pre-Submission Compliance Checklist** against the corrected copy.
6. **Only after all checks pass**, present the copy to the user.
7. **Include a brief compliance confirmation** at the end of your output: "All suggestions have been validated against Amazon Content Policy — no prohibited content found."

### Common Self-Generation Traps to Avoid
- **Social proof as persuasion**: Do NOT use customer counts, review metrics, or trust signals to make bullets more compelling. Use product features and benefits instead.
- **Endorsement claims as differentiators**: Do NOT suggest professional endorsements (Doctor/Dentist/Expert Recommended) as title or bullet differentiators unless the user has provided documented proof.
- **A/B test loopholes**: Do NOT suggest policy-violating copy as "test variations" — compliance rules apply equally to all suggested copy, including test alternatives.
- **Competitor comparison via social proof**: Do NOT use phrases like "most reviewed" or "highest rated in category" to differentiate from competitors.

## Pre-Submission Compliance Checklist

Run this checklist against ALL generated listing copy before presenting it to the user. Every item must pass.

1. **Prohibited Content Quick-Check (MANDATORY FIRST STEP)** — Run the Prohibited Content Quick-Check playbook above. Copy must pass all four scans (price, review/rating, cross-product, unsubstantiated claims & social proof) before proceeding.
2. **No ALL CAPS** — Scan every bullet point for fully capitalized words used as headers or emphasis. Replace with sentence case or title case. Example: ✘ "ULTRA THIN DESIGN" → ✓ "Ultra Thin Design" or "Ultra thin design — ..."
3. **No price mentions** — Confirmed by Quick-Check step 1 above. Double-check: search for dollar signs ($), cent symbols (¢), and phrases like "cost per", "only $", "just $", "per unit", "per pad", or any specific monetary value.
4. **No review or rating references** — Confirmed by Quick-Check step 2 above. Double-check: search for star ratings, review counts, or phrases like "rated", "reviews", "stars", "customer favorite".
5. **No cross-product references** — Confirmed by Quick-Check step 3 above. Double-check: check for mentions of other products, ASINs, competitor names, or phrases like "use our", "pair with", "compared to", "unlike other", "vs", "better than".
6. **No unsubstantiated claims** — Confirmed by Quick-Check step 4 above. Double-check: search for professional endorsements, certification claims, social proof statements, or superlative claims without documented proof.
7. **No promotional claims in titles** — Check the title for discount language, savings claims, urgency language, or subjective superlatives. Example: ✘ "Save 10% vs Buying Separately" → ✓ Remove from title entirely.
8. **Verify all unit conversions (MANDATORY)** — For every measurement that includes a conversion, calculate it using exact factors. Do NOT rely on memory. Use the Unit Conversion Validation playbook below. Example: ✘ "0.2 inch (2mm)" [WRONG: 0.2 × 25.4 = 5.08mm] → ✓ "0.2 inches (5.08mm)" or "2mm (0.08 in)".
9. **Correct units for marketplace** — US listings use inches, pounds, ounces, Fahrenheit as primary units. Metric may appear in parentheses.
10. **No time-sensitive or variable data** — Check for stock levels, shipping times, seasonal references, or any data that changes over time.
11. **Factual accuracy** — Verify that all product claims (dimensions, quantities, materials, performance) are accurate and match the provided specs.
12. **Title format** — Confirm the title contains: Brand + Key Feature + Product Type + Size/Quantity. No promotional language, no ALL CAPS (except brand names that are officially capitalized).

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
6. **Run the Self-Generated Copy Compliance Cross-Check** — this is mandatory before presenting any generated copy. Scan for all prohibited content categories including unsubstantiated claims and social proof.
7. For any measurements, run the **Unit Conversion Validation** playbook to verify all conversions.
8. Run the full **Pre-Submission Compliance Checklist** against the draft.
9. Fix any violations found.
10. Present the validated copy to the user with a note confirming compliance checks passed and unit conversions verified.

## Keyword Research and Integration

1. Identify the product category and main product type.
2. Use available tools (Helium 10, Jungle Scout, Brand Analytics) to pull keyword data.
3. Categorize keywords into three tiers:
   - **Primary keywords**: Highest volume, most relevant to the product (use in title).
   - **Secondary keywords**: Moderate volume, relevant variations (use in bullets and description).
   - **Long-tail keywords**: Lower volume but high buyer intent (use in description and backend).
4. Check for keyword cannibalization — avoid duplicating the same keyword across title, bullets, and backend.
5. Map keywords to listing elements:
   - Title: Primary keyword + brand + key differentiator
   - Bullets: Secondary keywords woven into benefit statements
   - Description: Long-tail keywords in natural language
   - Backend: Synonyms, alternate spellings, abbreviations not used on the front end
6. Validate that all keywords reflect actual buyer search behavior, not just high volume.

## Optimizing for Mobile Shoppers

1. Review the title — only the first 80 characters are visible on mobile. Front-load the most important keywords and benefits.
2. Review bullet points — only the first 2-3 bullets may be visible without expanding. Put the strongest benefits first.
3. Check hero image — ensure the product is clearly visible at thumbnail size (mobile search results).
4. Verify that A+ Content renders well on mobile — avoid text-heavy modules that become unreadable on small screens.
5. Test the listing on a mobile device or mobile preview if available.

## A+ Content Strategy

1. Determine eligibility — A+ Content is available to Brand Registered sellers.
2. Plan the content layout:
   - **Hero banner**: Brand story or key product benefit
   - **Feature blocks**: 3-4 key features with images and short descriptions
   - **Comparison chart**: Compare your product variants or show advantages vs generic alternatives (never name competitors)
   - **Use case imagery**: Lifestyle photos showing the product in context
3. Write concise, benefit-focused copy for each module — A+ Content is visual-first.
4. Ensure all A+ Content passes the Prohibited Content Quick-Check.
5. Submit for Amazon review and monitor for approval.

## Listing Performance Review

1. Pull current listing performance metrics (CTR, conversion rate, sessions, sales velocity).
2. Compare against category benchmarks if available.
3. Identify weak points:
   - Low CTR → Title or hero image needs improvement
   - Low conversion → Bullets, description, or A+ Content needs work
   - Low sessions → Keyword coverage or advertising gaps
4. Prioritize changes by impact — title and hero image changes typically have the largest effect.
5. Make changes selectively — avoid overhauling everything at once, which can temporarily hurt rankings.
6. Monitor results for 2-4 weeks before making additional changes.
7. Document what was changed and the performance impact for future reference.

## Subscribe with Amazon — Listing Setup

1. **Verify eligibility** — Confirm the product is a digital or cloud-based subscription service. Physical products are not eligible for Subscribe with Amazon.
2. **Gather required product information:**
   - Product name
   - Product category
   - Subscription length(s) (time period and/or number of deliveries)
   - Purchase price
   - SKU and UPC/EAN/JAN numbers
   - Compatible devices
   - Supported login types
   - Availability information
   - Product image (must depict only the product — no extra logos, text, or markings)
   - Any legally required disclaimers, warnings, or notices
   - Link to your website
   - Link to your privacy policy and any other applicable terms
3. **Check for auto-renewal** — If the subscription auto-renews, proceed to the Auto-Renewal Disclosures playbook below.
4. **Validate the product image** — Ensure it accurately depicts only the product with no additional logos, text, or other markings.
5. **Review against Restricted Products Guidelines** — Confirm the product is not on Amazon's restricted list.
6. **Run the Pre-Submission Compliance Checklist** to validate all listing content.
7. Submit the listing for review.

## Subscribe with Amazon — Auto-Renewal Disclosures

If your subscription product auto-renews, the listing must clearly and conspicuously display ALL four of the following disclosures:

1. **Auto-renewal notice**: "Subscriptions automatically renew unless auto-renew is turned off at least 24 hours before the end of the current term."
2. **Charge timing**: "Account will be charged for renewal within 24 hours prior to the end of the current term."
3. **Renewal terms**: Clearly state the term length and cost of the renewal (e.g., "$9.99/month" or "$99/year").
4. **Management instructions**: "Subscriptions may be managed by the customer and auto-renewal may be turned off by going to the customer's subscription settings after the transaction is completed."

### Validation Steps
1. Search the listing for all four disclosure elements.
2. Confirm each is displayed "clearly and conspicuously" — not buried in fine print.
3. Verify the renewal term and cost match the actual subscription pricing.
4. If any disclosure is missing or unclear, flag it and provide the corrected language.

## Listing Content Restrictions Quick Reference

Before finalizing any listing, verify that NONE of the following appear in titles, descriptions, bullet points, or images:

1. ✘ Pornographic, obscene, or offensive content
2. ✘ Phone numbers, physical mail addresses, or email addresses
3. ✘ Website URLs (except those specifically required as part of Subscribe with Amazon product information)
4. ✘ Alternative ordering information or links to other websites
5. ✘ Reviews, quotes, or testimonials
6. ✘ Solicitations for positive customer reviews
7. ✘ Advertisements, promotional material, or watermarks on images/photos/videos
8. ✘ Time-sensitive information (tour dates, seminar schedules, etc.)
9. ✘ HTML, special characters (*/? etc.), or bad data in any listing field
10. ✘ Multiple products on a single detail page