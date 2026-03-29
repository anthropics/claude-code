# Financial Modeling Frameworks & Methods

## Overview

Financial modeling translates product strategy into business impact. It enables informed investment decisions, validates business viability, and tracks value creation. This pack covers the major frameworks for market sizing, unit economics, revenue modeling, and scenario planning. Reference this when building business cases, pricing models, revenue forecasts, or any deliverable requiring financial analysis.

## Frameworks

### TAM/SAM/SOM

**When to use**: When you need to estimate the total market opportunity for a product or market entry decision. Required for business cases, investor decks, and strategic planning.

**How it works**:
- **TAM (Total Addressable Market)**: The total revenue opportunity if you captured 100% of the market. This is the theoretical ceiling.
- **SAM (Serviceable Addressable Market)**: The portion of TAM you can realistically reach with your product, geography, and business model.
- **SOM (Serviceable Obtainable Market)**: The portion of SAM you can realistically capture in the near term (1-3 years), given competition, resources, and execution capability.

**Two approaches**:

**Top-down**: Start with industry reports and analyst data, then narrow.
```
TAM = Total industry revenue for the category
SAM = TAM x % that matches your segment/geography/model
SOM = SAM x realistic market share (typically 1-10% for new entrants)
```

**Bottom-up**: Start with your specific customers and build up.
```
SOM = [Number of reachable target customers] x [Expected revenue per customer]
SAM = [Total matching customers in reachable segments] x [Revenue per customer]
TAM = [All potential customers regardless of reach] x [Revenue per customer]
```

**Template**:

| Level | Calculation Method | Estimate | Assumptions |
|-------|-------------------|----------|-------------|
| TAM | [Industry reports / total potential customers x ARPU] | $[X]M | [Key assumptions] |
| SAM | [TAM filtered by segment, geography, model fit] | $[X]M | [Filtering criteria] |
| SOM | [SAM x realistic capture rate] | $[X]M | [Capture rate rationale] |

**Validation checklist**:
- [ ] Both top-down and bottom-up approaches used (they should converge)
- [ ] Assumptions are explicit and testable
- [ ] Market growth rate included (is this market growing?)
- [ ] Competitor market share accounted for
- [ ] Time horizon specified

**Limitations**: TAM is often inflated. Bottom-up is more reliable than top-down for planning purposes. "Total market" includes customers who will never buy your product. Focus on SOM for actionable planning.

---

### Unit Economics

**When to use**: When you need to understand the profitability of each customer relationship and whether your business model is viable at scale.

**Key metrics**:

| Metric | Formula | What It Tells You |
|--------|---------|-------------------|
| **LTV (Lifetime Value)** | ARPU x Gross Margin x (1 / Churn Rate) | Total value of an average customer relationship |
| **CAC (Customer Acquisition Cost)** | Total Sales + Marketing Spend / New Customers | Cost to acquire one customer |
| **LTV:CAC Ratio** | LTV / CAC | Return on acquisition investment |
| **Payback Period** | CAC / (ARPU x Gross Margin) | Months to recoup acquisition cost |
| **ARPU** | Total Revenue / Total Customers | Average revenue per user/account |
| **Gross Margin** | (Revenue - COGS) / Revenue | % of revenue after direct costs |
| **Contribution Margin** | (Revenue - COGS - Variable Costs) / Revenue | % after all variable costs |

**Healthy benchmarks by business model**:

| Metric | SaaS | Marketplace | E-commerce |
|--------|------|-------------|------------|
| LTV:CAC | > 3:1 | > 3:1 | > 3:1 |
| Payback Period | < 12 months | < 6 months | < 3 months |
| Gross Margin | 70-85% | 50-70% | 30-50% |
| Net Revenue Retention | > 110% | Varies | N/A |
| Churn (monthly) | < 2% (SMB), < 1% (Enterprise) | < 5% | Varies |

**Unit economics template**:

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| ARPU (monthly) | $[X] | $[Y] | |
| Gross Margin | [X]% | [Y]% | |
| Monthly Churn | [X]% | [Y]% | |
| LTV | $[X] | $[Y] | |
| CAC | $[X] | $[Y] | |
| LTV:CAC | [X]:1 | [Y]:1 | |
| Payback Period | [X] months | [Y] months | |

**Limitations**: LTV calculations require stable churn data (unreliable for new products). CAC attribution is imprecise (which spend caused which customer?). Blended metrics can hide segment differences -- always segment LTV and CAC by customer type.

---

### LTV/CAC Analysis

**When to use**: When evaluating investment efficiency in customer acquisition, comparing acquisition channels, or justifying marketing/sales spend.

**LTV calculation methods**:

**Simple LTV**:
```
LTV = ARPU x Gross Margin x Average Customer Lifetime
Average Lifetime = 1 / Monthly Churn Rate (in months)
```

**Cohort-based LTV** (more accurate):
Track actual revenue from customer cohorts over time. Accounts for expansion revenue and non-linear churn.

| Cohort | Month 1 | Month 3 | Month 6 | Month 12 | Month 24 |
|--------|---------|---------|---------|----------|----------|
| Jan 2025 | $100 | $95 | $88 | $110 | $125 |
| Apr 2025 | $100 | $98 | $92 | $118 | -- |

**CAC by channel**:

| Channel | Spend | Customers Acquired | CAC | LTV:CAC |
|---------|-------|--------------------|-----|---------|
| Organic/SEO | $[X]/mo | [N] | $[X] | [X]:1 |
| Paid search | $[X]/mo | [N] | $[X] | [X]:1 |
| Outbound sales | $[X]/mo | [N] | $[X] | [X]:1 |
| Referral | $[X]/mo | [N] | $[X] | [X]:1 |
| Events | $[X]/mo | [N] | $[X] | [X]:1 |

**Decision rules**:
- LTV:CAC > 3:1: Healthy. Consider investing more in this channel.
- LTV:CAC 1:1 to 3:1: Marginal. Improve efficiency or reduce spend.
- LTV:CAC < 1:1: Unprofitable. Fix before scaling.

**Payback period interpretation**:
- < 6 months: Strong capital efficiency
- 6-12 months: Acceptable for most SaaS
- 12-18 months: Acceptable for enterprise/high-ACV
- > 18 months: Cash flow concern -- requires significant upfront capital

**Limitations**: LTV is backward-looking by nature. Attributing customers to channels is imprecise (multi-touch attribution). Blended LTV:CAC can mask channel-level problems.

---

### Revenue Modeling

**When to use**: When you need to forecast revenue for business planning, budgeting, fundraising, or strategic decision-making.

**SaaS revenue model components**:

| Metric | Formula |
|--------|---------|
| **MRR (Monthly Recurring Revenue)** | Sum of all active subscription revenue |
| **ARR (Annual Recurring Revenue)** | MRR x 12 |
| **New MRR** | MRR from new customers this month |
| **Expansion MRR** | Additional MRR from existing customers (upsell, add-ons) |
| **Churned MRR** | MRR lost from cancellations |
| **Net New MRR** | New MRR + Expansion MRR - Churned MRR |
| **Net Revenue Retention (NRR)** | (Starting MRR + Expansion - Churn) / Starting MRR |

**SaaS revenue forecast template**:

| Month | Starting MRR | + New | + Expansion | - Churn | = Ending MRR | ARR |
|-------|-------------|-------|-------------|---------|-------------|-----|
| M1 | $[X] | $[X] | $[X] | $[X] | $[X] | $[X] |
| M2 | [from M1] | $[X] | $[X] | $[X] | $[X] | $[X] |
| ... | | | | | | |
| M12 | | | | | | |

**Key input assumptions to make explicit**:
- New customer acquisition rate (per month)
- Average starting ARPU
- Monthly churn rate (logo and revenue)
- Expansion rate (% of customers who expand, and by how much)
- Seasonality factors

**Marketplace revenue model components**:

| Metric | Formula |
|--------|---------|
| **GMV (Gross Merchandise Value)** | Total value of transactions on the platform |
| **Take Rate** | Platform fee as % of GMV |
| **Revenue** | GMV x Take Rate |
| **Transactions** | Number of completed transactions |
| **Average Order Value (AOV)** | GMV / Transactions |

**Limitations**: Revenue models are projections, not predictions. All forecasts are wrong; the question is how useful they are. Make assumptions explicit so the model can be updated as reality unfolds.

---

### Break-even Analysis

**When to use**: When you need to determine the point at which revenue covers all costs, particularly for new product launches or pricing changes.

**How it works**:
- **Fixed costs**: Costs that don't change with volume (rent, salaries, infrastructure base)
- **Variable costs**: Costs that scale with each unit/customer (hosting per customer, support per customer, payment processing)
- **Contribution margin**: Revenue per unit minus variable cost per unit
- **Break-even point**: Fixed Costs / Contribution Margin per Unit

**Template**:

| Component | Monthly Amount |
|-----------|---------------|
| **Fixed Costs** | |
| Engineering team | $[X] |
| Infrastructure (base) | $[X] |
| Office/admin | $[X] |
| **Total Fixed Costs** | **$[X]** |
| | |
| **Per-Customer Variable Costs** | |
| Hosting (marginal) | $[X] |
| Support (allocated) | $[X] |
| Payment processing | $[X] |
| **Total Variable per Customer** | **$[X]** |
| | |
| **Revenue per Customer** | $[X] |
| **Contribution Margin per Customer** | $[X] |
| **Break-even Customers** | [Fixed / Contribution Margin] |

**Time-to-breakeven**: How many months until cumulative revenue exceeds cumulative costs (including one-time costs like development).

**Limitations**: Fixed and variable cost categories can be blurry (is a support team that scales in steps fixed or variable?). Break-even analysis assumes linear relationships which may not hold. It does not account for the time value of money.

---

### Scenario Planning

**When to use**: When facing significant uncertainty and you need to evaluate outcomes across a range of assumptions. Essential for strategic bets, market entry decisions, and fundraising.

**How it works**: Rather than a single forecast, build three scenarios that represent different assumption sets:

**Bull case** (optimistic): Things go better than expected. Higher growth, faster adoption, better unit economics.

**Base case** (expected): Your best estimate of likely performance. This is the plan you execute against.

**Bear case** (pessimistic): Things go worse than expected. Slower growth, higher churn, longer sales cycles.

**Sensitivity analysis**: Identify the 3-5 variables that most impact your model (e.g., churn rate, conversion rate, ARPU). Vary each independently and measure the impact on key outputs.

**Template**:

| Variable | Bear | Base | Bull |
|----------|------|------|------|
| Monthly new customers | [X] | [Y] | [Z] |
| ARPU | $[X] | $[Y] | $[Z] |
| Monthly churn | [X]% | [Y]% | [Z]% |
| Expansion rate | [X]% | [Y]% | [Z]% |
| CAC | $[X] | $[Y] | $[Z] |

**Resulting forecasts**:

| Metric (Month 12) | Bear | Base | Bull |
|--------------------|------|------|------|
| ARR | $[X] | $[Y] | $[Z] |
| Customers | [X] | [Y] | [Z] |
| LTV:CAC | [X]:1 | [Y]:1 | [Z]:1 |
| Cash runway (months) | [X] | [Y] | [Z] |
| Break-even month | [X] | [Y] | [Z] |

**Sensitivity table** (vary one input, hold others at base):

| Churn Rate | ARR Impact | LTV:CAC Impact |
|------------|-----------|----------------|
| 1% (base - 50%) | +$[X]K | +[X] |
| 2% (base) | $[base] | [base] |
| 3% (base + 50%) | -$[X]K | -[X] |
| 5% (stress test) | -$[X]K | -[X] |

**Monte Carlo basics**: For sophisticated analysis, assign probability distributions to each uncertain variable and run thousands of simulations. The output is a probability distribution of outcomes rather than three point estimates. Tools: Excel with add-ins, Python (numpy/scipy), or specialized financial modeling software.

**Limitations**: Scenarios are not predictions. The true outcome may fall outside all three cases. Garbage in, garbage out -- the quality depends on the quality of assumptions. Scenario planning is most valuable for the thinking process it forces, not the specific numbers it produces.

## Selection Guide

| Situation | Recommended Framework | Why |
|-----------|----------------------|-----|
| Market entry decision | TAM/SAM/SOM + Scenario Planning | Understand opportunity size and risk range |
| Business model viability | Unit Economics + Break-even | Know if the math works |
| Acquisition channel decisions | LTV/CAC by Channel | Invest in efficient channels |
| Revenue forecasting | Revenue Model + Scenarios | Plan with explicit assumptions |
| Investment/fundraising | All of the above | Comprehensive financial picture |
| Pricing decision support | Unit Economics + Sensitivity | Understand pricing impact on margins |
| Go/no-go on a strategic bet | Scenario Planning + Break-even | Decision under uncertainty |

## Sources

- David Skok, "SaaS Metrics 2.0" (forentrepreneurs.com, 2015) -- SaaS metric definitions and benchmarks
- Bill Gurley, "The Dangerous Seduction of the LTV Formula" (2012) -- Limitations of LTV calculations
- Jason Lemkin, SaaStr resources (2013-present) -- SaaS benchmarks and financial modeling
- Alexander Osterwalder and Yves Pigneur, *Business Model Generation* (2010) -- Business model canvas and financial viability
- Peter Thiel, *Zero to One* (2014) -- Market sizing and competitive dynamics
- Tomas Tunguz, "Benchmarks for SaaS Startups" (tomtunguz.com, 2014-2023) -- SaaS financial benchmarks
- Aswath Damodaran, *The Little Book of Valuation* (2011) -- Financial analysis fundamentals
