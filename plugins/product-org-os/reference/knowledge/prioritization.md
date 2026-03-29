# Prioritization Frameworks & Methods

## Overview

Prioritization is the core discipline of product management. This pack covers the major frameworks for deciding what to build (and what not to build), when to use each, and practical templates for applying them. Reference this when producing roadmaps, backlog rankings, feature specs, or any deliverable that requires explicit priority justification.

## Frameworks

### RICE (Reach, Impact, Confidence, Effort)

**When to use**: High-volume feature backlogs where you need a quantitative, comparable score across many items.

**How it works**: RICE assigns a numeric score to each initiative by evaluating four dimensions. **Reach** estimates how many customers or users will be affected in a given time period (e.g., per quarter). **Impact** rates the degree of effect on each person reached, typically on a scale: 3 = massive, 2 = high, 1 = medium, 0.5 = low, 0.25 = minimal. **Confidence** captures how certain you are in your estimates, expressed as a percentage (100%, 80%, 50%). **Effort** estimates person-months (or story points) of work required.

The formula is: `RICE Score = (Reach x Impact x Confidence) / Effort`

The score is relative, not absolute. Its value is in ranking items against each other, not in the raw number. Teams often find that surfacing the individual dimension scores is as valuable as the composite score, because it forces conversations about assumptions.

**Template**:

| Initiative | Reach (users/qtr) | Impact (0.25-3) | Confidence (%) | Effort (person-months) | RICE Score |
|------------|-------------------|------------------|----------------|------------------------|------------|
| Feature A | 5,000 | 2 | 80% | 3 | 2,667 |
| Feature B | 10,000 | 1 | 50% | 2 | 2,500 |
| Feature C | 2,000 | 3 | 100% | 1 | 6,000 |

**Limitations**: RICE requires reasonable estimates, which are hard for novel features. Confidence is often optimistic. Effort estimates from PM side are unreliable without engineering input. The formula treats all dimensions as equally important, which may not match strategic priorities.

---

### ICE (Impact, Confidence, Ease)

**When to use**: Quick triage sessions where you need a fast, good-enough ranking without deep analysis.

**How it works**: ICE is a simplified scoring model where each dimension is rated 1-10. **Impact** is how much the initiative will move the needle on your target metric. **Confidence** is how sure you are that this will work. **Ease** is how simple the implementation will be (inverse of effort).

The formula is: `ICE Score = Impact x Confidence x Ease`

ICE is deliberately rough. It works best when a team needs to rapidly sort a long list into "definitely," "maybe," and "probably not" buckets. The discussion around scoring is often more valuable than the scores themselves.

**Template**:

| Initiative | Impact (1-10) | Confidence (1-10) | Ease (1-10) | ICE Score |
|------------|---------------|--------------------|--------------| ----------|
| Feature A | 8 | 6 | 4 | 192 |
| Feature B | 5 | 8 | 9 | 360 |

**Limitations**: Very subjective. Without calibration, different people will score the same thing differently. Best used as a discussion tool rather than a decision tool.

---

### MoSCoW (Must/Should/Could/Won't)

**When to use**: Scope negotiation with stakeholders, especially when defining MVP or constraining a release.

**How it works**: Every item in scope is categorized into one of four buckets. **Must Have** items are non-negotiable; without them, the release is not viable. These are requirements, not wishes. **Should Have** items are important but the release can ship without them. They will be included if time permits. **Could Have** items are nice to have; included only if there is no impact on Must or Should items. **Won't Have (this time)** items are explicitly out of scope for this release but may be considered later.

The critical discipline is in the "Must" category. If everything is a Must, nothing is. Typically, Musts should represent roughly 60% of the total effort. If they represent more, your scope is likely too large for the timeline.

**Facilitation guide**:
1. Start by listing all proposed items
2. Ask: "If this item is missing, does the release fail completely?" -- if yes, it is a Must
3. For remaining items, ask: "Is this important enough that we should try hard to include it?" -- if yes, Should
4. Everything else is Could or Won't
5. Validate that Must items fit within approximately 60% of available capacity

**Template**:

| Category | Item | Rationale |
|----------|------|-----------|
| **Must** | User authentication | Cannot launch without it |
| **Should** | Password reset via email | Users will need it soon but can use support as workaround |
| **Could** | Social login | Convenience, not blocking |
| **Won't** | Biometric auth | Future consideration |

**Limitations**: Does not help with ordering within categories. Stakeholders will try to make everything a Must. Requires firm facilitation.

---

### Kano Model

**When to use**: Understanding which features drive customer satisfaction vs. which merely prevent dissatisfaction. Particularly useful for understanding the difference between "table stakes" and "delighters."

**How it works**: The Kano model categorizes features into five types based on the relationship between feature implementation and customer satisfaction:

- **Basic (Must-Be)**: Features customers expect. Their presence does not increase satisfaction, but their absence causes strong dissatisfaction. Example: a shopping cart on an e-commerce site.
- **Performance (One-Dimensional)**: Features where satisfaction scales linearly with implementation quality. More is better. Example: page load speed.
- **Excitement (Attractive)**: Features customers do not expect. Their absence does not cause dissatisfaction, but their presence creates delight. Example: a personalized recommendation that saves time.
- **Indifferent**: Features customers do not care about either way.
- **Reverse**: Features that some customers actively dislike.

**Survey methodology**: Present paired questions for each feature. First: "How would you feel if this feature were present?" (Functional question). Second: "How would you feel if this feature were absent?" (Dysfunctional question). Answer options for both: "I like it," "I expect it," "I am neutral," "I can tolerate it," "I dislike it."

Cross-reference the answers using the Kano evaluation table to classify each feature.

**Template**:

| Feature | Functional Response | Dysfunctional Response | Classification |
|---------|--------------------|-----------------------|----------------|
| Auto-save | I expect it | I dislike it | Basic |
| Dark mode | I like it | I am neutral | Excitement |
| Export to PDF | I like it | I can tolerate it | Performance |

**Limitations**: Classification can shift over time (yesterday's excitement becomes today's expectation). Requires actual customer survey data to be rigorous. Small sample sizes can be misleading.

---

### Weighted Scoring

**When to use**: When you need to align prioritization with explicit strategic criteria and want stakeholders to agree on the weights before scoring.

**How it works**: Define a set of criteria that matter for your prioritization decision. Assign a weight (percentage) to each criterion, totaling 100%. Score each initiative against each criterion on a consistent scale (e.g., 1-5). Multiply scores by weights and sum for a total weighted score.

The key insight is that the conversation about weights is the most valuable part. When leaders agree that "strategic alignment" gets 30% weight and "revenue impact" gets 25%, they are making an explicit strategic statement.

**Template**:

| Criterion | Weight | Feature A (Score) | Feature A (Weighted) | Feature B (Score) | Feature B (Weighted) |
|-----------|--------|----|----|----|----|
| Strategic alignment | 30% | 4 | 1.20 | 3 | 0.90 |
| Revenue impact | 25% | 3 | 0.75 | 5 | 1.25 |
| Customer demand | 20% | 5 | 1.00 | 2 | 0.40 |
| Technical feasibility | 15% | 2 | 0.30 | 4 | 0.60 |
| Competitive necessity | 10% | 3 | 0.30 | 4 | 0.40 |
| **Total** | **100%** | | **3.55** | | **3.55** |

**Limitations**: Choice of criteria and weights is itself a subjective decision. Can create false precision. Works best when criteria and weights are established before scoring begins.

---

### Opportunity Scoring (Ulwick)

**When to use**: Innovation and new product development, where you want to find underserved customer needs.

**How it works**: Based on Anthony Ulwick's Outcome-Driven Innovation (ODI) methodology. For each customer job or outcome, measure two things: **Importance** (how important this outcome is to the customer, 1-10) and **Satisfaction** (how satisfied customers are with current solutions, 1-10).

The Opportunity Score formula is: `Opportunity = Importance + (Importance - Satisfaction)`

Opportunities with high importance and low satisfaction represent the most fertile ground for innovation. Plot them on a scatter chart with Importance on the Y-axis and Satisfaction on the X-axis. The upper-left quadrant (high importance, low satisfaction) contains your best opportunities.

**Template**:

| Customer Outcome | Importance (1-10) | Satisfaction (1-10) | Opportunity Score |
|------------------|--------------------|---------------------|-------------------|
| Quickly find relevant reports | 9 | 4 | 14 |
| Customize dashboard layout | 6 | 7 | 5 |
| Share insights with team | 8 | 3 | 13 |

**Limitations**: Requires direct customer research data. "Importance" can be ambiguous if outcomes are not defined precisely. Works best with Ulwick's full JTBD framework for defining outcomes.

---

### Buy-a-Feature

**When to use**: Customer-facing prioritization workshops or advisory board sessions where you want stakeholders to reveal true priorities through resource allocation.

**How it works**: Create a "menu" of possible features, each with a price tag proportional to its estimated cost or effort. Give each participant a fixed budget of play money (typically enough to buy about one-third of the total features). Participants must allocate their budget, individually or in groups. The results reveal which features participants are willing to spend limited resources on.

**Facilitation guide**:
1. Select 15-25 features to include (too few limits insight, too many overwhelms)
2. Assign prices based on estimated effort (not necessarily proportional -- premium features should cost more)
3. Give each participant a budget equal to roughly 30-40% of the total feature cost
4. Allow and encourage participants to pool resources (reveals collaboration dynamics)
5. Run the exercise, then discuss results: Why did you choose this? What did you give up?
6. Debrief: Features with the most money represent strongest demand

**Limitations**: Subject to groupthink in live sessions. Works best with 6-12 participants. Results are directional, not definitive. Some participants may be unrepresentative.

## Selection Guide

| Situation | Recommended Framework | Why |
|-----------|----------------------|-----|
| Large backlog, need quantitative ranking | RICE | Provides comparable scores with explicit assumptions |
| Quick triage of many ideas | ICE | Fast, good-enough ordering |
| Scope negotiation for a release | MoSCoW | Forces explicit Must vs. Nice-to-have distinction |
| Understanding satisfaction drivers | Kano | Reveals Basic vs. Performance vs. Excitement |
| Multi-stakeholder alignment on criteria | Weighted Scoring | Makes strategic weights explicit |
| Finding innovation opportunities | Opportunity Scoring | Surfaces underserved needs |
| Customer input on priorities | Buy-a-Feature | Reveals willingness to trade off |
| Early-stage with few items | Simple rank order | Frameworks add overhead without enough items |

## Sources

- Sean McBride, *Intercom on Product Management* (2015) -- Practical prioritization approaches
- Anthony Ulwick, *What Customers Want* (2005) -- Outcome-Driven Innovation and Opportunity Scoring
- Dai Clegg and Richard Barker, *Case Method Fast-Track* (1994) -- Original MoSCoW formulation
- Noriaki Kano et al., "Attractive Quality and Must-Be Quality" (1984) -- Kano Model
- Luke Hohmann, *Innovation Games* (2006) -- Buy-a-Feature and other prioritization games
- RICE framework originated at Intercom (Sean McBride, 2014)
