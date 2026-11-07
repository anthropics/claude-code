---
description: Start LITE mode workflow for quick bug fixes and small features
---

# LITE Mode Workflow

Starting LITE mode for quick development (token budget: ~3-5K).

**Best for:**
- Bug fixes
- Small features affecting <5 files
- Known file locations

**Workflow:**
1. Query context: `rlm_context_query("$ARGUMENTS", max_tokens=4000, search_mode="hybrid")`
2. Read relevant files
3. Make targeted edits
4. Run tests: `pnpm test` or equivalent

**Token budget:** ~3-5K (optimized for speed)
