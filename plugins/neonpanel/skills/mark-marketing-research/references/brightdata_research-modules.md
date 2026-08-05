# Brightdata Research — Module Map

## tool-selection-decision-tree

Decision framework for choosing the right BrightData tool based on user intent. Covers when to use product lookup vs search vs reviews vs cross-marketplace tools, and how to chain tools for complex research workflows.

**Common user intents:**
- Which tool should I use for this research?
- How do I look up a specific product?
- How do I search for competitors?
- What's the difference between product lookup and search?

**Common confusions:**
- Using product search when they have a specific ASIN (should use product lookup)
- Using product lookup when they want to discover competitors (should use search)
- Not knowing that cross-marketplace tools exist for price comparison
- Using scrape_as_html when scrape_as_markdown would be more readable

**Artifacts to request:**
- ASIN or product URL
- Search keywords
- Target marketplace

**Key objects:** web_data_amazon_product, web_data_amazon_product_reviews, web_data_amazon_product_search, web_data_walmart_product, web_data_ebay_product, web_data_bestbuy_products, web_data_google_shopping, scrape_as_markdown, scrape_as_html, scrape_batch, search_engine, search_engine_batch, Tool selection decision tree

## input-preparation

How to correctly format inputs for each BrightData tool: ASIN formatting, search term construction, marketplace codes, URL formatting, and batch request preparation.

**Common user intents:**
- How do I format the ASIN for lookup?
- What marketplace code should I use?
- How do I search for multiple keywords at once?
- How do I scrape multiple URLs in one call?

**Common confusions:**
- Passing a full Amazon URL instead of just the ASIN to product lookup
- Not specifying the marketplace and defaulting to the wrong one
- Using overly broad search terms that return irrelevant results
- Not URL-encoding special characters in search terms

**Artifacts to request:**
- Product ASIN or URL
- Target marketplace
- Search keywords or terms

**Key objects:** ASIN format (10-character alphanumeric), Marketplace codes (US, UK, DE, JP, etc.), Search term formatting, URL construction for scraping, Batch request arrays

## response-parsing-extraction

How to parse and summarize the large nested JSON responses from BrightData tools. Covers which fields to extract from product data, search results, and review data, and how to present findings concisely to the user.

**Common user intents:**
- What are the key fields in a product response?
- How do I summarize search results?
- What should I extract from reviews?
- How do I compare products from the response data?

**Common confusions:**
- Trying to dump the entire raw response to the user instead of summarizing
- Missing important nested fields like BSR category rankings
- Not distinguishing organic vs sponsored results in search data
- Ignoring review metadata (verified purchase, helpful votes) when analyzing sentiment

**Key objects:** Product response fields (title, bullets, price, BSR, rating, rating_count, images, a_plus_content), Search result fields (organic_results, sponsored_results, position, click_share), Review response fields (rating, text, verified_purchase, date, helpful_votes), Cross-marketplace response fields (price, availability, seller, condition), Nested JSON navigation, Summary templates

## multi-tool-workflows

Chained research workflows that combine multiple BrightData tools for comprehensive analysis. Covers competitive analysis, listing audit data collection, keyword validation, cross-marketplace comparison, and review mining workflows.

**Common user intents:**
- Do a full competitive analysis for this product
- Research the top competitors for this keyword
- Compare this product across marketplaces
- Mine reviews for keyword ideas
- Gather all the data I need for a listing audit

**Common confusions:**
- Running tools in the wrong order (e.g., fetching product details before knowing which ASINs to fetch)
- Not aggregating data across multiple tool calls into a coherent summary
- Trying to do everything in one tool call instead of chaining
- Forgetting to store intermediate results for later reference

**Artifacts to request:**
- Target ASIN or keyword
- Research objective (competitive analysis, audit, keyword research, etc.)
- Target marketplace(s)

**Key objects:** Competitive analysis workflow, Listing audit data collection workflow, Keyword validation workflow, Cross-marketplace comparison workflow, Review mining workflow, Workflow sequencing, Data aggregation across tools

## failure-handling-rate-limits

Handling BrightData tool failures: empty results, rate limits, partial data, timeout errors, and invalid input errors. Includes retry strategies, fallback approaches, and how to communicate limitations to the user.

**Common user intents:**
- The tool returned empty results
- I'm getting rate limited
- The response seems incomplete
- Why did the scrape fail?
- How do I check my usage?

**Common confusions:**
- Retrying the exact same request expecting different results
- Not checking session_stats when hitting rate limits
- Assuming empty results means the product doesn't exist (could be marketplace or format issue)
- Not telling the user about partial data limitations

**Artifacts to request:**
- Error message or response received
- Tool and parameters used

**Key objects:** Empty result handling, Rate limit detection, Partial data recovery, Timeout errors, Invalid input errors, Retry strategy, Fallback approaches, session_stats tool
