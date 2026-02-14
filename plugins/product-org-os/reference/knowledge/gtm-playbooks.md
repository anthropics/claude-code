# GTM Playbooks & Methods

## Overview

Go-to-market strategy determines how your product reaches and acquires customers. The GTM motion should match how your customers buy, not how you are organized internally. This pack covers the major GTM motions, launch tier frameworks, and messaging structures. Reference this when creating GTM strategies, launch plans, positioning, or any deliverable about how to take a product to market.

## Frameworks

### Product-Led Growth (PLG)

**When to use**: Products with low friction onboarding, where users can experience core value before talking to sales, and where the end-user has influence over the buying decision.

**How it works**: PLG makes the product itself the primary driver of acquisition, conversion, and expansion. Users discover the product, try it (free trial or freemium), experience value, and then convert to paid. The product does the selling.

**Key elements**:
- **Self-serve signup**: Users start using the product without talking to anyone.
- **Time to value**: The product must deliver a meaningful "aha moment" quickly (ideally within the first session).
- **Natural upgrade triggers**: Users hit limits or discover premium features through normal usage, not through artificial gates.
- **Viral loops**: Product usage naturally exposes others (shared workspaces, collaboration, output sharing).

**PLG metrics to track**:

| Metric | Definition | Healthy Benchmark |
|--------|-----------|-------------------|
| Time to first value | Time from signup to meaningful first action | < 5 minutes ideal |
| Activation rate | % of signups who reach "aha moment" | > 25% |
| Free-to-paid conversion | % of free users who upgrade | 2-5% (freemium), 15-25% (free trial) |
| Product-qualified leads (PQLs) | Users whose usage indicates readiness for upgrade | Track and optimize |
| Expansion revenue % | Revenue from existing customers (upsell, add seats) | > 30% of new ARR |
| Viral coefficient | Avg new users invited per existing user | > 0.5 for meaningful virality |

**PLG assessment checklist**:
- [ ] Can users experience core value without human intervention?
- [ ] Is the "aha moment" achievable in a single session?
- [ ] Do users naturally invite others through product usage?
- [ ] Is marginal cost per free user sustainable?
- [ ] Does the upgrade path feel natural, not punitive?

**Limitations**: Does not work for complex products requiring configuration, training, or customization. Enterprise buyers often need sales interaction for procurement, security review, and legal. PLG and sales-assist can coexist (PLG for land, sales for expand).

---

### Sales-Led Growth (SLG)

**When to use**: Enterprise products, complex solutions, high ACV deals, or markets where the buying process involves multiple stakeholders, procurement, and legal review.

**How it works**: SLG uses sales teams as the primary channel for acquiring and closing customers. The product may have a demo or trial, but the sales team drives the process.

**Sales motion design**:

| Motion | ACV Range | Sales Cycle | Team |
|--------|-----------|-------------|------|
| High-velocity | < $15K | < 30 days | SDR + AE, high volume |
| Mid-market | $15K-$100K | 1-3 months | AE + SE, consultative |
| Enterprise | > $100K | 3-12 months | AE + SE + CSM, strategic |

**Key elements**:
- **Lead qualification**: BANT (Budget, Authority, Need, Timeline) or MEDDIC (Metrics, Economic Buyer, Decision Criteria, Decision Process, Identify Pain, Champion)
- **Sales enablement**: Battlecards, ROI calculators, reference customers, demo environments
- **Buying committee navigation**: Map all stakeholders (champion, economic buyer, technical evaluator, end users, blocker)
- **Proof of value**: Pilots, POCs, or limited deployments that demonstrate value before full commitment

**MEDDIC qualification template**:

| Element | Question | Answer |
|---------|----------|--------|
| Metrics | What business outcomes are they trying to improve? | |
| Economic Buyer | Who has budget authority? | |
| Decision Criteria | What criteria will they use to decide? | |
| Decision Process | What is their evaluation and approval process? | |
| Identify Pain | What specific pain are they experiencing? | |
| Champion | Who inside will advocate for us? | |

**Limitations**: High customer acquisition cost. Longer time to revenue. Requires significant investment in sales team before seeing returns. Does not scale as efficiently as PLG.

---

### Channel-Led Growth

**When to use**: When partners can reach your target customers more efficiently than you can directly, or when your product is part of a larger solution ecosystem.

**How it works**: Channel partners (VARs, SIs, resellers, technology partners) sell your product as part of their offering. You provide the product; they provide the customer relationship and local market knowledge.

**Channel strategy design**:

| Channel Type | When It Works | Key Challenge |
|--------------|---------------|---------------|
| Resellers/VARs | Geographic expansion, vertical expertise | Channel conflict with direct sales |
| System Integrators | Complex implementations, enterprise deals | Solution ownership and quality control |
| Technology Partners | Platform ecosystems, marketplace distribution | Integration maintenance, co-selling alignment |
| Referral Partners | Complementary products, services firms | Incentive design, tracking attribution |

**Channel conflict management**:
- Define clear rules of engagement (territories, named accounts, deal registration)
- Compensate direct sales for channel-assisted deals (reduces resistance)
- Differentiate channel and direct motions by segment or geography
- Build a deal registration system that protects partner margins

**Partner enablement template**:

| Enablement Area | Materials Needed | Owner |
|-----------------|-----------------|-------|
| Product training | Certification program, technical docs | Product Marketing |
| Sales training | Positioning, competitive, objection handling | Sales Enablement |
| Demo environments | Partner demo accounts | Product/Engineering |
| Co-marketing | Joint collateral, case studies | Marketing |
| Deal support | Technical pre-sales, POC support | Solutions Engineering |

**Limitations**: Loss of control over customer relationship. Partner quality varies. Channel margin reduces profitability per deal. Requires significant enablement investment.

---

### Community-Led Growth

**When to use**: Developer tools, open-source products, or products where community expertise and advocacy drive adoption.

**How it works**: Build a community of practitioners who use, discuss, and advocate for your product. The community becomes a source of acquisition (word-of-mouth), activation (peer help), and retention (belonging).

**Community building stages**:

| Stage | Focus | Metrics |
|-------|-------|---------|
| Seed | Attract initial passionate users | Members, contribution rate |
| Growth | Expand through content and events | Active members, content creation |
| Maturity | Self-sustaining, member-to-member help | Engagement ratio, organic growth |
| Scale | Community as competitive advantage | Influence on product direction, advocacy |

**Community channels and their roles**:
- **Forum/Discord/Slack**: Real-time help, feature discussion, networking
- **Blog/Content**: Tutorials, best practices, thought leadership
- **Events (meetups, conferences)**: Relationship building, brand affinity
- **Open source contributions**: Technical engagement, product improvement
- **Champions/Ambassadors**: Power users who represent the product externally

**Developer relations strategy template**:

| Activity | Objective | Metric |
|----------|-----------|--------|
| Documentation | Reduce time to first integration | Doc completion rate, support tickets |
| Sample code/SDKs | Accelerate adoption | Starter project usage, API calls |
| Community forums | Peer support, reduce support load | Response time, resolution rate |
| Conference talks | Awareness, credibility | Attendance, post-talk signups |
| Open source | Trust, contribution | Stars, forks, pull requests |

**Limitations**: Slow to build. Difficult to attribute revenue directly. Community management requires dedicated resources. Community expectations can conflict with commercial decisions.

---

### Partnership-Led Growth

**When to use**: When co-selling, co-building, or co-marketing with established partners can accelerate market entry more than going alone.

**How it works**: Strategic partnerships where both parties actively collaborate on customer acquisition. This goes beyond channel (where partners resell) to genuine joint go-to-market.

**Partnership types**:
- **Co-selling**: Joint sales motions with shared pipeline. Both teams engage in deals.
- **Integration partnerships**: Building on or into another platform (e.g., Salesforce AppExchange, Slack marketplace).
- **Marketplace**: Listing on cloud marketplaces (AWS, Azure, GCP) where procurement is simplified.
- **OEM/Embedded**: Your product embedded inside a partner's product.

**Partnership evaluation framework**:

| Criterion | Score (1-5) |
|-----------|-------------|
| Strategic alignment (shared target customer) | |
| Technical integration feasibility | |
| Partner's market reach and reputation | |
| Revenue potential (direct + influenced) | |
| Relationship investment required | |
| Competitive risk (partner becoming competitor) | |
| **Total** | /30 |

**Limitations**: Partnerships take time to operationalize. Misaligned incentives can torpedo execution. Over-dependence on a single partner is a strategic risk.

---

### Launch Tiers

**When to use**: Any product launch. Not all launches deserve the same level of investment. Tier the launch based on impact and novelty.

**How it works**: Categorize each launch into a tier that determines the level of marketing, sales enablement, and executive involvement.

| Element | Tier 1 (Major) | Tier 2 (Standard) | Tier 3 (Minor) |
|---------|----------------|-------------------|-----------------|
| **What** | New product, major platform change, new market entry | Significant feature, new integration, pricing change | Bug fixes, minor features, UX improvements |
| **Announcement** | Press release, executive blog, analyst briefing | Blog post, email to customers, social | In-app notification, changelog |
| **Sales enablement** | Full training, new battlecards, updated demos | Email briefing, updated FAQ | No enablement needed |
| **Marketing** | Campaign, landing page, webinar, ads | Blog, email, social posts | Changelog entry |
| **Executive involvement** | CEO/CPO quoted, exec briefing to key accounts | VP-level awareness | Team-level only |
| **Success metrics** | Pipeline impact, market awareness, analyst coverage | Feature adoption, customer feedback | Adoption rate |
| **Timeline** | 6-8 weeks preparation | 2-4 weeks preparation | 1 week preparation |

**Tier determination checklist**:
- [ ] Does this change how customers think about our product? (Tier 1)
- [ ] Will this significantly change workflows for existing users? (Tier 1-2)
- [ ] Do sales teams need new materials? (Tier 1-2)
- [ ] Is this a competitive differentiator? (Tier 1-2)
- [ ] Is this incremental improvement to existing capability? (Tier 3)

**Limitations**: Tier classification can be political (everyone wants their feature to be Tier 1). Requires clear criteria and a decision-maker.

---

### Messaging House

**When to use**: When you need a structured messaging framework that ensures consistent communication across all channels and materials.

**How it works**: A messaging house provides a hierarchy of messages from high-level positioning down to specific proof points.

**Structure**:

```
+-----------------------------------------------------------+
|                    POSITIONING STATEMENT                     |
|  For [target], who [need], [product] is [category]          |
|  that [key benefit]. Unlike [competitor], we [differentiator]|
+-----------------------------------------------------------+
|          |           |            |           |              |
|  Pillar 1|   Pillar 2|    Pillar 3|   Pillar 4|             |
|  [Theme] |   [Theme] |    [Theme] |   [Theme] |             |
|          |           |            |           |              |
| - Proof  | - Proof   |  - Proof   | - Proof   |             |
| - Proof  | - Proof   |  - Proof   | - Proof   |             |
| - Proof  | - Proof   |  - Proof   | - Proof   |             |
+-----------------------------------------------------------+
```

**Template**:

| Element | Content |
|---------|---------|
| **Positioning statement** | For [target customer] who [need/pain], [product name] is [category] that [primary benefit]. Unlike [primary alternative], we [key differentiator]. |
| **Pillar 1** | [Value theme, e.g., "Speed"] |
| -- Proof point 1 | [Specific evidence, stat, or customer quote] |
| -- Proof point 2 | [Specific evidence] |
| **Pillar 2** | [Value theme, e.g., "Simplicity"] |
| -- Proof point 1 | [Specific evidence] |
| -- Proof point 2 | [Specific evidence] |
| **Pillar 3** | [Value theme, e.g., "Security"] |
| -- Proof point 1 | [Specific evidence] |
| -- Proof point 2 | [Specific evidence] |
| **Boilerplate** | [Company description for press and materials] |

**Limitations**: Messaging houses can become stale if not updated regularly. Too many pillars (more than 4) dilute the message. Must be tested with actual customers, not just internally.

---

### Positioning Templates

**When to use**: When you need to establish, change, or sharpen your product's position in the market.

**Competitive positioning statement** (April Dunford's framework):
1. Identify your best-fit customers (not all customers)
2. Identify the competitive alternatives they would use instead
3. List attributes that make you unique vs. those alternatives
4. Map those attributes to value themes customers care about
5. Identify the market category where your strengths are advantages

**Category creation positioning** (when you are defining a new category):
1. Name the problem in a way that makes the old approach look broken
2. Name the new category you are creating
3. Position your product as the leader of that category
4. Recruit analysts, customers, and partners to validate the category

**Repositioning** (when your current position is not working):
1. Diagnose why: Is the market wrong? The message? The segment?
2. Identify the segment where your product already wins
3. Rebuild positioning around that segment's language and needs
4. Re-enable sales with new messaging and proof points

**Limitations**: Positioning is only as strong as the product behind it. Positioning changes take time to propagate through all materials and sales conversations.

## Selection Guide

| Situation | Recommended Playbook | Why |
|-----------|---------------------|-----|
| Self-serve product, large market | PLG | Product drives acquisition |
| Enterprise, complex buying process | SLG | Sales team navigates stakeholders |
| Geographic expansion or vertical markets | Channel-led | Partners have local reach |
| Developer tools, technical audience | Community-led | Community drives adoption and trust |
| Established platform ecosystem | Partnership-led | Leverage existing distribution |
| New product launch | Launch Tiers + Messaging House | Right-size the launch effort |
| Positioning unclear or not working | Dunford positioning framework | Systematic positioning rebuild |
| Mixed market (SMB + Enterprise) | PLG + Sales-assist | PLG for land, sales for expand |

## Sources

- Wes Bush, *Product-Led Growth* (2019) -- PLG strategy and metrics
- Kyle Poyar, OpenView Partners (2018-2023) -- PLG benchmarks and research
- Mark Roberge, *The Sales Acceleration Formula* (2015) -- Scalable sales-led growth
- Jack Napoli and Jeff Koser, *Selling Is Dead* (2006) -- Modern B2B sales methodology
- April Dunford, *Obviously Awesome* (2019) -- Positioning framework
- Al Ries and Jack Trout, *Positioning* (1981) -- Classic positioning theory
- Christopher Lochhead, *Play Bigger* (2016) -- Category creation strategy
- David Spinks, *The Business of Belonging* (2021) -- Community-led growth strategy
