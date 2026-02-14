---
description: Clear all cached tool results
allowed-tools: Bash
---

Run the following Python one-liner to clear the cache:

```
python3 -c "
import sys, os
sys.path.insert(0, os.path.dirname('$CLAUDE_PLUGIN_ROOT'))
sys.path.insert(0, '$CLAUDE_PLUGIN_ROOT')
from tool_cache_adapter.core.store import FileCacheStore
s = FileCacheStore()
n = s.clear()
print(f'Cleared {n} cached entries.')
"
```

Report the number of entries cleared.
