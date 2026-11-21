# Keyword And Negative Mining — Playbook

# Keyword & Negative Mining Playbooks

## Analyze Search Term Report

1. Export search term report for the target date range (minimum 7 days, ideally 14-30 days).
2. Sort by spend (highest first) to identify biggest cost drivers.
3. For each high-spend term, calculate:
   - ACoS (spend / sales)
   - Conversion rate (orders / clicks)
   - Cost per acquisition (spend / orders)
4. Categorize each term:
   - **🟢 Promote**: ACoS < target, 2+ conversions → graduate to exact match.
   - **🔴 Negate**: 15+ clicks, 0 conversions → add as negative.
   - **🟡 Monitor**: 5-14 clicks, 0 conversions → watch for another week.
   - **⚪ Ignore**: <5 clicks → insufficient data, no action.
5. Flag high-spend zero-sale terms (top 10 by spend) for immediate negation review.
6. Identify search terms that appear across multiple campaigns — check for self-competition.
7. Summarize: X terms to promote, Y terms to negate, Z terms to monitor.

## Execute Negative Keyword Mining

1. Pull the "negate" list from search term analysis.
2. For each term, determine negative match type:
   - **Negative exact**: Use when only this specific term is irrelevant (e.g., "blue widget case" when you sell red widgets).
   - **Negative phrase**: Use when any query containing this phrase is irrelevant (e.g., "wholesale" if you're retail-only).
3. Before adding, check cross-campaign impact:
   - Search for the term across ALL campaigns.
   - If it converts in Campaign B but wastes in Campaign A → add negative only to Campaign A.
   - If it wastes everywhere → add as account-level or portfolio-level negative.
4. Add negatives at the appropriate level:
   - **Ad group level**: When only specific ad groups are affected.
   - **Campaign level**: When the entire campaign shouldn't show for this term.
5. Document all negatives added (term, match type, level, date, reason).
6. Review negative keyword list monthly — remove negatives that may have become relevant due to product changes.

## Harvest Keywords from Auto/Broad Campaigns

1. Pull search term report from auto and broad match campaigns (14-30 day window).
2. Filter for converting terms meeting graduation threshold:
   - Minimum 2 orders (ideally 3+).
   - Conversion rate > campaign average.
   - ACoS within 1.5x of target.
3. For each graduating term:
   - Create exact match keyword in the manual exact campaign.
   - Set bid based on historical ACoS: bid = (target ACoS × average sale price) / 100.
   - Add the term as negative exact in the source auto/broad campaign.
4. For terms with good clicks but borderline conversions:
   - Graduate to phrase match (broader net) instead of exact.
   - Monitor for 2 weeks before deciding to promote to exact or negate.
5. Log all graduated keywords: term, source campaign, destination campaign, bid, date.
6. Schedule next harvest: every 7 days for high-spend campaigns, every 14 days for low-spend.

## Competitor Keyword Gap Analysis

1. Identify top 3-5 competitor ASINs (from category research or user input).
2. Use BrightData `web_data_amazon_product_search` to search your top 5 keywords — note which competitors appear in top 10.
3. Use BrightData `web_data_amazon_product` to scrape competitor listings — extract title keywords, bullet keywords, backend keyword indicators.
4. Cross-reference competitor keywords with your current keyword list.
5. Identify gaps: keywords competitors rank for that you don't target.
6. Prioritize gaps by:
   - **High priority**: High relevance to your product + competitor ranks top 5.
   - **Medium priority**: Moderate relevance + competitor ranks top 10.
   - **Low priority**: Tangential relevance or competitor ranks below top 10.
7. For high-priority gaps: Add to manual broad match campaign for testing.
8. For medium-priority gaps: Add to auto campaign targeting or broad match with lower bids.
9. Review gap keyword performance after 14 days — graduate winners, negate losers.

## Match Type Strategy Setup

1. Assess campaign maturity:
   - **New product (0-3 months)**: Heavy on auto + broad for discovery. Exact match only for obvious high-intent terms.
   - **Growth phase (3-12 months)**: Balanced — broad for ongoing discovery, exact for proven winners, phrase for mid-funnel.
   - **Mature product (12+ months)**: Exact-heavy for efficiency, broad at low budget for new term discovery.
2. Set up match type layering:
   - Auto campaign: Discovery engine, lowest bids.
   - Broad match campaign: Expanded discovery, moderate bids.
   - Phrase match campaign: Mid-funnel, moderate-high bids.
   - Exact match campaign: Proven winners, highest bids.
3. Ensure negative keyword flow: graduated terms are negated in source campaigns.
4. Set bid ratios across match types (example):
   - Auto: $0.50 (baseline)
   - Broad: $0.65 (1.3x auto)
   - Phrase: $0.80 (1.6x auto)
   - Exact: $1.00 (2x auto)
5. Review match type distribution monthly — if exact match campaigns drive >70% of revenue, broad/auto budgets can be reduced.