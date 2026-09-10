# Competitive Intelligence Market Pressure — Module Map

## auction-pressure-modeling

Understanding and modeling Amazon's ad auction dynamics: how CPC is determined, what drives auction pressure up or down, identifying when competition intensifies, and predicting CPC trends based on market signals.

**Common user intents:**
- Why are my CPCs increasing?
- How does the Amazon auction work?
- Is competition getting more intense?
- How do I predict CPC trends?

**Common confusions:**
- Thinking highest bid always wins (relevance and CTR matter)
- Not distinguishing between seasonal CPC spikes and structural increases
- Assuming CPC increases mean you should increase bids (sometimes you should shift keywords)
- Ignoring quality score equivalent factors in Amazon's auction

**Artifacts to request:**
- CPC trend data (3-6 months)
- Keyword-level CPC history
- Category benchmark data

**Key objects:** Second-price auction, CPC determination, Auction pressure index, Bid density, Competitor entry signals, CPC trend analysis, Auction competitiveness score

## competitor-bid-detection

Detecting and responding to competitor bid aggression: identifying when competitors increase spend on your keywords, recognizing conquest campaigns targeting your brand, and developing counter-strategies.

**Common user intents:**
- Is a competitor targeting my keywords?
- Why did my impression share drop?
- How do I detect competitor aggression?
- What should I do when a competitor attacks?

**Common confusions:**
- Assuming all impression share loss is from competitor aggression (could be budget or relevance)
- Engaging in bid wars without calculating profitability ceiling
- Not monitoring brand term CPCs as an early warning signal
- Overreacting to short-term competitive moves

**Artifacts to request:**
- Impression share trend
- Brand term CPC history
- Competitor ASIN list
- SERP position data

**Key objects:** Competitor bid aggression, Brand term defense, Conquest detection, Impression share loss, Position displacement, Counter-bid strategy, Competitive response playbook

## category-saturation-signals

Identifying when a category is becoming saturated: rising CPCs with flat conversion rates, increasing number of advertisers, declining organic opportunity, and signals that indicate diminishing returns from PPC investment.

**Common user intents:**
- Is my category getting saturated?
- Are there too many advertisers?
- Should I shift to a different category?
- What are the signs of saturation?

**Common confusions:**
- Confusing seasonal competition spikes with permanent saturation
- Not recognizing that saturation affects different price points differently
- Assuming saturation means you should exit (sometimes it means differentiate)
- Ignoring sub-category or niche opportunities within saturated categories

**Artifacts to request:**
- Category CPC trends
- Number of sponsored results over time
- Category conversion rate trends

**Key objects:** Category saturation index, Advertiser density, CPC-to-CVR ratio, Organic opportunity score, Market maturity signals, Diminishing returns threshold, Category lifecycle stage

## share-of-voice-tracking

Systematically tracking share of voice across target keywords: measuring visibility (organic + paid), tracking changes over time, benchmarking against competitors, and using SOV as a leading indicator of revenue trends.

**Common user intents:**
- Track my share of voice
- How visible am I vs competitors?
- Is my SOV improving?
- What SOV do I need for my revenue target?

**Common confusions:**
- Only tracking paid SOV and ignoring organic
- Not weighting SOV by keyword search volume
- Measuring SOV monthly when weekly tracking catches trends faster
- Assuming equal SOV across keywords (some keywords matter more than others)

**Artifacts to request:**
- Keyword rank data (organic + paid)
- Search volume estimates
- Competitor visibility data

**Key objects:** Share of voice (SOV), Visibility tracking, SOV benchmark, Competitor SOV comparison, SOV trend analysis, SOV-to-revenue correlation, Keyword-level SOV

## defensive-ppc-modeling

Building defensive PPC strategies: protecting brand terms, maintaining position on critical keywords, calculating the cost of defense vs the cost of losing position, and creating automated defense triggers.

**Common user intents:**
- How much should I spend on defense?
- Which keywords must I defend?
- What's the cost of losing my position?
- How do I automate brand defense?

**Common confusions:**
- Defending every keyword equally (prioritize by revenue impact)
- Not calculating the revenue at risk when deciding defense budget
- Over-defending low-value keywords while under-defending critical ones
- Treating defense as optional (competitors will take your position)

**Artifacts to request:**
- Brand term performance data
- Revenue by keyword
- Current defense spend
- Competitor activity on brand terms

**Key objects:** Brand defense budget, Position defense cost, Defense trigger, Critical keyword list, Defense ROI calculation, Minimum defense spend, Automated defense rules

## market-entry-analysis

Analyzing market entry opportunities through a PPC lens: estimating required ad investment to enter a category, modeling time-to-profitability, assessing competitive barriers, and determining if the PPC economics support entry.

**Common user intents:**
- How much PPC budget do I need to enter this category?
- Can I compete in this market?
- How long until PPC is profitable in a new category?
- What are the barriers to entry?

**Common confusions:**
- Underestimating entry costs (first 3-6 months are investment phase)
- Not accounting for the review disadvantage of new products
- Assuming current category CPCs will stay stable after your entry
- Ignoring that market entry requires inventory + PPC + listing investment simultaneously

**Artifacts to request:**
- Target category data
- CPC benchmarks
- Competitor review counts
- Available budget for entry

**Key objects:** Market entry cost model, Time-to-profitability estimate, Competitive barrier assessment, Required ad investment, Entry CPC benchmark, Break-even timeline, Market entry scorecard
