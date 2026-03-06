# Pricing Frameworks & Methods

## Overview

Pricing is a product decision that directly shapes positioning, revenue, and customer perception. This pack covers the major pricing strategies and models, methods for researching willingness to pay, and practical templates for pricing decisions. Reference this when creating pricing strategies, evaluating pricing models, or analyzing competitive pricing.

## Frameworks

### Value-Based Pricing

**When to use**: When your product delivers measurable, differentiated value and you can quantify the customer's willingness to pay based on that value.

**How it works**: Value-based pricing sets prices based on the perceived or measured economic value the product delivers to the customer, rather than on your costs or competitor prices. The process has three steps: (1) identify the customer's next best alternative, (2) quantify the differentiation value your product provides above that alternative, and (3) set price as a fraction of that differentiation value, sharing the surplus between you and the customer.

The "value metric" is the unit of measurement that aligns price with the value customers receive. Good value metrics scale with customer success (e.g., seats, transactions, API calls, revenue managed). A value metric should be easy to understand, scale with usage, and align with how customers think about value.

**Template for Value Metric Identification**:

| Candidate Metric | Scales with Value? | Easy to Understand? | Easy to Measure? | Predictable for Buyer? | Score |
|------------------|----|----|----|----|-------|
| Per seat | Partially | Yes | Yes | Yes | 3.5/5 |
| Per transaction | Yes | Yes | Yes | Varies | 3.5/5 |
| Per GB stored | Somewhat | Yes | Yes | No | 2.5/5 |
| Per revenue managed | Yes | Yes | Moderate | No | 3/5 |

**Limitations**: Requires deep understanding of customer economics. Difficult when value is hard to quantify (e.g., collaboration tools). Customers may dispute your value claims.

---

### Cost-Plus Pricing

**When to use**: Commodity products, internal transfer pricing, or as a floor/sanity check for other pricing approaches.

**How it works**: Calculate total costs (fixed + variable per unit), add a target margin, and set price accordingly.

Formula: `Price = Unit Cost x (1 + Target Margin %)`

For SaaS, unit cost includes: infrastructure per customer, support cost per customer, and an allocated share of R&D and G&A.

**Template**:

| Cost Component | Monthly per Customer |
|----------------|---------------------|
| Infrastructure (hosting, compute) | $X |
| Support (allocated) | $X |
| R&D (allocated) | $X |
| G&A (allocated) | $X |
| **Total Cost** | **$X** |
| Target Margin (e.g., 70%) | $X |
| **Price** | **$X** |

**Limitations**: Ignores customer value and willingness to pay. Can lead to underpricing differentiated products or overpricing commodities. Should never be the sole basis for SaaS pricing.

---

### Competitive Pricing

**When to use**: Markets with established pricing norms where your positioning is defined relative to competitors.

**How it works**: Map competitor pricing, then position your price relative to them based on your differentiation strategy. You can price at parity (same segment), at a premium (more value, higher price), or below (disruptive, value positioning).

Key considerations: (1) Ensure you're comparing equivalent tiers/packages. (2) Understand competitor pricing includes implicit positioning -- being 30% cheaper signals something about your product. (3) Competitive pricing should inform, not determine your price.

**Template**:

| Competitor | Basic | Pro | Enterprise | Value Metric | Key Differentiator |
|------------|-------|-----|------------|--------------|-------------------|
| Competitor A | $29/mo | $79/mo | Custom | Per seat | Market leader, broad features |
| Competitor B | $19/mo | $49/mo | $149/mo | Per seat | Budget option, limited features |
| Competitor C | Free | $99/mo | Custom | Per workspace | Developer-focused |
| **Our Position** | **$?** | **$?** | **$?** | **?** | **?** |

**Limitations**: Anchors you to competitor framing. Can lead to price wars. Does not account for your unique value proposition.

---

### Freemium Model

**When to use**: Products with low marginal cost, large addressable markets, and where the free tier demonstrates core value that motivates upgrade.

**How it works**: Offer a permanently free tier with limited functionality, then charge for premium features, higher usage, or advanced capabilities. The critical decision is the free/paid line -- what goes in free, what requires payment.

**Principles for the free/paid line**:
- Free tier should deliver enough value that users become habitual
- Upgrade triggers should be natural outcomes of successful usage (not artificial friction)
- Free users should be cheap to serve (low support, low infrastructure cost)
- Free tier should be a genuine product, not a crippled trial

**Conversion optimization levers**: Usage limits (storage, API calls, seats), feature gating (advanced analytics, integrations, admin controls), support levels, and branding (remove "Powered by" on paid plans).

**Template**:

| Dimension | Free | Paid | Rationale |
|-----------|------|------|-----------|
| Users/Seats | Up to 3 | Unlimited | Teams naturally grow beyond 3 |
| Storage | 1 GB | 100 GB+ | Power users hit limit organically |
| Features | Core workflow | Analytics, integrations, API | Advanced needs emerge with success |
| Support | Community only | Email + priority | Support cost managed |
| Branding | "Powered by X" | White-label | Enterprise cares about this |

**Key metrics**: Free-to-paid conversion rate (benchmarks: 2-5% for self-serve SaaS), time to conversion, activation rate in free tier, cost to serve free users.

**Limitations**: High free user volume can be expensive. Low conversion can mean the free/paid line is wrong. Can attract users who never intend to pay.

---

### Usage-Based Pricing

**When to use**: Products where consumption varies significantly across customers and usage correlates with value received.

**How it works**: Price scales with a usage metric (API calls, compute hours, transactions processed, messages sent). Customers pay for what they use. This model aligns price perfectly with value but introduces revenue predictability concerns for both vendor and buyer.

**Design considerations**:
- Choose a metric customers understand and can predict
- Consider a base fee + usage component for revenue predictability
- Set overage rates that are fair (not punitive)
- Provide usage dashboards so customers feel in control
- Consider committed-use discounts for predictability

**Template**:

| Usage Tier | Rate | Included | Overage |
|------------|------|----------|---------|
| Starter | $0/mo | 1,000 calls | $0.01/call |
| Growth | $99/mo | 50,000 calls | $0.005/call |
| Scale | $499/mo | 500,000 calls | $0.002/call |
| Enterprise | Custom | Custom | Negotiated |

**Limitations**: Revenue unpredictability for the vendor. Bill shock risk for customers. Requires robust metering infrastructure. Some customers prefer fixed costs for budgeting.

---

### Tiered Pricing (Good/Better/Best)

**When to use**: Most B2B SaaS products. Tiered pricing is the most common model because it serves multiple segments with a single product.

**How it works**: Create 3-4 tiers that target different customer segments. Each tier includes everything in the tier below it plus additional features. The middle tier should be designed as the "anchor" that most customers choose.

**Design principles**:
- **Good**: Entry point. Core value, limited scale. Target: individual users or small teams.
- **Better**: The anchor. Most popular tier by design. Includes the features most customers need. Target: growing teams.
- **Best**: Premium. Enterprise features (SSO, audit logs, SLA, dedicated support). Target: large organizations.
- Price the middle tier as the obvious "best deal" compared to the ratio of features/price in other tiers

**Template**:

| Dimension | Starter | Professional | Enterprise |
|-----------|---------|-------------|------------|
| Target segment | Individuals/small teams | Growing teams | Large organizations |
| Price | $X/mo | $Y/mo | Custom |
| Seats | Up to 5 | Up to 50 | Unlimited |
| Features | Core | Core + Advanced | All |
| Storage | Limited | Generous | Unlimited |
| Support | Email | Priority | Dedicated |
| Security | Standard | Standard + SSO | Full (SAML, audit, compliance) |
| SLA | None | 99.9% | 99.99% |

**Limitations**: Tier boundaries can feel arbitrary. Some features do not fit neatly into tiers. Can lead to "Enterprise" becoming a catch-all.

---

### Van Westendorp Price Sensitivity Meter (PSM)

**When to use**: Early-stage pricing research when you need to understand customer willingness to pay before setting a price.

**How it works**: Survey customers (or prospects) with four questions about a described product:
1. At what price would you consider the product to be so expensive that you would not consider buying it? (**Too Expensive**)
2. At what price would you consider the product to be priced so low that you would question its quality? (**Too Cheap**)
3. At what price would you consider the product to be getting expensive, but you still might consider buying it? (**Expensive/High Side**)
4. At what price would you consider the product to be a bargain -- a great buy for the money? (**Cheap/Good Value**)

Plot cumulative frequency distributions for all four answers. The intersections reveal:
- **Point of Marginal Cheapness (PMC)**: Too Cheap intersects Expensive
- **Point of Marginal Expensiveness (PME)**: Too Expensive intersects Cheap
- **Indifference Price Point (IPP)**: Expensive intersects Cheap (equal number think it's a bargain vs. getting expensive)
- **Optimal Price Point (OPP)**: Too Cheap intersects Too Expensive (minimizes extreme reactions)

The acceptable price range runs from PMC to PME.

**Template survey**:

| Question | Your Price |
|----------|-----------|
| Too expensive (would not buy) | $____ |
| Getting expensive (might still buy) | $____ |
| A bargain (great deal) | $____ |
| Too cheap (would question quality) | $____ |

**Limitations**: Hypothetical -- stated preferences may differ from actual behavior. Requires 100+ respondents for statistical reliability. Works best for products respondents understand well. Does not account for competitive alternatives directly.

---

### Conjoint Analysis

**When to use**: When you need to understand feature-price tradeoffs and willingness to pay for specific features.

**How it works**: Conjoint analysis presents respondents with product "profiles" that vary on multiple attributes (features, price, brand) and asks them to choose their preferred option or rank profiles. Statistical analysis reveals the implicit value (utility) each attribute level contributes to the overall preference.

This is particularly useful for pricing because it reveals the incremental willingness to pay for specific features, helping you decide what belongs in each tier or what add-on pricing is justified.

**Practical application**:
1. Define 4-6 key attributes (e.g., price, storage, integrations, support level, analytics)
2. Define 3-4 levels for each attribute
3. Use a choice-based conjoint tool (many survey platforms support this)
4. Collect at least 200-300 responses
5. Analyze utility scores to understand willingness to pay for each feature

**Template for attribute design**:

| Attribute | Level 1 | Level 2 | Level 3 |
|-----------|---------|---------|---------|
| Price | $29/mo | $79/mo | $149/mo |
| Storage | 5 GB | 50 GB | Unlimited |
| Integrations | 3 | 10 | Unlimited |
| Support | Email | Priority | Dedicated |

**Limitations**: Complex to design and analyze properly. Requires larger sample sizes. Can be expensive to run. Results are only as good as the attributes chosen.

## Selection Guide

| Situation | Recommended Approach | Why |
|-----------|---------------------|-----|
| New product, unknown WTP | Van Westendorp + customer interviews | Low cost, directional |
| Feature-price tradeoff decisions | Conjoint analysis | Quantifies feature value |
| Differentiated product, measurable value | Value-based pricing | Captures fair share of value |
| Established market, clear competitors | Competitive pricing (informed by value) | Market context matters |
| Large market, low marginal cost | Freemium with paid tiers | Build base, convert power users |
| Variable consumption, clear usage metric | Usage-based (with base fee) | Aligns price with value |
| Multiple segments, single product | Tiered (Good/Better/Best) | Serves segments efficiently |
| Setting a price floor | Cost-plus | Never price below cost knowingly |

## Sources

- Madhavan Ramanujam and Georg Tacke, *Monetizing Innovation* (2016) -- Willingness to pay research and pricing strategy
- Thomas Nagle and Georg Muller, *The Strategy and Tactics of Pricing* (6th ed., 2017) -- Comprehensive pricing theory
- Patrick Campbell, ProfitWell/Paddle research (2015-2023) -- SaaS pricing benchmarks and best practices
- Peter van Westendorp, "NSS-Price Sensitivity Meter" (1976) -- PSM methodology
- Paul E. Green and V. Srinivasan, "Conjoint Analysis in Marketing" (1978) -- Conjoint methodology foundations
- Kyle Poyar, OpenView Partners Growth Blog (2018-2023) -- Usage-based pricing in SaaS
