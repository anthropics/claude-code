# Keyword Search Intelligence — Module Map

## sqp-interpretation

Interpreting Amazon's Search Query Performance (SQP) dashboard: understanding impression share, click share, purchase share, and conversion share at the query level. SQP reveals how your products perform relative to the total market for each search query.

**Common user intents:**
- How do I read the SQP dashboard?
- What's my impression share for this keyword?
- Where am I losing in the funnel?
- Which queries have the best purchase share?

**Common confusions:**
- Confusing SQP impression share with PPC impression share (SQP includes organic)
- Not understanding that low click share with high impression share = listing problem
- Looking at SQP data for too short a period (need 4+ weeks)
- Ignoring the funnel drop-off between click share and purchase share

**Artifacts to request:**
- SQP dashboard export
- Target keywords
- Date range (minimum 4 weeks)

**Key objects:** Search Query Performance dashboard, Impression share, Click share, Purchase share, Conversion share, Query-level funnel, Total query volume, Brand vs category queries

## scp-analysis

Using Amazon's Search Catalog Performance (SCP) report to understand how your catalog performs across search queries. SCP shows which of your ASINs appear for which queries, enabling portfolio-level search strategy.

**Common user intents:**
- Which of my products show for which keywords?
- Are my products cannibalizing each other?
- Where are gaps in my catalog coverage?
- How do I use SCP data?

**Common confusions:**
- Not connecting SCP data to PPC targeting decisions
- Ignoring cannibalization signals (multiple ASINs competing for same query)
- Using SCP in isolation without cross-referencing SQP
- Not updating PPC strategy based on catalog coverage gaps

**Artifacts to request:**
- SCP report export
- ASIN catalog list
- Current PPC keyword targets

**Key objects:** Search Catalog Performance report, ASIN-to-query mapping, Catalog coverage, Query-ASIN performance matrix, Catalog gaps, Cross-ASIN cannibalization

## query-funnel-diagnostics

Diagnosing performance at each stage of the search query funnel: impressions → clicks → add-to-cart → purchases. Identifying where drop-offs occur and what levers to pull at each stage (PPC bids for impressions, listing quality for clicks, pricing/reviews for conversion).

**Common user intents:**
- Where am I losing customers in the funnel?
- Why do I get impressions but no clicks?
- Why do I get clicks but no sales?
- How do I diagnose my conversion funnel?

**Common confusions:**
- Blaming PPC for low conversions when the issue is listing quality
- Increasing bids to fix a CTR problem (bids drive impressions, not clicks)
- Not segmenting funnel analysis by keyword (different keywords have different funnels)
- Ignoring add-to-cart rate as a diagnostic signal

**Artifacts to request:**
- SQP data with funnel metrics
- Listing detail page data
- Keyword-level performance data

**Key objects:** Impression stage, Click stage, Add-to-cart stage, Purchase stage, Funnel drop-off rate, Stage-specific levers, CTR diagnosis, CVR diagnosis

## keyword-clustering-intent

Grouping keywords by search intent and semantic similarity: informational vs transactional vs navigational intent, clustering related terms for campaign structure, and mapping keyword clusters to product features and use cases.

**Common user intents:**
- How do I group my keywords?
- What's the intent behind this search term?
- How do I organize keywords into clusters?
- Which keyword clusters should I prioritize?

**Common confusions:**
- Treating all keywords the same regardless of intent
- Creating too many clusters (over-segmentation)
- Not recognizing that the same keyword can have multiple intents
- Ignoring long-tail clusters that have lower volume but higher conversion

**Artifacts to request:**
- Full keyword list
- Search term report
- Product feature list

**Key objects:** Keyword cluster, Search intent (informational, transactional, navigational), Semantic grouping, Intent mapping, Cluster-to-campaign mapping, Long-tail vs head terms, Feature-based clusters

## share-of-voice-modeling

Measuring and modeling share of voice (SOV): calculating your visibility relative to competitors across target keywords, tracking SOV trends over time, and using SOV as a leading indicator of market share changes.

**Common user intents:**
- What's my share of voice?
- How do I track SOV over time?
- Am I gaining or losing visibility?
- What SOV do I need to hit my revenue target?

**Common confusions:**
- Confusing SOV with impression share (SOV includes organic + paid)
- Not weighting SOV by keyword value (high-volume keywords matter more)
- Measuring SOV as a snapshot instead of a trend
- Assuming SOV directly equals market share (conversion rates vary)

**Artifacts to request:**
- Keyword rank tracking data
- SQP impression share data
- Competitor visibility data

**Key objects:** Share of voice (SOV), SOV by keyword, SOV trend, Competitor SOV, SOV-to-market-share correlation, Visibility score, SOV target

## brand-generic-competitor-strategy

Segmenting keyword strategy into three tiers: Brand (own brand terms — defend and convert), Generic (category terms — acquire new customers), and Competitor (rival brand terms — conquest and steal share). Each tier has different bid logic, budget allocation, and success metrics.

**Common user intents:**
- How do I split brand vs generic vs competitor keywords?
- Should I bid on competitor brand names?
- How much should I spend on brand defense?
- What ACoS target for each keyword tier?

**Common confusions:**
- Not bidding on own brand terms (competitors will)
- Setting the same ACoS target for brand and generic (brand should be much lower)
- Spending too much on competitor terms with low conversion
- Not separating brand campaigns from generic for accurate measurement

**Artifacts to request:**
- Keyword list categorized by tier
- Brand term list
- Competitor brand names
- Current campaign structure

**Key objects:** Brand keywords, Generic keywords, Competitor keywords, Brand defense campaign, Generic acquisition campaign, Competitor conquest campaign, Tier-specific ACoS targets, Budget allocation by tier
