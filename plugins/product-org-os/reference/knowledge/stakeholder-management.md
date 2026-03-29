# Stakeholder Management Frameworks & Methods

## Overview

Stakeholder management is a core product leadership skill. It determines whether your strategy gets support, your decisions stick, and your launches succeed. This pack covers frameworks for influence mapping, decision authority, executive communication, and cross-functional alignment. Reference this when navigating organizational dynamics, planning communications, or any deliverable involving stakeholder coordination.

## Frameworks

### Influence Mapping (Power/Interest Grid)

**When to use**: When you need to understand the stakeholder landscape for a decision, initiative, or project, and tailor your engagement approach accordingly.

**How it works**: Map each stakeholder on two dimensions: **Power** (ability to influence the outcome) and **Interest** (level of concern about the outcome). The quadrant determines your engagement strategy.

| | High Interest | Low Interest |
|---|---|---|
| **High Power** | **Manage Closely**: Key players. Regular engagement, co-create solutions. These are your sponsors and blockers. | **Keep Satisfied**: Powerful but not engaged. Keep them informed enough that they don't become negative surprises. |
| **Low Power** | **Keep Informed**: Interested but not influential. Regular updates, use them as advocates. | **Monitor**: Minimal effort. Periodic awareness check. |

**Template**:

| Stakeholder | Role | Power (1-5) | Interest (1-5) | Quadrant | Engagement Strategy |
|-------------|------|------------|----------------|----------|---------------------|
| [Name] | VP Engineering | 5 | 4 | Manage Closely | Weekly 1:1, co-design solution |
| [Name] | Legal Counsel | 4 | 2 | Keep Satisfied | Monthly summary, flag risks early |
| [Name] | Customer Success Lead | 2 | 5 | Keep Informed | Bi-weekly update, gather feedback |
| [Name] | HR Director | 2 | 1 | Monitor | Quarterly awareness |

**Advanced: Stakeholder dynamics**:
- Map who influences whom (dotted lines between stakeholders)
- Identify coalition potential (which stakeholders naturally align)
- Note veto power (some stakeholders can block without having positive influence)
- Track sentiment: Supportive, Neutral, Resistant

**Limitations**: Power and Interest are not static -- they shift as situations evolve. Must be updated regularly for long-running initiatives. Can feel "political" -- frame it as "understanding needs" rather than "managing people."

---

### RACI, DACI, and RAPID

**When to use**: When you need to clarify who decides, who does the work, who must be consulted, and who needs to know. Especially critical for cross-functional decisions.

**RACI**:
- **R**esponsible: Does the work
- **A**ccountable: Final decision-maker (one person only)
- **C**onsulted: Input required before decision
- **I**nformed: Told after decision

**DACI** (Atlassian variant):
- **D**river: Responsible for orchestrating the process
- **A**pprover: Final decision-maker
- **C**ontributor: Provides input
- **I**nformed: Needs to know

**RAPID** (Bain variant):
- **R**ecommend: Proposes the decision
- **A**gree: Must agree for it to proceed (potential veto)
- **P**erform: Executes the decision
- **I**nput: Provides information
- **D**ecide: Has final authority

**When to use which**:

| Framework | Best For | Key Advantage |
|-----------|----------|---------------|
| RACI | Operational processes, repeating workflows | Simple, widely understood |
| DACI | Project-based decisions, cross-team initiatives | Distinguishes driver from approver |
| RAPID | High-stakes strategic decisions, complex orgs | Explicitly handles veto power (Agree) |

**RACI template**:

| Activity/Decision | PM | Engineering | Design | Marketing | Executive |
|-------------------|----|-------------|--------|-----------|-----------|
| Feature prioritization | A | C | C | I | I |
| Technical architecture | C | A | I | I | I |
| UI specifications | C | C | A | I | I |
| Launch messaging | I | I | C | A | I |
| Pricing decision | C | I | I | C | A |

**Common mistakes**:
- Multiple "A"s for one decision (no clear owner)
- No "A" at all (decision orphan)
- Confusing "R" and "A" (the doer is not always the decider)
- Everyone as "C" (consultation bottleneck)
- Not communicating the RACI to all parties

**Limitations**: RACI does not account for veto power or informal influence. It can feel bureaucratic if over-applied. Best used for the 10-15 most important recurring decisions, not every minor choice.

---

### Executive Communication

**When to use**: Any time you need to communicate with senior leaders (C-suite, VPs, board members) -- status updates, proposals, escalations, or strategic recommendations.

**The Pyramid Principle** (Barbara Minto): Start with the conclusion/recommendation, then provide supporting arguments, then supporting data. Executives want the "so what" first, details second.

**Structure**:
```
1. RECOMMENDATION (1-2 sentences)
   "I recommend we [action] because [one-line rationale]."

2. SUPPORTING ARGUMENTS (3-4 bullets)
   - Argument 1 + key evidence
   - Argument 2 + key evidence
   - Argument 3 + key evidence

3. RISKS & MITIGATIONS (if applicable)
   - Risk + mitigation plan

4. ASK (what you need from them)
   - Decision, resource, alignment
```

**One-pager format**:

| Section | Content | Length |
|---------|---------|--------|
| Title | [Initiative name] | 1 line |
| Summary | What, why, so what | 2-3 sentences |
| Recommendation | Clear ask | 1-2 sentences |
| Context | Key background | 3-4 bullets |
| Options considered | What else was evaluated | 2-3 options with tradeoffs |
| Risks | What could go wrong | 2-3 bullets |
| Next steps | What happens if approved | 2-3 bullets |
| Appendix | Detailed data (optional, separate page) | As needed |

**Status update format** (for recurring exec updates):

| Element | Format |
|---------|--------|
| **Health** | Green / Yellow / Red + 1 line explanation |
| **Key metric** | [Metric]: [Value] (vs. target of [Value]) |
| **Progress** | What was accomplished since last update (2-3 bullets) |
| **Risks** | Active risks with mitigation status (1-2 bullets) |
| **Decisions needed** | If any (1 bullet max) |
| **Next milestone** | What's coming and when (1 line) |

**Communication rules**:
- Lead with the conclusion, not the journey
- Never surprise an executive -- pre-wire important topics
- Match their communication preference (email, Slack, 1:1)
- Quantify impact: revenue, customers, time, cost
- Propose solutions, not just problems

**Limitations**: Oversimplification risks losing important nuance. The Pyramid Principle works for recommendations but not exploratory discussions. Pre-wiring takes time but prevents meeting failure.

---

### Managing Up

**When to use**: When you need to influence decisions made by people above you in the hierarchy, or when you need to keep your leadership aligned and supportive.

**Framework for managing executive expectations**:

1. **Understand their priorities**: What is your exec measured on? What keeps them up at night? Align your work narrative to their priorities.

2. **Communicate proactively**: Bad news delivered early is a "heads-up." Bad news delivered late is a "surprise." Proactive communicators build trust.

3. **Bring options, not problems**: When escalating, present 2-3 options with your recommendation. "Here's the situation, here are the options, I recommend Option B because..."

4. **Calibrate cadence**: Understand how much information they want and how often. Some execs want weekly updates; others want to hear from you only when something changes.

5. **Build a track record**: Deliver on small commitments consistently. Trust compounds over time.

**Influence strategies by stakeholder type**:

| Stakeholder Type | What Motivates Them | How to Influence |
|------------------|--------------------|--------------------|
| Data-driven exec | Numbers, evidence | Lead with metrics, show analysis |
| Vision-driven exec | Big picture, narrative | Connect to strategy, paint the future |
| Risk-averse exec | Stability, predictability | Emphasize risk mitigation, show precedent |
| Action-oriented exec | Speed, results | Lead with recommendation, minimize preamble |
| Relationship-driven exec | Trust, team health | Invest in 1:1s, show team impact |

**Escalation framework**:

| Escalation Level | When | To Whom | Format |
|-----------------|------|---------|--------|
| Heads-up | Risk identified, no action needed yet | Direct manager | Slack/email |
| Guidance | Need input on direction | Direct manager + stakeholder | 1:1 meeting |
| Decision | Can't resolve at your level | Decision-maker per RACI | Structured proposal |
| Intervention | Blocked, needs authority above your level | Skip-level or exec sponsor | Escalation brief |

**Limitations**: Managing up can be perceived as political. Balance influence with transparency. Never withhold bad news -- that destroys trust.

---

### Cross-functional Alignment

**When to use**: When multiple teams must coordinate on a shared initiative, especially across product, engineering, marketing, sales, and customer success.

**Meeting cadences and their purposes**:

| Meeting | Cadence | Purpose | Attendees | Output |
|---------|---------|---------|-----------|--------|
| Sprint planning | Biweekly | Commit to deliverables | Product + Engineering | Sprint backlog |
| Product review | Weekly | Review progress, remove blockers | Product + Engineering + Design | Decisions, updated status |
| GTM sync | Biweekly | Align launch activities | Product + Marketing + Sales | Launch timeline |
| Stakeholder update | Monthly | Inform on progress and direction | Cross-functional leadership | Status report |
| Strategic review | Quarterly | Assess strategy and adjust | Executive + Product Leadership | Strategic adjustments |

**Decision forums**:
- **Operational decisions**: Product review (weekly) -- PM decides
- **Cross-team conflicts**: PM Director escalation -- Dir PM decides
- **Strategic tradeoffs**: Leadership review -- VP Product decides
- **Portfolio changes**: Exec review -- CPO/CEO decides

**Alignment checklist for cross-functional initiatives**:
- [ ] Single accountable owner identified (not a team)
- [ ] RACI documented for top 5 decisions
- [ ] Meeting cadence established with clear purpose
- [ ] Communication channel defined (Slack channel, email list)
- [ ] Escalation path clear (who resolves what level of conflict)
- [ ] Dependencies mapped between teams
- [ ] Success metrics agreed across functions
- [ ] Review/retrospective scheduled

**Limitations**: Alignment processes can become coordination overhead. Keep meetings purposeful. Cancel any regular meeting where the agenda is consistently empty.

---

### Change Management (Kotter's 8 Steps, adapted for Product Orgs)

**When to use**: When introducing significant process changes, organizational restructuring, or new ways of working in a product organization.

**Kotter's 8 steps, product org adaptation**:

| Step | Original (Kotter) | Product Org Adaptation |
|------|-------------------|------------------------|
| 1 | Create urgency | Show the data: customer feedback, competitive threat, or missed metrics that demand change |
| 2 | Form a guiding coalition | Get 2-3 influential leaders (not just your manager) to champion the change |
| 3 | Create a vision for change | Define the "after state" clearly: how work will be different and better |
| 4 | Communicate the vision | Use multiple channels: all-hands, 1:1s, written docs, Slack |
| 5 | Empower action | Remove obstacles: give teams permission, tools, and time to adopt the change |
| 6 | Create quick wins | Pilot with one team, show measurable improvement, then expand |
| 7 | Build on the change | Don't declare victory after the pilot. Systematize and scale. |
| 8 | Anchor in culture | Incorporate into hiring, onboarding, performance reviews |

**Change resistance template**:

| Resistance Source | Likely Reason | Mitigation |
|-------------------|---------------|------------|
| Engineering leads | "More process = less building" | Show how change reduces rework, not adds overhead |
| Senior PMs | "This worked fine before" | Involve them in designing the change (co-ownership) |
| Executives | "Is this necessary?" | Quantify the cost of current state, show competitive evidence |
| New hires | "Confused by dual systems" | Clear documentation, onboarding path |

**Limitations**: Real change takes longer than planned. Expect 6-12 months for meaningful culture shifts, not 6-12 weeks. Resistance is natural, not a sign of failure.

## Selection Guide

| Situation | Recommended Framework | Why |
|-----------|----------------------|-----|
| New initiative, unclear stakeholders | Influence Mapping | Identify who matters and how to engage |
| Decision authority is unclear | RACI/DACI/RAPID | Clarify who decides and who contributes |
| Presenting to executives | Pyramid Principle + one-pager | Match exec communication style |
| Need to influence up | Managing Up framework | Structured approach to building trust |
| Cross-functional coordination | Alignment cadence + RACI | Prevent coordination chaos |
| Major organizational change | Kotter's 8 steps | Systematic change management |

## Sources

- Barbara Minto, *The Pyramid Principle* (1987) -- Structured executive communication
- Colin Eden and Fran Ackermann, *Making Strategy* (1998) -- Stakeholder mapping
- John Kotter, *Leading Change* (1996) -- 8-step change management
- Patty Azzarello, *Rise* (2012) -- Managing up and executive influence
- RACI model -- Various sources, widely used in project management since the 1950s
- Bain & Company, RAPID Decision Framework (2001) -- Decision rights framework
