# User Research Frameworks & Methods

## Overview

User research grounds product decisions in evidence about real user behavior, needs, and pain points. This pack covers the major research methods, from qualitative interviews to quantitative testing. Reference this when planning research studies, designing surveys, running usability tests, or any deliverable that requires evidence about user experience.

## Frameworks

### User Interviews

**When to use**: When you need deep, qualitative understanding of user needs, behaviors, motivations, or decision-making processes. Best for exploratory research and problem discovery.

**Types**:
- **Structured**: Fixed questions in fixed order. Good for consistency across many interviews. Limited depth.
- **Semi-structured**: Prepared guide with room for follow-up. Best balance of consistency and depth. This is the recommended default.
- **Unstructured**: Open conversation around a topic. Good for very early exploration. Hard to analyze across interviews.

**Interview guide design** (semi-structured):

| Section | Duration | Purpose | Example Questions |
|---------|----------|---------|-------------------|
| Warm-up | 3 min | Build rapport, set context | "Tell me about your role and a typical day." |
| Context | 5 min | Understand current state | "Walk me through the last time you [task]." |
| Core exploration | 15 min | Deep dive into behavior and needs | "What was the hardest part? What happened next?" |
| Specific probes | 5 min | Test specific hypotheses | "Have you ever tried [approach]? What happened?" |
| Wrap-up | 2 min | Open floor, get referrals | "Is there anything I should have asked that I didn't?" |

**Bias avoidance**:
- Never ask "Would you use this?" (hypothetical behavior is unreliable)
- Ask about past behavior: "Tell me about the last time you..."
- Avoid leading questions: "Don't you think X is a problem?" becomes "How do you feel about X?"
- Don't show your solution until you understand their problem
- Silence is a tool -- let them fill the gap

**Analysis template**:

| Participant | Key Quote | Behavior Observed | Need/Pain Point | Opportunity |
|-------------|-----------|-------------------|-----------------|-------------|
| P1 | "I spend 30 min every morning just..." | Manual process, workaround | Automation of [task] | [Idea] |
| P2 | | | | |

**Sample size**: 5-8 interviews per user segment typically reveals 80% of major themes (Nielsen/Landauer saturation model). Continue until you stop hearing new themes.

**Limitations**: What people say vs. what they do can differ. Interviews reveal stated preferences, not always actual behavior. Combine with observation or analytics for full picture.

---

### Survey Design

**When to use**: When you need to quantify attitudes, preferences, or behaviors across a larger population. Best for validation research after qualitative exploration.

**Question types and when to use them**:

| Type | Format | When to Use | Example |
|------|--------|-------------|---------|
| Likert scale | 1-5 or 1-7 agreement | Measuring attitudes, satisfaction | "I find this product easy to use" (Strongly disagree - Strongly agree) |
| Multiple choice | Select one or many | Categorization, preferences | "Which feature do you use most often?" |
| Ranking | Order items by preference | Relative priority | "Rank these features from most to least important" |
| Open-ended | Free text | Capturing qualitative context | "What is the biggest challenge you face with [task]?" |
| NPS | 0-10 scale | Loyalty / satisfaction benchmark | "How likely are you to recommend [product] to a colleague?" |
| CES | 1-7 scale | Task-specific effort | "How easy was it to [complete task]?" |

**Survey design principles**:
1. Start with your research questions -- what decisions will this data inform?
2. Keep it short: 5-10 minutes max. Every additional minute reduces completion rate.
3. Lead with easy questions, put sensitive/complex questions in the middle
4. Use consistent scales throughout
5. Avoid double-barreled questions: "How satisfied are you with speed and reliability?" -- split into two questions
6. Pilot with 5-10 people before launching broadly

**Statistical significance quick reference**:

| Confidence Level | Margin of Error | Min Sample Size (large pop.) |
|-----------------|-----------------|------------------------------|
| 90% | +/- 5% | 270 |
| 95% | +/- 5% | 385 |
| 95% | +/- 3% | 1,068 |
| 99% | +/- 5% | 664 |

**Template**:

| Question | Type | Scale | Purpose |
|----------|------|-------|---------|
| Q1: Role and company size | Multiple choice | N/A | Segmentation |
| Q2: How often do you use [product]? | Multiple choice | Daily/Weekly/Monthly/Rarely | Usage frequency |
| Q3: How satisfied are you with [feature]? | Likert | 1 (Very unsatisfied) - 5 (Very satisfied) | Feature satisfaction |
| Q4: What is the biggest challenge? | Open-ended | N/A | Qualitative context |
| Q5: NPS | 0-10 | Standard NPS | Benchmark |

**Limitations**: Response bias (people who respond are not representative of all users). Survey fatigue reduces response rates over time. Cannot capture "why" as deeply as interviews. Poorly written questions invalidate results.

---

### Usability Testing

**When to use**: When you need to evaluate whether users can actually complete tasks with your product or prototype. Best for validating design decisions before development.

**Types**:
- **Moderated**: A facilitator guides the participant through tasks in real-time (in-person or remote). Allows probing and follow-up. Better for complex flows.
- **Unmoderated**: Participant completes tasks independently, recorded by software (UserTesting, Maze, etc.). Faster, cheaper, larger sample. Better for straightforward tasks.

**Task design principles**:
- Write tasks as scenarios, not instructions: "You need to invite a colleague to your project" not "Click the invite button"
- Include 4-6 key tasks per session
- Start with an easy task (builds confidence)
- End with the most critical task (freshest attention)
- Allow 45-60 minutes for moderated sessions

**Metrics**:

| Metric | What It Measures | How to Capture |
|--------|-----------------|----------------|
| **Task completion rate** | Effectiveness | % of users who complete each task successfully |
| **Time on task** | Efficiency | Time from task start to completion |
| **Error rate** | Error-proneness | Number of errors per task |
| **SUS (System Usability Scale)** | Overall usability | Post-test 10-item questionnaire (score 0-100) |
| **SEQ (Single Ease Question)** | Per-task difficulty | "How easy was it to complete this task?" (1-7) |
| **Think-aloud observations** | Qualitative understanding | Notes from participant narration |

**SUS (System Usability Scale)** -- 10 questions, alternate positive and negative:
1. I think I would like to use this system frequently
2. I found the system unnecessarily complex
3. I thought the system was easy to use
4. I think I would need support to use this system
5. I found the functions were well integrated
6. I thought there was too much inconsistency
7. I imagine most people would learn this quickly
8. I found the system very cumbersome
9. I felt very confident using the system
10. I needed to learn a lot before I could get going

Scoring: For odd items, subtract 1 from score. For even items, subtract score from 5. Sum all adjusted scores, multiply by 2.5. Result is 0-100. Average SUS score is 68; above 80 is excellent.

**Sample size**: 5 users find approximately 85% of usability problems (Nielsen). For quantitative metrics, 20+ users are needed.

**Usability test plan template**:

| Element | Detail |
|---------|--------|
| Research question | What are we trying to learn? |
| Participants | [Number], [segment], [recruitment method] |
| Tasks | [4-6 key tasks as scenarios] |
| Metrics | [Completion rate, time, SUS, qualitative] |
| Prototype/version | [What they will test -- link or version] |
| Session format | Moderated/Unmoderated, duration, tools |
| Analysis plan | How we will synthesize findings |

**Limitations**: Lab behavior differs from real usage. 5 users find most issues but cannot quantify severity. Prototype testing may miss issues that emerge with real data.

---

### Card Sorting

**When to use**: When you need to understand how users categorize and group information, particularly for information architecture (navigation, menu structure, content organization).

**Types**:
- **Open card sort**: Users group items into categories and name the categories themselves. Use when you don't know what the categories should be.
- **Closed card sort**: Users sort items into predefined categories. Use when you want to validate an existing category structure.
- **Hybrid**: Users sort into predefined categories but can create new ones if items don't fit.

**How to run**:
1. Write each item (feature, page, content type) on a card (physical or digital tool like Optimal Workshop, UXtweak)
2. 30-60 cards is typical. More than 60 causes fatigue.
3. Ask participants to group cards in a way that makes sense to them
4. For open sorts: ask them to name each group
5. Analyze: look for agreement on groupings (dendrograms, similarity matrices)

**Analysis methods**:
- **Similarity matrix**: Shows how often any two items were placed in the same group
- **Dendrogram**: Hierarchical clustering of items based on grouping agreement
- **Category names**: Common names reveal user mental models

**Template**:

| Card | Most Common Group | Agreement % | Secondary Group | Notes |
|------|------------------|-------------|-----------------|-------|
| "Invite teammate" | Settings/Team | 75% | Getting Started | Users see this as both admin and onboarding |
| "Export report" | Reports | 90% | | Strong agreement |
| "API key" | Settings | 45% | Developer Tools | Split opinion -- may need both paths |

**Sample size**: 15-20 participants for reliable patterns in open sorts. 30+ for closed sorts (quantitative validation).

**Limitations**: Sorting cards is not the same as navigating a product. Card sorts inform structure but should be validated with tree testing or prototype testing.

---

### Tree Testing

**When to use**: When you need to validate whether your information architecture (navigation, menu structure) allows users to find what they are looking for, without the influence of visual design.

**How it works**: Present users with a text-only tree (your navigation hierarchy) and give them tasks: "Where would you find [item]?" Users navigate the tree to find the answer. No visual design, no content -- just structure.

**Metrics**:

| Metric | Definition | Target |
|--------|-----------|--------|
| Task success rate | % who find the correct location | > 70% |
| Directness | % who navigate straight to the answer (no backtracking) | > 50% |
| Time to complete | Seconds to find the answer | Varies by depth |
| First click | Where users start navigating (reveals mental model) | Majority starts in correct branch |

**Template**:

| Task | Correct Path | Success Rate | Directness | Common Wrong Path |
|------|-------------|-------------|------------|-------------------|
| "Change your password" | Settings > Account > Security | 85% | 70% | Profile > Account |
| "View monthly report" | Analytics > Reports > Monthly | 60% | 35% | Dashboard > Reports |

**Sample size**: 50+ users for statistically meaningful results. Can be run quickly and cheaply with remote tools (Optimal Workshop Treejack).

**Limitations**: Tests structure only, not findability with search, visual cues, or context. Results may differ from actual product navigation.

---

### A/B Testing Frameworks

**When to use**: When you need to choose between two (or more) design/feature alternatives and can measure the difference quantitatively with real users.

**Hypothesis format**: "If we [change], then [metric] will [improve/change] by [amount], because [rationale]."

**Test design**:

| Element | Requirement |
|---------|-------------|
| Hypothesis | Clear, specific, measurable |
| Control | Current version (A) |
| Variant | Changed version (B) |
| Primary metric | One metric that determines success |
| Guardrail metrics | Metrics that must not degrade (e.g., performance, error rate) |
| Sample size | Calculate based on desired MDE and significance |
| Duration | Long enough for statistical significance AND full business cycles |

**Sample size estimation** (simplified):

| Minimum Detectable Effect (MDE) | Baseline Conversion | Approx. Sample Per Variant |
|---------------------------------|---------------------|----------------------------|
| 5% relative change | 10% | ~31,000 |
| 10% relative change | 10% | ~8,000 |
| 20% relative change | 10% | ~2,000 |
| 5% relative change | 50% | ~6,400 |

Use an online calculator (e.g., Evan Miller's) for precise estimates. These numbers assume 80% power and 95% significance.

**Statistical significance**: A result is statistically significant when the probability that it occurred by chance (p-value) is below your threshold (typically p < 0.05). This means there is less than a 5% chance the observed difference is due to random variation.

**Common mistakes**:
- Peeking at results before the test is complete (increases false positive rate)
- Running too many variants (requires larger samples)
- Not accounting for weekday/weekend variation
- Declaring "no difference" with insufficient sample size (underpowered test)
- Changing the primary metric after seeing results

**Limitations**: Requires sufficient traffic. Cannot test major concept changes (too big for A/B). Optimizes locally, not globally (a better button does not fix a broken funnel).

---

### Diary Studies

**When to use**: When you need to understand behavior over time (days, weeks), especially for habitual tasks, longitudinal pain points, or context-dependent usage.

**How it works**: Participants record their experiences in real-time over an extended period (typically 1-4 weeks). Entries can be structured prompts or free-form. Tools include dedicated apps (dscout, Indeemo) or simple forms.

**Setup**:
1. Define the behavior/context you want to study
2. Design entry prompts (3-5 questions per entry, 2-5 minutes to complete)
3. Recruit 10-15 participants (expect 20-30% dropout)
4. Brief participants clearly on expectations
5. Run for 1-4 weeks with periodic check-ins
6. Conduct exit interviews to explore diary entries

**Entry prompt template**:

| Prompt | Purpose |
|--------|---------|
| "What did you just do?" | Capture the activity |
| "What was the goal?" | Understand intent |
| "How did it go?" (1-5 scale) | Measure satisfaction |
| "What was frustrating or surprising?" | Surface pain points |
| "Take a screenshot or photo" | Capture context |

**Analysis approach**:
- Code entries by theme (pain points, goals, workarounds)
- Map behavioral patterns over time
- Identify triggers and contexts
- Look for moments of high/low satisfaction

**Limitations**: Participant burden leads to dropout and declining entry quality. Self-reporting is inherently biased. Requires strong participant motivation. Analysis is labor-intensive.

## Selection Guide

| Situation | Recommended Method | Why |
|-----------|-------------------|-----|
| Understanding user needs (early stage) | User Interviews (semi-structured) | Depth, nuance, "why" behind behavior |
| Quantifying attitudes/preferences | Survey | Scale, statistical validation |
| Evaluating design before building | Usability Testing (moderated) | Finds problems before they're expensive |
| Validating at scale | Usability Testing (unmoderated) | Speed and volume |
| Designing navigation/IA | Card Sort + Tree Test | Reveals mental models, validates structure |
| Choosing between alternatives | A/B Testing | Data-driven decision with real users |
| Understanding behavior over time | Diary Study | Captures longitudinal, contextual behavior |
| Quick validation of a concept | 5-user usability test | Fast, finds 85% of problems |

## Sources

- Steve Portigal, *Interviewing Users* (2013) -- User interview methodology
- Erika Hall, *Just Enough Research* (2013) -- Practical research methods
- Jeff Sauro, *A Practical Guide to the System Usability Scale* (2011) -- SUS methodology
- Jakob Nielsen, "Why You Only Need to Test with 5 Users" (2000) -- Usability testing sample size
- Donna Spencer, *Card Sorting* (2009) -- Card sorting methodology
- Ron Kohavi, Diane Tang, and Ya Xu, *Trustworthy Online Controlled Experiments* (2020) -- A/B testing methodology
- Teresa Torres, *Continuous Discovery Habits* (2021) -- Integrating research into weekly practice
