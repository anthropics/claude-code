---
description: Start FULL mode workflow for complex features with planning and memory
---

# FULL Mode Workflow

Starting FULL mode for complex development (token budget: ~8-15K).

**Best for:**
- Multi-file features (5+ files)
- Architectural decisions
- Multi-session work

**6-Phase Workflow:**

1. **Load Standards:** `rlm_shared_context()` - Get team coding standards
2. **Recall Context:** `rlm_recall("$ARGUMENTS")` - Check previous decisions
3. **Query Docs:** `rlm_context_query("$ARGUMENTS", max_tokens=8000)` - Deep context
4. **Plan:** `rlm_plan("$ARGUMENTS")` - Generate execution plan
5. **Implement:** Code, test, iterate chunk-by-chunk
6. **Remember:** `rlm_remember(type="context")` - Save progress for next session

Start by loading team standards and recalling previous context for "$ARGUMENTS".
