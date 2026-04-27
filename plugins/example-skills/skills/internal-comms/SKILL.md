---
name: internal-comms
description: This skill should be used when the user asks to "write a company announcement", "draft an all-hands email", "create an internal memo", "write a team update", "draft a Slack announcement", "prepare an internal newsletter", "communicate a policy change", "write a leadership message", or create any internal company communication.
version: 1.0.0
---

# Internal Communications

This skill guides the creation of clear, effective internal communications — announcements, memos, team updates, and leadership messages.

## Communication Types

| Type | When to Use | Typical Length |
|------|-------------|---------------|
| **All-hands email** | Company-wide announcements, major changes | 300–600 words |
| **Team update** | Weekly/monthly status, project news | 150–300 words |
| **Policy memo** | Rule changes, procedure updates | 400–800 words |
| **Leadership message** | Culture, vision, morale | 200–500 words |
| **Slack announcement** | Quick updates, reminders | 50–150 words |
| **Internal newsletter** | Multi-topic roundup | 500–1,200 words |

## Gathering Information

Before drafting, collect:
- **Subject**: What specifically is being communicated?
- **Sender**: Who is this from? (Executive, manager, HR, etc.)
- **Audience**: All-company, specific team, managers only?
- **Tone**: Celebratory, matter-of-fact, urgent, empathetic?
- **Key points**: What are the 2–3 most important things to convey?
- **Action required**: Is there anything recipients need to do?
- **Timing**: When is it going out? Any deadline sensitivity?

## Structure Patterns

### Company Announcement (Good News)

```
Subject: [Clear, specific subject line]

[Opening hook — why this matters]

[Core announcement — the what and why]

[Details — how this affects the reader specifically]

[What happens next / timeline]

[Closing — appreciation or forward-looking statement]

[Sign-off]
```

### Policy/Process Change

```
Subject: Update to [Policy/Process Name] — Effective [Date]

Context: Why this change is happening (briefly)

What's changing: Clear, specific description

What's NOT changing: Reassurance about what stays the same

What you need to do: Explicit action items with deadlines

Questions: Who to contact

[Optional: FAQ for complex changes]
```

### Team Update / Weekly Digest

```
[Week of / Month of date]

Highlights:
• [Win or key update 1]
• [Win or key update 2]
• [Win or key update 3]

In progress:
• [Active work item]

Coming up:
• [Upcoming milestone or event]

Shoutouts: [Optional recognition]
```

## Tone Guidelines

### Match the Message to the Moment

**Celebratory**: Use enthusiasm, but don't overdo it — avoid hollow phrases like "super excited"
- Instead: "This is a meaningful milestone for us — here's why..."

**Change management**: Acknowledge impact, be direct, avoid corporate euphemisms
- Avoid: "We are sunsetting the program to right-size our operations"
- Better: "We're ending the program. Here's why, and here's what it means for you."

**Urgent**: Clear, short sentences. Lead with the most important information.

**Empathetic**: Acknowledge difficulty honestly without being dramatic.

## Common Pitfalls to Avoid

- **Burying the lede**: Don't make readers hunt for the key information
- **Corporate speak**: "Leverage synergies", "circle back", "bandwidth" — replace with plain language
- **Passive voice for accountability**: "Mistakes were made" → "We made a mistake"
- **Too long**: Internal comms should be skimmable — use bullets, headers, bold key phrases
- **Missing call to action**: Always be explicit about what, if anything, readers should do

## Subject Line Formulas

```
[Action required] + [Topic]: "Action Required: Update Your Benefits Selection by Friday"
[Announcement] + [Impact]: "New Flexible Work Policy — Effective March 1"
[Update] + [Scope]: "Engineering Team Update: Q1 Roadmap Review"
[Event]: "Join us: All-Hands Meeting Thursday at 2pm PT"
```

## Sensitive Communications Checklist

For difficult messages (layoffs, major changes, setbacks):
- [ ] Lead with empathy, not data
- [ ] Be direct about what's happening
- [ ] Explain the why clearly and honestly
- [ ] Address "what does this mean for me?" directly
- [ ] Provide a clear point of contact for questions
- [ ] Have legal/HR review before sending (note this to user if relevant)
- [ ] Consider timing carefully (avoid Friday afternoons, holidays)

## Output Format

Default to plain text suitable for email. For Slack, use Slack markdown:
- `*bold*` for emphasis
- Use `:emoji:` sparingly for tone
- Keep paragraphs short (2–3 sentences max for Slack)
