# Prompt Snippets for Opus 4.5

Only apply these snippets if the user explicitly requests them or reports a specific issue. By default, the migration should only update model strings.

## 1. Tool Overtriggering

**Problem**: Prompts designed to reduce undertriggering on previous models may cause Opus 4.5 to overtrigger.

**When to add**: User reports tools being called too frequently or unnecessarily.

**Solution**: Replace aggressive language with normal phrasing.

| Before | After |
|--------|-------|
| `CRITICAL: You MUST use this tool when...` | `Use this tool when...` |
| `ALWAYS call the search function before...` | `Call the search function before...` |
| `You are REQUIRED to...` | `You should...` |
| `NEVER skip this step` | `Don't skip this step` |

## 2. Over-Engineering Prevention

**Problem**: Opus 4.5 may create extra files, add unnecessary abstractions, or build unrequested flexibility.

**When to add**: User reports unwanted files, excessive abstraction, or unrequested features.

**Snippet to add to system prompt**:

```
- Avoid over-engineering. Only make changes that are directly requested or clearly necessary. Keep solutions simple and focused.
- Don't add features, refactor code, or make "improvements" beyond what was asked. A bug fix doesn't need surrounding code cleaned up. A simple feature doesn't need extra configurability.
- Don't add error handling, fallbacks, or validation for scenarios that can't happen. Trust internal code and framework guarantees. Only validate at system boundaries (user input, external APIs). Don't use backwards-compatibility shims when you can just change the code.
- Don't create helpers, utilities, or abstractions for one-time operations. Don't design for hypothetical future requirements. The right amount of complexity is the minimum needed for the current task. Reuse existing abstractions where possible and follow the DRY principle.
```

## 3. Code Exploration

**Problem**: Opus 4.5 may propose solutions without reading code or make assumptions about unread files.

**When to add**: User reports the model proposing fixes without inspecting relevant code.

**Snippet to add to system prompt**:

```
ALWAYS read and understand relevant files before proposing code edits. Do not speculate about code you have not inspected. If the user references a specific file/path, you MUST open and inspect it before explaining or proposing fixes. Be rigorous and persistent in searching code for key facts. Thoroughly review the style, conventions, and abstractions of the codebase before implementing new features or abstractions.
```

## 4. Frontend Design Quality

**Problem**: Default frontend outputs may look generic ("AI slop" aesthetic).

**When to add**: User requests improved frontend design quality or reports generic-looking outputs.

**Snippet to add to system prompt**:

```xml
<frontend_aesthetics>
You tend to converge toward generic, "on distribution" outputs. In frontend design, this creates what users call the "AI slop" aesthetic. Avoid this: make creative, distinctive frontends that surprise and delight.

Focus on:
- Typography: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics.
- Color & Theme: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes. Draw from IDE themes and cultural aesthetics for inspiration.
- Motion: Use animations for effects and micro-interactions. Prioritize CSS-only solutions for HTML. Use Motion library for React when available. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions.
- Backgrounds: Create atmosphere and depth rather than defaulting to solid colors. Layer CSS gradients, use geometric patterns, or add contextual effects that match the overall aesthetic.

Avoid generic AI-generated aesthetics:
- Overused font families (Inter, Roboto, Arial, system fonts)
- Clichéd color schemes (particularly purple gradients on white backgrounds)
- Predictable layouts and component patterns
- Cookie-cutter design that lacks context-specific character

Interpret creatively and make unexpected choices that feel genuinely designed for the context. Vary between light and dark themes, different fonts, different aesthetics. You still tend to converge on common choices (Space Grotesk, for example) across generations. Avoid this: it is critical that you think outside the box!
</frontend_aesthetics>
```

## 5. Thinking Sensitivity

**Problem**: When extended thinking is not enabled (the default), Opus 4.5 is particularly sensitive to the word "think" and its variants.

Extended thinking is not enabled by default. It is only enabled if the API request contains a `thinking` parameter:
```json
"thinking": {
    "type": "enabled",
    "budget_tokens": 10000
}
```

**When to apply**: User reports issues related to "thinking" while extended thinking is not enabled (no `thinking` parameter in their request).

**Solution**: Replace "think" with alternative words.

| Before | After |
|--------|-------|
| `think about` | `consider` |
| `think through` | `evaluate` |
| `I think` | `I believe` |
| `think carefully` | `consider carefully` |
| `thinking` | `reasoning` / `considering` |

## Usage Guidelines

1. **Integrate thoughtfully** - Don't just append snippets; weave them into the existing prompt structure
2. **Use XML tags** - Wrap additions in descriptive tags (e.g., `<coding_guidelines>`, `<tool_behavior>`) that match or complement existing prompt structure
3. **Match prompt style** - If the prompt is concise, trim the snippet; if verbose, keep full detail
4. **Place logically** - Put coding snippets near other coding instructions, tool guidance near tool definitions, etc.
5. **Preserve existing content** - Insert snippets without removing functional content
6. **Summarize changes** - After migration, list all model string updates and prompt modifications made
