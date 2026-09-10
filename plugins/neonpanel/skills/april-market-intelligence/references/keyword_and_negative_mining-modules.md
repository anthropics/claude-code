# Keyword And Negative Mining — Module Map

## search-term-analysis

Analyzing Amazon search term reports to identify performing and non-performing search terms. Covers how to read the report, key metrics (impressions, clicks, spend, sales, ACoS per term), and how to categorize terms for action.

**Common user intents:**
- Analyze my search term report
- Which search terms are wasting money?
- Which terms should I promote to exact match?
- Show me my best performing search terms

**Common confusions:**
- Looking at too short a date range (need 7-14 days minimum for significance)
- Negating terms based on a single day of data
- Not distinguishing between keyword-targeted and ASIN-targeted search terms
- Ignoring low-impression high-converting terms

**Artifacts to request:**
- Search term report (CSV or data)
- Date range
- Target ACoS threshold

**Key objects:** Search term report, Customer search term, Impressions, Clicks, Spend, Sales, ACoS per term, Click-through rate, Conversion rate, High-spend zero-sale terms

## negative-keyword-mining

Identifying and adding negative keywords to prevent wasted ad spend. Covers negative exact vs negative phrase, when to negate, threshold-based decision rules, and maintaining a negative keyword list across campaigns.

**Common user intents:**
- Find negative keywords from my search terms
- How do I decide what to negate?
- Should I use negative exact or negative phrase?
- Build a negative keyword list for my campaigns

**Common confusions:**
- Using negative phrase when negative exact is safer (phrase can block good terms)
- Negating a term that's actually converting in another campaign
- Not checking cross-campaign impact before adding negatives
- Setting thresholds too aggressive (negating after only 5 clicks)

**Artifacts to request:**
- Search term report
- Current negative keyword list
- Spend/click thresholds for negation

**Key objects:** Negative exact match, Negative phrase match, Negative keyword list, Campaign-level negatives, Ad group-level negatives, Spend threshold for negation, Click threshold for negation, Irrelevant term identification

## keyword-harvesting

The process of discovering new profitable keywords from automatic campaigns, broad match campaigns, and competitor research, then graduating them to manual exact/phrase campaigns with optimized bids.

**Common user intents:**
- How do I find new keywords?
- When should I move a keyword to exact match?
- What's the keyword harvesting process?
- How often should I harvest keywords?

**Common confusions:**
- Graduating keywords too early (before enough conversion data)
- Not negating harvested keywords in the source campaign (causes self-competition)
- Only harvesting from auto campaigns, ignoring broad match discoveries
- Not setting different bids for graduated keywords vs source campaign

**Artifacts to request:**
- Auto campaign search term report
- Broad match campaign search term report
- Graduation thresholds (min orders, min conversion rate)

**Key objects:** Auto campaign, Broad match discovery, Keyword graduation, Exact match promotion, Phrase match promotion, Harvesting cadence, Performance threshold for graduation, Keyword funnel (auto → broad → exact)

## match-type-strategy

Understanding and deploying Amazon's keyword match types: broad, phrase, exact, and negative variants. Covers when to use each, how Amazon's matching algorithm works, and strategies for layered match type campaigns.

**Common user intents:**
- What match type should I use?
- How does broad match work on Amazon?
- Should I run separate campaigns per match type?
- What are close variants?

**Common confusions:**
- Amazon broad match is much broader than Google broad match
- Exact match on Amazon still matches close variants and plurals
- Running all match types in one ad group without bid differentiation
- Not understanding that phrase match requires words in order

**Artifacts to request:**
- Current keyword list with match types
- Campaign structure

**Key objects:** Broad match, Phrase match, Exact match, Broad match modifier (deprecated), Close variant matching, Match type layering, Single keyword ad groups (SKAGs)

## competitor-keyword-intelligence

Using competitor research to discover keyword opportunities: reverse ASIN lookup concepts, analyzing competitor ad placements, identifying gaps in competitor keyword coverage, and using BrightData tools for SERP analysis.

**Common user intents:**
- What keywords are my competitors targeting?
- Find keyword gaps vs competitors
- Which keywords do competitors rank for that I don't?
- Monitor competitor ad placements

**Common confusions:**
- Reverse ASIN tools show organic ranking, not necessarily PPC targeting
- Competitor keyword lists need validation — not all terms are profitable
- High competitor spend doesn't mean the keyword is right for your product
- SERP position changes daily — need trend data, not snapshots

**Artifacts to request:**
- Competitor ASINs
- Your current keyword list
- Target marketplace

**Key objects:** Reverse ASIN lookup, Competitor keyword overlap, Keyword gap analysis, SERP position tracking, Competitor ad placement monitoring, Share of voice
