# Brightdata Research — Playbook

# BrightData Research Playbooks

## Single Product Lookup

1. Get the ASIN from the user (10-character alphanumeric code).
2. Confirm the target marketplace (default: US).
3. Call `web_data_amazon_product` with the ASIN and marketplace code.
4. Extract priority fields: title, bullet_points, price, bsr, rating, rating_count, images count, a_plus_content presence, category.
5. Summarize findings in a structured format — do not dump raw JSON.
6. If the user needs deeper analysis, offer to chain with reviews or competitor search.

## Competitive Keyword Search

1. Get the target keyword from the user.
2. Confirm the marketplace (default: US).
3. Call `web_data_amazon_product_search` with the keyword.
4. Extract the top 10 organic results: ASIN, title, price, rating, review_count, position.
5. Separately note sponsored results and their positions.
6. Report total result count and competitive density.
7. Offer to fetch detailed product data for specific competitors.

## Review Mining Workflow

1. Get the target ASIN from the user.
2. Call `web_data_amazon_product_reviews` with the ASIN.
3. Analyze the response for:
   - Rating distribution (1-5 star breakdown).
   - Top recurring positive themes (what customers love).
   - Top recurring negative themes (common complaints).
   - Verified purchase ratio.
   - Recurring customer language useful for keyword ideas.
4. Summarize sentiment with specific quotes where helpful.
5. Suggest keyword opportunities based on customer language.

## Full Competitive Analysis Workflow

1. Get the target product ASIN and primary keyword from the user.
2. **Step 1 — Discover competitors**: Search the primary keyword using `web_data_amazon_product_search`. Extract top 5-10 organic ASINs.
3. **Step 2 — Fetch competitor details**: For each top competitor ASIN, call `web_data_amazon_product` to get full listing data.
4. **Step 3 — Pull competitor reviews**: For the top 3-5 competitors, call `web_data_amazon_product_reviews` to understand positioning.
5. **Step 4 — Aggregate and compare**: Build a comparison table covering price, rating, review count, BSR, bullet quality, A+ content presence, and image count.
6. Identify competitive gaps and opportunities.
7. If part of a listing audit, save all results to Supabase using `execute_sql`.

## Cross-Marketplace Price Comparison

1. Get the product identifier (ASIN, product name, or URL).
2. Confirm which marketplaces to check (Walmart, eBay, BestBuy, Google Shopping, etc.).
3. Call the appropriate cross-marketplace tool for each platform:
   - `web_data_walmart_product` for Walmart
   - `web_data_ebay_product` for eBay
   - `web_data_bestbuy_products` for BestBuy
   - `web_data_google_shopping` for Google Shopping
4. Extract from each: price, availability, seller, product title, condition.
5. Present a comparison table across all checked marketplaces.
6. Highlight pricing discrepancies, availability gaps, or competitive advantages.

## Bulk Research Workflow

1. Get the list of URLs, ASINs, or keywords from the user.
2. Check `session_stats` to monitor current usage before starting.
3. Choose the right batch tool:
   - Multiple URLs → `scrape_batch`
   - Multiple keywords → `search_engine_batch`
   - Multiple ASINs → sequential `web_data_amazon_product` calls (no batch tool available)
4. Use `scrape_as_markdown` as default format (cleaner output). Only use `scrape_as_html` when page structure or image URLs are needed.
5. Aggregate results into a summary table.
6. If rate limits are hit, pause and inform the user of remaining capacity.

## Listing Audit Data Collection (BrightData Phases)

1. Get the target ASIN and primary keywords from the audit context.
2. **Phase 1a — Target listing scrape**: Call `web_data_amazon_product` for the target ASIN. Save to Supabase.
3. **Phase 1b — Target reviews**: Call `web_data_amazon_product_reviews` for the target ASIN. Save to Supabase.
4. **Phase 1c — SERP snapshot**: Search the top 3 primary keywords using `web_data_amazon_product_search`. Save results to Supabase.
5. **Phase 1d — Competitor scrapes**: For the top 5 organic competitors from SERP, call `web_data_amazon_product` for each. Save to Supabase.
6. **Phase 1e — Competitor reviews**: For the top 3 competitors, pull reviews. Save to Supabase.
7. Do NOT analyze the data during collection — save raw results for the Strategist phase.

## Handling BrightData Failures

1. If a tool returns empty results:
   - Check ASIN format (must be 10-character alphanumeric, not a full URL).
   - Check marketplace code (US, UK, DE, JP, etc.).
   - Verify the product is available in that marketplace.
2. If rate-limited:
   - Call `session_stats` to check current usage.
   - Wait and retry after the rate limit window.
   - Inform the user of the limitation.
3. If partial data is returned:
   - Use what was returned — clearly state which fields are missing.
   - Do not fabricate missing data.
4. Never retry the exact same request — adjust the input (format, marketplace) or inform the user.
5. For persistent failures, suggest alternative approaches (manual lookup, different marketplace, different tool).