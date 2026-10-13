# Brightdata Research — Canonical Claims

These are verified facts. Only make claims that appear in this list.

- BrightData tools return large nested JSON objects — always extract and summarize key fields rather than dumping raw responses to the user.
- For Amazon product lookup, use web_data_amazon_product with a 10-character ASIN — do not pass full Amazon URLs.
- For Amazon search/discovery, use web_data_amazon_product_search with keyword terms — this returns ranked organic and sponsored results.
- For review analysis, use web_data_amazon_product_reviews — extract rating distribution, common themes, verified purchase ratio, and recurring customer language for keyword ideas.
- BrightData search results contain both organic_results and sponsored_results — always distinguish between them when reporting rankings.
- From a product response, the priority fields to extract are: title, bullet_points, price, bsr (best seller rank), rating, rating_count, images count, a_plus_content presence, and category.
- From search results, extract: top 10 organic positions (ASIN, title, price, rating, review_count), sponsored slot count and positions, and total result count.
- Cross-marketplace tools (walmart, ebay, bestbuy, etsy, homedepot, google_shopping) use the same response parsing pattern — extract price, availability, seller, and product title for comparison.
- Use scrape_as_markdown (not scrape_as_html) as the default for web scraping — it produces cleaner, more readable output. Only use scrape_as_html when you need to inspect page structure or image URLs.
- Use scrape_batch for bulk operations (e.g., scraping top 10 competitor listings) instead of making individual scrape calls.
- Use search_engine_batch for bulk keyword research instead of individual search_engine calls.
- Always check session_stats before large batch operations to monitor usage and avoid hitting rate limits.
- When BrightData returns empty results, check: (1) is the ASIN/URL correctly formatted, (2) is the marketplace code correct, (3) is the product actually available in that marketplace.
- Never retry the exact same BrightData request more than once — if it fails, adjust the input (different format, different marketplace) or inform the user of the limitation.
- Multi-tool workflows should follow a discovery-then-detail pattern: search first to identify targets, then fetch detailed data for each target.
- When conducting competitive analysis, always search for the keyword first, extract the top organic ASINs, then fetch product details for each — do not skip the search step.
- Store research results in Supabase using execute_sql when conducting multi-step workflows so intermediate data is preserved across tool calls.
- The BrightData tools are served from the brightdata-for-amazon MCP server — all Amazon, cross-marketplace, and web scraping tools come from this single server.
