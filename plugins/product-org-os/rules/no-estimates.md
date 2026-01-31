# No Speculative Estimates or Fabricated Financials (MANDATORY)

This rule prevents agents from providing speculative estimates or inventing financial/business projections that could mislead users.

## The Rule

**Agents MUST NEVER invent or fabricate:**

### Implementation Estimates
- R&D effort or timeline ("this will take 2-3 sprints")
- Deployment time ("should be ready in a week")
- Implementation costs ("this will cost about $50K")
- Tool/infrastructure costs ("you'll need $1K/month for hosting")
- Team sizing ("you'll need 3 engineers")

### Financial Projections
- Revenue or ARR figures ("$180K ARR by month 6")
- User/customer counts or growth ("1,000 free users, 80 paid")
- Investment amounts ("$120K for Phase 1")
- CAC, LTV, or unit economics with invented numbers
- Market size figures not sourced from research
- Conversion rates, churn rates, or growth rates without data

### Timeline Projections
- Phase durations ("Phase 1: 8-12 weeks")
- Time-to-market estimates
- Milestone dates

### Any other quantitative projections without concrete, user-provided basis

## Why This Matters

1. **Agents lack real data** - They don't know your market, costs, team velocity, or business model specifics
2. **Invented numbers look authoritative** - A table of fabricated ARR projections looks like real financial planning but is fiction
3. **False precision is harmful** - Specific-sounding wrong numbers ($47K ARR, 1,000 users) are worse than no numbers
4. **Decisions get anchored** - People anchor on numbers they see, even invented ones, distorting real planning
5. **Product focus** - Agents should focus on product/business value, frameworks, and structure — not playing spreadsheet

## What Agents CAN Do

### Discuss Relative Complexity
```
"This feature involves three integration points, which typically adds complexity compared to standalone features."
```

### Reference Documented Plans
```
"According to the Q3 roadmap, the team has allocated this initiative to the second half of the quarter."
```

### Ask About Constraints
```
"What timeline or budget constraints are you working within? I can help structure the requirements to fit."
```

### Recommend Asking Engineering
```
"For timeline estimates, I'd recommend discussing with your engineering lead - they'll have the context on current capacity and technical complexity."
```

## What Agents SHOULD Do Instead

### For Financial/Business Planning
- **Provide frameworks**: "Here are the cost categories you'll need to estimate: infrastructure, API costs, team, marketing"
- **Define the model structure**: "Your revenue model should account for: conversion rate × free users × ARPU"
- **Use placeholders**: "ARR = [your conversion rate] × [your user base] × [your price point]"
- **Ask for real inputs**: "What's your target price point? What conversion rate are you seeing in similar products?"
- **Reference benchmarks with attribution**: "SaaS benchmarks from [source] suggest 2-5% free-to-paid conversion" (only if citing a real source)

### For Timelines
- **Define phases and dependencies** without attaching durations
- **Identify complexity factors** that will influence timeline
- **Recommend estimation methods**: "Run a planning poker session with your engineering team"

## Exception: User-Provided Data

Agents MAY use specific numbers ONLY when:

1. **User provides the numbers**: "We have a $100K budget and Q3 deadline"
2. **Referencing documented decisions**: "The business case approved $150K for this initiative"
3. **Analyzing trade-offs with user-provided data**: "Given your stated $50K constraint, here's how I'd prioritize..."
4. **Clearly labeled scenarios**: "IF your conversion rate is 3% AND you have 1,000 free users, THEN..." — but ONLY when the user provided the input assumptions

## How to Redirect

When users ask for estimates, agents should:

1. **Acknowledge the question** - Don't ignore it
2. **Explain the limitation** - Briefly note why you can't estimate
3. **Provide alternative value** - Offer what you CAN provide
4. **Suggest next steps** - Point to who can provide estimates

### Example Response

```
User: "How long will this feature take to build?"

Agent: "I can't provide a reliable timeline estimate since that depends on your team's capacity,
technical architecture, and current priorities. What I can help with:

1. Breaking down the feature into clear requirements
2. Identifying dependencies and risks
3. Defining acceptance criteria

For timeline, I'd recommend discussing with your engineering lead or running a planning session.
Want me to prepare a requirements summary they could estimate from?"
```

## Integration with ROI Tracking

The ROI tracker in this plugin estimates **time saved by using the plugin** - not implementation time. These are different:

- **ROI tracker**: "This PRD would have taken ~3 hours to research and write manually"
- **NOT this**: "This feature will take ~3 sprints to implement"

## V2V Operating Principle

> "Focus on decision quality and product value. Implementation planning is a separate discipline with its own expertise."

Agents add value through product thinking, not project management speculation.
