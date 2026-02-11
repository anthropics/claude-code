# Context Layer

The Context Layer provides **persistent memory** for your AI product organization. It enables decisions to be remembered, agents to share context, and the organization to learn from outcomes.

## Folder Structure

```
context/
├── documents/          # Strategic documents registry (AUTO-POPULATED)
│   └── index.md        # Master list of all skill-generated documents
├── decisions/          # Decision registry - all major decisions
│   ├── index.md        # Master list with quick lookup
│   └── [YYYY]/         # Individual records by year
├── bets/               # Strategic bet registry
│   ├── index.md        # Master list of all bets
│   └── [YYYY]/         # Individual bets by year
├── assumptions/        # Assumption tracker
│   └── registry.md     # All assumptions with validation status
├── portfolio/          # Current state
│   └── active-bets.md  # What we're currently betting on (includes V2V phase tracking)
├── learnings/          # Accumulated wisdom
│   └── index.md        # Indexed learnings from retrospectives
├── feedback/           # Customer and market feedback
│   ├── index.md        # Master feedback registry
│   ├── themes.md       # Identified feedback themes
│   └── [YYYY]/         # Individual feedback records by year
├── principles/         # Operating principles tracking
│   ├── README.md       # Principles overview and usage
│   └── scorecard.md    # Periodic principle adherence assessment
└── handoffs/           # Agent-to-agent context
    └── current-session.md  # Active session context
```

## Quick Start

### Save context after a decision
```
/context-save
```

### Recall past context before making a decision
```
/context-recall [topic]
```

### View current portfolio state
```
/portfolio-status
```

### Pass context to another agent
```
/handoff
```

### Find relevant past learnings
```
/relevant-learnings [topic]
```

### Check initiative V2V phase
```
/phase-check [initiative]
```

### Validate commitment readiness
```
/commitment-check [initiative]
```

### Capture feedback
```
/feedback-capture
```

### Query feedback history
```
/feedback-recall [topic]
```

## V2V Phase Tracking

The portfolio tracks initiatives by V2V phase:

| Phase | Name | Key Activities |
|-------|------|----------------|
| 1 | Strategic Foundation | Market analysis, competitive intelligence, vision |
| 2 | Strategic Decisions | Business case, pricing, positioning, bet formulation |
| 3 | Strategic Commitments | Roadmap, GTM, requirements, commitment validation |
| 4 | Coordinated Execution | Launch, campaigns, sales enablement |
| 5 | Business Outcomes | Value realization, customer health, outcomes |
| 6 | Learning Loop | Retrospectives, outcome reviews, learnings |

Use `/phase-check [initiative]` to assess where an initiative stands.

## Principles Tracking

The `principles/` folder tracks adherence to the 8 Operating Principles:

1. End-to-End Ownership
2. Decision Quality
3. Customer Obsession
4. Clarity and Confidence
5. Outcomes Over Outputs
6. Collaborative Excellence
7. Continuous Learning
8. Scalable Systems

Update `principles/scorecard.md` after outcome reviews to track improvement.

## How It Works

1. **Auto-registration**: All skill outputs are automatically registered to `context/documents/index.md` (no action needed)
2. **After decisions/bets**: Also use `/context-save` to extract to decision/bet registries
3. **Before new work**: Use `/context-recall` to check what's been decided before
4. **For delegation**: Use `/handoff` to brief the receiving agent
5. **For learning**: Retrospectives and outcome reviews feed into the learnings index

## Auto-Registration (New in v2.3)

When any skill produces a strategic document and writes it to the filesystem, the system automatically:

1. Registers the document in `context/documents/index.md`
2. Captures metadata (title, type, skill used, date, owner, location, tags)
3. Links to related decisions/bets if mentioned

**This happens silently** - no prompting required. You can always query what documents exist using `/context-recall [topic]` or by reading `context/documents/index.md`.

## v3 Features

### Auto-Context Injection
When agents create deliverables, relevant context is automatically injected based on topic matching. No manual `/context-recall` needed for common patterns. See `rules/auto-context.md`.

### Cross-Reference Graph
Context entries link to each other. When you recall a decision, you also see related bets, feedback, and learnings. See `rules/context-graph.md`.

### Structured Indexes
The context index (`index.json`) supports multi-dimensional queries: by topic, product, V2V phase, status, source, and sentiment. This enables faster and more precise context retrieval.

## Maintenance

- Index files contain summaries only (stay small)
- Full records stored separately by year
- Handoff file is overwritten each session
- Archive old records annually to `archive/[YYYY]/`
