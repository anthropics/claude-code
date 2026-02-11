# Metrics Frameworks & Methods

## Overview

Metrics frameworks help product teams define, track, and act on the right measurements. Choosing the wrong metrics leads to optimizing the wrong things. This pack covers the major frameworks for metric selection, goal setting, and analysis. Reference this when defining success criteria, building dashboards, setting OKRs, or any deliverable that involves measurement.

## Frameworks

### HEART (Google)

**When to use**: When you need a comprehensive, user-centered metric framework for a product or feature, particularly for UX-driven products.

**How it works**: HEART is a framework developed by Kerry Rodden and colleagues at Google. It organizes metrics across five categories:

- **Happiness**: Subjective user satisfaction. Measured through surveys (NPS, CSAT, SUS), ratings, qualitative feedback. Tracks sentiment.
- **Engagement**: Depth of user involvement. Measured through frequency of use, session duration, actions per session, feature adoption. Tracks behavioral investment.
- **Adoption**: New users or new usage. Measured through new signups, feature first-use, upgrade rate. Tracks growth in user base.
- **Retention**: Returning users. Measured through DAU/MAU ratio, churn rate, repeat usage rate. Tracks whether users stick.
- **Task Success**: Efficiency and effectiveness of user actions. Measured through task completion rate, time on task, error rate. Tracks usability.

For each category, define Goals (what you want to achieve), Signals (user behaviors that indicate progress), and Metrics (specific, measurable quantities).

**Template (Goals-Signals-Metrics)**:

| Category | Goal | Signal | Metric |
|----------|------|--------|--------|
| Happiness | Users find the product valuable | High satisfaction ratings | NPS > 50; CSAT > 4.2/5 |
| Engagement | Users use key features regularly | Frequent return visits | Weekly active users; avg actions/session |
| Adoption | New users try core workflow | Completing onboarding | % completing setup within 7 days |
| Retention | Users continue using after month 1 | Return visits over time | 30-day retention rate; monthly churn |
| Task Success | Users complete tasks efficiently | Quick task completion | Avg time to complete [task]; error rate |

**Limitations**: Not all five categories are equally relevant for every product. Can lead to metric overload if every category has multiple metrics. Best to focus on 1-2 metrics per category.

---

### North Star Metric (NSM)

**When to use**: When you need a single metric that captures the core value your product delivers to customers and serves as the primary compass for the entire product team.

**How it works**: The North Star Metric is the single metric that best captures the core value your product delivers. It should have three properties: (1) it measures value delivered to customers, (2) it correlates with long-term business success, and (3) it reflects the breadth and depth of product usage.

The NSM is supported by **input metrics** -- metrics that the team can directly influence and that collectively drive the NSM.

**How to identify your NSM**:
1. Define what "value" means for your customers
2. Identify the moment when a customer receives that value
3. Find a metric that captures the frequency and breadth of that value moment
4. Verify that the metric correlates with retention and revenue

**Examples by business type**:

| Business Type | North Star Metric | Input Metrics |
|---------------|-------------------|---------------|
| Collaboration tool | Weekly active teams | Signups, activation rate, messages sent, integrations connected |
| Marketplace | Transactions completed per week | Listings created, buyer registrations, search-to-purchase rate |
| Media/Content | Total engaged reading time | Articles published, email subscribers, share rate |
| SaaS (general) | Weekly active users completing core action | Onboarding completion, feature adoption, support tickets |
| E-commerce | Monthly purchases per customer | Traffic, conversion rate, repeat purchase rate |

**NSM identification template**:

| Question | Your Answer |
|----------|-------------|
| What core value does your product deliver? | |
| When does a customer "get" that value? | |
| What metric captures that value moment? | |
| Does it correlate with retention? | |
| Does it correlate with revenue? | |
| Can teams influence it through their work? | |
| **Candidate NSM** | |

**Limitations**: A single metric can be gamed or misapplied. The NSM needs input metrics to be actionable. Choosing the wrong NSM can misalign the entire organization.

---

### AARRR (Pirate Metrics)

**When to use**: When you need to understand your product's funnel end-to-end, identify where the biggest leaks are, and prioritize improvements.

**How it works**: Dave McClure's Pirate Metrics framework (named for the sound the acronym makes) maps the customer lifecycle into five stages:

- **Acquisition**: How do users find you? Metrics: traffic by channel, signup rate, cost per acquisition.
- **Activation**: Do users have a good first experience? Metrics: onboarding completion, time to first value, "aha moment" rate.
- **Retention**: Do users come back? Metrics: DAU/WAU/MAU, retention curves, churn rate, engagement frequency.
- **Revenue**: Do users pay? Metrics: conversion rate, ARPU, MRR, expansion revenue.
- **Referral**: Do users tell others? Metrics: NPS, viral coefficient, referral rate, organic growth %.

**Funnel analysis template**:

| Stage | Definition | Current Metric | Target | Biggest Leak |
|-------|-----------|---------------|--------|--------------|
| Acquisition | Visit to signup | X% | Y% | [Channel/message] |
| Activation | Signup to first value | X% | Y% | [Onboarding step] |
| Retention | Active at day 7/30/90 | X% | Y% | [Drop-off point] |
| Revenue | Active to paying | X% | Y% | [Conversion barrier] |
| Referral | Paying to referring | X% | Y% | [Missing incentive] |

**Prioritization rule**: Fix the leakiest stage first. There is no point driving more acquisition if activation is broken. Generally, work right-to-left: fix Retention before Acquisition.

**Limitations**: The linear funnel model oversimplifies complex user journeys. B2B enterprise products may not follow this sequence cleanly. Referral is often the hardest to measure accurately.

---

### OKRs (Objectives and Key Results)

**When to use**: Quarterly or annual goal setting when you need alignment across teams on outcomes (not outputs) with clear measurement.

**How it works**: OKRs consist of an **Objective** (a qualitative, inspiring description of what you want to achieve) and 2-5 **Key Results** (quantitative measures that indicate whether the Objective has been achieved).

**Objective qualities**: Qualitative, time-bound, actionable, inspiring. Should answer "Where do we want to go?"

**Key Result qualities**: Quantitative, measurable, achievable but stretching, outcome-based (not output-based). Should answer "How will we know we got there?"

**Common cadence**: Annual OKRs at company level, quarterly OKRs at team level. Quarterly review and re-set.

**Scoring**: Typically scored 0.0-1.0 at end of period. 0.7-0.8 is generally considered "on track" (OKRs should be ambitious enough that 100% is rare). Below 0.4 signals a problem with either ambition calibration or execution.

**Good vs. bad Key Results**:

| Bad (Output) | Good (Outcome) |
|--------------|----------------|
| Launch feature X | Increase activation rate from 30% to 45% |
| Publish 10 blog posts | Grow organic traffic by 25% |
| Complete design system | Reduce design-to-dev handoff time by 40% |
| Ship mobile app | Achieve 20% of DAU from mobile |

**Template**:

**Objective**: [Qualitative goal statement]

| Key Result | Baseline | Target | Current | Score |
|------------|----------|--------|---------|-------|
| KR1: [Measurable outcome] | [Current state] | [Target state] | [Progress] | 0.0-1.0 |
| KR2: [Measurable outcome] | [Current state] | [Target state] | [Progress] | 0.0-1.0 |
| KR3: [Measurable outcome] | [Current state] | [Target state] | [Progress] | 0.0-1.0 |

**Common mistakes**: Setting output-based KRs (deliverables, not outcomes). Too many OKRs (max 3-5 Objectives with 2-5 KRs each). Treating OKRs as a performance review tool (kills ambition). Setting "sandbagged" OKRs that are easy to hit.

**Limitations**: OKRs do not work without organizational commitment to the process. They require regular check-ins and updating. Poorly implemented OKRs are worse than no OKRs (they create busywork without alignment).

---

### Leading vs. Lagging Indicators

**When to use**: Any time you are defining success metrics and need both early warning signals and confirmation metrics.

**How it works**: **Lagging indicators** measure outcomes that have already happened. They confirm whether you succeeded. Examples: quarterly revenue, annual churn rate, NPS (measured periodically). The problem: by the time you see a lagging indicator change, it may be too late to act.

**Leading indicators** predict future outcomes. They give you early signal. Examples: weekly activation rate (leads retention), sales pipeline (leads revenue), support ticket volume (leads churn). The advantage: you can act on leading indicators before lagging indicators confirm a problem.

**How to identify leading indicators**:
1. Start with the lagging indicator you care about (e.g., churn)
2. Ask: "What behaviors or events happen BEFORE a customer churns?"
3. Validate: Does the leading indicator actually predict the lagging outcome? (Correlation analysis)
4. Act: Build dashboards and alerts around leading indicators

**Template**:

| Lagging Indicator | Leading Indicator(s) | Relationship | Action Trigger |
|-------------------|-----------------------|-------------|----------------|
| Quarterly churn | Login frequency decrease | Users who log in < 2x/month have 3x churn risk | Alert when login frequency drops |
| Revenue growth | Pipeline qualified leads | Pipeline predicts next-quarter revenue | Alert when pipeline < target |
| Customer satisfaction (NPS) | Support ticket resolution time | Slow resolution precedes NPS drops | SLA monitoring |
| Feature adoption | Onboarding completion | Incomplete onboarding predicts low adoption | Intervention at day 3 |

**Limitations**: Identifying true leading indicators requires data and analysis. Correlation is not causation -- a leading indicator may stop predicting if the underlying system changes.

---

### Cohort Analysis

**When to use**: When you need to understand how different groups of users behave over time, and whether product changes are actually improving outcomes.

**How it works**: A cohort is a group of users who share a common characteristic, typically when they started using the product (acquisition cohort). Cohort analysis tracks each cohort's behavior over time rather than looking at aggregate metrics, which can mask trends.

**Types of cohorts**:
- **Acquisition cohort**: Grouped by when they signed up (most common)
- **Behavioral cohort**: Grouped by an action they took (e.g., "users who completed onboarding" vs. "users who skipped")

**How to build a retention cohort table**:
1. Define the cohort (e.g., users who signed up in Week 1)
2. Define the retention event (e.g., logged in)
3. For each cohort, track what percentage performed the retention event in each subsequent period

**Template (Acquisition Cohort Retention)**:

| Cohort | Month 0 | Month 1 | Month 2 | Month 3 | Month 4 |
|--------|---------|---------|---------|---------|---------|
| Jan signups | 100% | 45% | 32% | 28% | 26% |
| Feb signups | 100% | 48% | 35% | 30% | -- |
| Mar signups | 100% | 52% | 38% | -- | -- |
| Apr signups | 100% | 55% | -- | -- | -- |

**What to look for**:
- Is each new cohort performing better than the previous one? (Product is improving)
- Where does the steepest drop-off occur? (Retention problem area)
- Do curves flatten? At what level? (Natural retention floor)
- Are there behavioral cohorts that retain dramatically better? (Activation insight)

**Limitations**: Requires enough data per cohort for meaningful analysis. Seasonal effects can confuse cohort patterns. Does not explain WHY behavior differs -- just reveals that it does.

## Selection Guide

| Situation | Recommended Framework | Why |
|-----------|----------------------|-----|
| Comprehensive product health | HEART | Covers UX + business + engagement |
| Team alignment on one metric | North Star Metric | Single focus, input metrics for action |
| Funnel optimization | AARRR | Identifies leakiest stage |
| Quarterly goal setting | OKRs | Outcome-focused, aligned, measurable |
| Early warning system | Leading/Lagging analysis | Predict problems before they hit |
| Understanding retention dynamics | Cohort Analysis | Reveals trends hidden by aggregates |
| Feature success measurement | HEART + Leading/Lagging | UX metrics + predictive signals |

## Sources

- Kerry Rodden, Hilary Hutchinson, and Xin Fu, "Measuring the User Experience on a Large Scale" (2010) -- HEART framework
- Sean Ellis, "The One Metric That Matters" (2010) -- North Star Metric concept
- Dave McClure, "Startup Metrics for Pirates" (2007) -- AARRR framework
- John Doerr, *Measure What Matters* (2018) -- OKRs in practice
- Andy Grove, *High Output Management* (1983) -- Original OKR practice at Intel
- Christina Wodtke, *Radical Focus* (2016) -- OKR implementation guide
- Dan Olsen, *The Lean Product Playbook* (2015) -- Metrics hierarchy and leading indicators
