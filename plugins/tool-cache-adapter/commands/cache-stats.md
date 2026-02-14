---
description: Show tool cache statistics (entries, sizes, per-tool counts)
allowed-tools: Bash
---

Run the following Python one-liner to display cache stats:

```
python3 -c "
import sys, os, json
sys.path.insert(0, os.path.dirname('$CLAUDE_PLUGIN_ROOT'))
sys.path.insert(0, '$CLAUDE_PLUGIN_ROOT')
from tool_cache_adapter.core.store import FileCacheStore
s = FileCacheStore()
print(json.dumps(s.stats(), indent=2))
"
```

Present the results in a readable table.
