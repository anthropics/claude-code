# Discovery Methods & Frameworks

## Overview

Product discovery is the process of identifying what to build before committing engineering resources. This pack covers the major discovery methodologies, from understanding customer jobs to rapid experimentation. Reference this when planning research, validating product ideas, or deciding which discovery approach fits your situation.

## Frameworks

### Jobs-to-Be-Done (JTBD)

**When to use**: When you need to understand why customers buy or switch products, especially when existing segmentation (demographics, firmographics) does not explain behavior.

**How it works**: JTBD theory holds that customers do not buy products -- they "hire" products to make progress in their lives. A job is the progress a customer seeks in a given circumstance. Jobs are stable over time even as solutions change. Understanding the job reveals the true competitive set (which is often broader than direct competitors).

There are three dimensions to every job: **Functional** (the practical task), **Emotional** (how the customer wants to feel), and **Social** (how the customer wants to be perceived).

**Job statement format**: `When [situation], I want to [motivation], so I can [expected outcome].`

**Forces of Progress**: Four forces act on a customer's decision to switch to a new solution:
1. **Push** (dissatisfaction with current solution) -- drives switch
2. **Pull** (attraction of new solution) -- drives switch
3. **Anxiety** (fear about new solution) -- resists switch
4. **Habit** (comfort with current solution) -- resists switch

To drive adoption, you must strengthen push + pull to overcome anxiety + habit.

**Switch interview template**:
1. When did you first start looking for a solution?
2. What was happening that made you start looking?
3. What other solutions did you consider?
4. What made you choose this solution over others?
5. What almost stopped you from switching?
6. Now that you're using it, what's different?

**Template for Job Mapping**:

| Job Step | Customer Action | Desired Outcome | Current Pain |
|----------|----------------|-----------------|--------------|
| Define need | Recognize a problem exists | Quickly understand the scope | Often unaware until crisis |
| Search | Look for solutions | Find relevant options efficiently | Too many irrelevant results |
| Evaluate | Compare options | Understand tradeoffs clearly | Hard to compare apples to apples |
| Decide | Select a solution | Feel confident in choice | Fear of making wrong choice |
| Use | Apply the solution | Achieve intended outcome | Too complex, steep learning curve |
| Monitor | Track results | Know if it's working | Lack of visibility into impact |

**Limitations**: Requires skilled interviewing. Analysis can be time-consuming. Some practitioners over-complicate the framework. Works best with qualitative, in-depth interviews (not surveys).

---

### Design Thinking

**When to use**: Complex, ambiguous problems where the solution space is unclear and you need cross-functional creative collaboration.

**How it works**: Design Thinking, popularized by IDEO and Stanford d.school, is a five-phase iterative process: Empathize, Define, Ideate, Prototype, Test.

**Phase 1: Empathize** -- Immerse in the user's world through observation, interviews, and experience shadowing. Goal: deep understanding of user needs, not just stated requirements.

**Phase 2: Define** -- Synthesize empathy findings into a clear problem statement (Point of View). Format: `[User] needs [need] because [insight].`

**Phase 3: Ideate** -- Generate a wide range of possible solutions. Quantity over quality at this stage. Techniques include brainstorming, "How Might We" questions, SCAMPER, and analogous inspiration.

**Phase 4: Prototype** -- Build quick, low-fidelity representations of ideas. Paper prototypes, wireframes, service blueprints, role-playing scenarios. The goal is to make ideas tangible enough to test, not to build the final solution.

**Phase 5: Test** -- Put prototypes in front of real users. Observe, learn, iterate. Testing often leads back to earlier phases -- that is the intended behavior, not a failure.

**"How Might We" Template**:

| Insight | How Might We... |
|---------|-----------------|
| Users forget to check reports | HMW bring insights to users instead of requiring them to seek? |
| Onboarding feels overwhelming | HMW make the first experience feel like quick wins? |
| Teams work in silos | HMW make collaboration a natural byproduct of daily work? |

**Limitations**: Can be slow and resource-intensive. Sometimes used as "innovation theater" without rigor. The ideation phase can produce impractical ideas without constraints. Works best when combined with rapid experimentation.

---

### Lean Startup

**When to use**: Early-stage products, new features with high uncertainty, or any situation where you need to validate a hypothesis before investing heavily.

**How it works**: Eric Ries's Lean Startup methodology is built on the Build-Measure-Learn feedback loop. The goal is to minimize the time through this loop.

**Build**: Create the minimum viable product (MVP) -- the smallest thing you can build that tests your riskiest assumption. MVPs are not half-built products; they are experiments.

**Types of MVPs**:
- **Concierge MVP**: Deliver the service manually to a few customers to test if the value proposition works.
- **Wizard of Oz MVP**: The user sees a working product, but behind the scenes a human is doing the work.
- **Landing Page MVP**: A page describing the product with a signup button. Measures demand without building anything.
- **Video MVP**: A demo video explaining the product concept. Measures interest and comprehension.
- **Single-Feature MVP**: Build one core feature and nothing else. Test if that one thing solves the problem.

**Measure**: Define your innovation accounting metrics before building. What will you measure? What threshold indicates success or failure?

**Learn**: Based on results, decide to persevere (continue on current path) or pivot (change strategy while keeping learnings).

**Pivot triggers** (signals that current approach is not working):
- Engagement metrics are flat despite iterations
- Customer acquisition cost is not decreasing
- Retention does not improve with product changes
- Customer feedback consistently points to a different problem
- The "must-have" test shows less than 40% of users would be "very disappointed" if the product went away

**Experiment template**:

| Element | Description |
|---------|-------------|
| **Hypothesis** | We believe that [user type] will [behavior] because [reason] |
| **Riskiest assumption** | [The one thing that must be true for this to work] |
| **Experiment** | [What we'll build/do to test the assumption] |
| **Metric** | [What we'll measure] |
| **Success threshold** | [Minimum result that validates the hypothesis] |
| **Timeline** | [How long we'll run the experiment] |

**Limitations**: "MVP" is often misunderstood as "bad product." Some markets require a higher quality bar for initial launch (enterprise, healthcare). The pivot decision is often more art than science.

---

### Continuous Discovery (Torres)

**When to use**: Ongoing product development where you want to build a sustainable habit of customer-informed decision-making, not just project-based research sprints.

**How it works**: Teresa Torres's Continuous Discovery framework advocates for product teams to develop weekly habits that keep them connected to customers. The core elements:

**Weekly customer touchpoints**: Talk to at least one customer every week. These are not formal research studies -- they are lightweight, regular conversations. The consistency matters more than the depth of any single conversation.

**Opportunity Solution Trees (see next section)**: A visual structure connecting desired outcomes to opportunities (customer needs/pain points) to solutions (ideas) to experiments.

**Assumption mapping**: For every solution idea, map the assumptions it depends on. Categorize by risk and desirability/viability/feasibility/usability. Test the riskiest assumptions first.

**Compare and contrast decisions**: When evaluating solutions, always compare at least three options. Single-option analysis leads to confirmation bias.

**Weekly habits template**:

| Day | Activity |
|-----|----------|
| Monday | Review last week's learnings, plan customer conversations |
| Tuesday-Thursday | Conduct 1-2 customer conversations (15-30 min each) |
| Friday | Update Opportunity Solution Tree with new insights |
| Ongoing | Run assumption tests, review experiment results |

**Limitations**: Requires organizational commitment to provide customer access. Can be challenging in B2B with long sales cycles. The weekly cadence may not work for all team contexts.

---

### Opportunity Solution Trees (OSTs)

**When to use**: When you need to connect business outcomes to customer opportunities to solution ideas in a structured, visual way.

**How it works**: An OST is a tree structure with four levels:
1. **Desired Outcome** (top): The business/product outcome you are trying to drive (e.g., increase activation rate)
2. **Opportunities** (second level): Customer needs, pain points, or desires that, if addressed, would drive the outcome
3. **Solutions** (third level): Ideas for addressing each opportunity. Multiple solutions per opportunity.
4. **Experiments** (bottom level): Tests to validate whether a solution will work

**How to populate**:
- Start with a clear desired outcome (from roadmap, OKRs, or strategic bet)
- Interview customers to discover opportunities (use open-ended questions)
- Ideate multiple solutions for the most promising opportunities
- Design experiments to test the riskiest assumptions for each solution

**Template**:

```
DESIRED OUTCOME: Increase 30-day retention from 35% to 50%
|
+-- Opportunity: Users don't understand core value in first session
|   +-- Solution A: Guided walkthrough of key features
|   |   +-- Experiment: Prototype test with 5 users
|   +-- Solution B: Personalized onboarding based on role
|   |   +-- Experiment: Concierge test with 10 users
|
+-- Opportunity: Users lose work when session times out
|   +-- Solution C: Auto-save with visual confirmation
|   |   +-- Experiment: Usage analytics on save frequency
|   +-- Solution D: Extend session timeout + warning
|       +-- Experiment: A/B test timeout lengths
|
+-- Opportunity: Users cannot find features they need
    +-- Solution E: Contextual help system
    +-- Solution F: Improved navigation + search
```

**Limitations**: Can become unwieldy if not pruned regularly. Requires discipline to update with new learnings. The tree is a model, not reality -- some opportunities may span multiple outcomes.

---

### Customer Development (Blank)

**When to use**: Pre-product/market fit, when you are still validating whether there is a problem worth solving and a market willing to pay for a solution.

**How it works**: Steve Blank's Customer Development methodology has four steps:

**Step 1: Customer Discovery** -- Get out of the building. Talk to potential customers. Validate that the problem you think exists actually exists. Test your business model hypotheses.

**Step 2: Customer Validation** -- Attempt to sell (or get commitments for) your solution. Validate that customers will actually pay. Develop a repeatable sales process. If validation fails, pivot back to Discovery.

**Step 3: Customer Creation** -- Scale demand. Now that you know the problem is real and customers will pay, create end-user demand through marketing and sales.

**Step 4: Company Building** -- Transition from a learning organization to an execution organization.

**Interview techniques for Discovery**:
- Never pitch. Ask about their problems, not your solution.
- "Tell me about the last time you had to [problem domain]..."
- "What is the hardest part about [activity]?"
- "What solutions have you tried? What worked? What didn't?"
- "If you could wave a magic wand, what would change?"
- Pay attention to emotion and energy, not just words

**Template for Hypothesis Testing**:

| Hypothesis | Validated? | Evidence | Next Step |
|------------|-----------|----------|-----------|
| Target customers experience [problem] weekly | Yes/No/Partial | [Interview quotes, data] | [Pivot, persevere, dig deeper] |
| They currently solve it with [workaround] | Yes/No/Partial | [Evidence] | [Next step] |
| They would pay $X for a better solution | Yes/No/Partial | [Evidence] | [Next step] |
| They can be reached through [channel] | Yes/No/Partial | [Evidence] | [Next step] |

**Limitations**: Interviews can be misleading if questions are leading. "Would you buy this?" is unreliable -- behavioral signals (trying to buy, signing LOIs) are stronger. Requires rapid iteration and tolerance for ambiguity.

## Selection Guide

| Situation | Recommended Method | Why |
|-----------|-------------------|-----|
| Understanding why customers switch | JTBD Switch Interviews | Reveals true motivations |
| Complex, ambiguous problem space | Design Thinking | Structured creativity with user empathy |
| Validating a new product idea | Lean Startup (MVP) | Fastest path to learning |
| Ongoing feature development | Continuous Discovery + OSTs | Sustainable, customer-connected habits |
| Pre-product/market fit | Customer Development | Validates problem and market |
| Choosing between multiple solutions | OSTs + Assumption Testing | Structured comparison and validation |
| Innovation / new category creation | JTBD + Opportunity Scoring | Finds underserved jobs |

## Sources

- Clayton Christensen, *Competing Against Luck* (2016) -- JTBD theory
- Bob Moesta and Chris Spiek, *Demand-Side Sales 101* (2020) -- JTBD switch interviews
- Tim Brown, *Change by Design* (2009) -- Design Thinking at IDEO
- Eric Ries, *The Lean Startup* (2011) -- Build-Measure-Learn methodology
- Teresa Torres, *Continuous Discovery Habits* (2021) -- Weekly discovery practices and OSTs
- Steve Blank, *The Four Steps to the Epiphany* (2005) -- Customer Development methodology
- Ash Maurya, *Running Lean* (2012) -- Lean Canvas and systematic experimentation
