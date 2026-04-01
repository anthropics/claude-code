# Distributed Tracing Skill

**Problem:** A 5-hop agent chain has a 30-second latency spike — you have no idea which hop caused it.

**Library:** `anusarana` (Sanskrit: अनुसरण — following to the source)

```bash
pip install anusarana
```

## Drop-in Example

```python
from anusarana import Tracer, trace

tracer = Tracer(service_name="my-agent-pipeline")

@trace(tracer=tracer, name="research-agent")
def research(query: str) -> str:
    # Your LLM call here
    return f"research result for: {query}"

@trace(tracer=tracer, name="synthesis-agent")
def synthesize(research_result: str) -> str:
    # Your LLM call here
    return f"synthesized: {research_result}"

@trace(tracer=tracer, name="pipeline")
def run_pipeline(query: str) -> str:
    result = research(query)
    final = synthesize(result)
    return final

# Run and print trace
output = run_pipeline("latest AI papers")

# Print full span graph with latencies
tracer.print_trace()
# Output:
# pipeline (342ms)
#   ├── research-agent (189ms)
#   └── synthesis-agent (153ms)
```

## Export to JSON

```python
import json
spans = tracer.export_json()
print(json.dumps(spans, indent=2))
# Full span data: name, start_time, duration_ms, error, parent_id
```

## Full docs: https://github.com/darshjme/arsenal
