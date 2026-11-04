# Amazon Listing Compliance — Canonical Claims

These are verified facts. Only make claims that appear in this list.

- ALL CAPS text is prohibited in Amazon bullet points — even for headers or emphasis. Use sentence case or title case instead.
- Price mentions are prohibited in Amazon bullet points because prices vary by seller, promotions, and time. Never include specific prices like '$0.08/pad' in listing copy.
- Review counts and star ratings must never appear in Amazon listing copy. Values like '4.6-star rating from 2,600+ reviews' are dynamic data that cannot be embedded in static listing content.
- Cross-product references are prohibited in Amazon bullet points. Do not reference other ASINs, competitor products, or other items in the seller's catalog within a single listing's copy.
- Promotional claims such as 'Save 10%', 'Best Deal', 'Limited Time Offer', or 'Save X% vs Buying Separately' are prohibited in Amazon product titles.
- Amazon product titles must not contain promotional language, subjective claims, or pricing information.
- Unit conversions in listing copy must be mathematically accurate. For example, 2mm equals approximately 0.079 inches, NOT 0.2 inches. Always verify conversions before including them.
- US Amazon marketplace listings should use imperial units (inches, pounds, ounces, Fahrenheit) as the primary measurement system. Metric equivalents may be included in parentheses.
- Violating Amazon Content Policy rules can result in listing suppression, meaning the product becomes unsearchable and unbuyable until the violation is corrected.
- Every piece of generated listing copy must be validated against the full Amazon compliance checklist before being presented to the user.
- Amazon bullet points should use sentence case or title case for the first few words as a soft header, followed by the descriptive content — never use ALL CAPS words as bullet headers.
- Do not include time-sensitive or variable information in listing copy — this includes prices, stock levels, review counts, ratings, and promotional offers.
- Factual product claims in listing copy must be verifiable and accurate. Do not exaggerate dimensions, quantities, or performance metrics.
- Common unit conversion reference: 1 inch = 25.4 mm | 1 mm = 0.03937 inches | 1 foot = 304.8 mm | 1 oz = 29.5735 ml | 1 fl oz = 29.5735 ml | 1 ml = 0.03381 fl oz | 1 lb = 0.4536 kg | 1 kg = 2.2046 lbs | 1 oz (weight) = 28.3495 g | 1 g = 0.03527 oz.
- Every unit conversion in listing copy must be independently calculated and verified before output — never estimate, round prematurely, or rely on memory. Use the formula: mm ÷ 25.4 = inches, inches × 25.4 = mm, oz × 29.5735 = ml, lbs × 0.4536 = kg.
- 0.2 inches = 5.08 mm (NOT 2 mm). This is a known error pattern — always multiply inches by 25.4 to get mm, or divide mm by 25.4 to get inches.
- Per-unit pricing (e.g., '$0.08/pad', '$0.05/pad', 'only $X per piece') is prohibited in Amazon listing copy. Prices are variable and must never appear in static bullet points or descriptions.
- Specific review metrics (e.g., '4.6-star rating', '2,600+ reviews', 'thousands of 5-star reviews') are prohibited in Amazon listing copy. Review data is dynamic and controlled by Amazon — it cannot be embedded in seller-authored content.
- Cross-referencing other products in the seller's catalog (e.g., 'use our Felt Pads for heavy furniture', 'pair with our X product') is prohibited in Amazon bullet points. Each listing must describe only the product being sold.
- The agent must run a Prohibited Content Quick-Check on all generated listing copy before presenting it to the user, scanning for: (1) any prices or per-unit costs, (2) any review counts or star ratings, (3) any cross-product references. All matches must be removed before output.
- Promotional language is strictly prohibited in Amazon product titles. This includes but is not limited to: discount percentages ('Save 10%', '20% Off'), savings comparisons ('Save X% vs Buying Separately', 'Better Value Than'), superlative value claims ('Best Value', 'Best Deal', 'Lowest Price', 'Bargain', 'Great Savings'), and urgency or time-limited language ('Limited Time', 'Special Offer', 'Act Now', 'While Supplies Last', 'Exclusive Deal'). This applies to all listing types including Virtual Bundles.
- The agent must always attempt to retrieve data using available MCP tools (NeonPanel, BrightData) before asking the user for information. Users should only be asked for data that genuinely cannot be retrieved via tools, such as internal business decisions, strategy preferences, or data not tracked in connected systems.
