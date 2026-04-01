# Circuit Breaker Skill

**Problem:** Your LLM agent keeps calling a failing provider, cascading failures across the pipeline.

**Library:** `kavacha` (Sanskrit: कवच — shield)

```bash
pip install kavacha
```

## Drop-in Example

```python
from kavacha import CircuitBreaker, CircuitOpenError

# Configure: open after 3 failures, retry after 30 seconds
breaker = CircuitBreaker(failure_threshold=3, recovery_timeout=30)

@breaker
def call_llm(prompt: str) -> str:
    """Your LLM call — circuit breaker wraps it automatically."""
    import anthropic
    client = anthropic.Anthropic()
    response = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}]
    )
    return response.content[0].text

# Use it — circuit opens after 3 consecutive failures
try:
    result = call_llm("Summarize this document")
    print(result)
except CircuitOpenError:
    # Circuit is open — fail fast, don't hammer the provider
    print("LLM provider is down, using cached response or fallback")
```

## States

- **Closed** (normal): calls pass through, failures counted
- **Open** (failing): calls rejected immediately with `CircuitOpenError`
- **Half-open** (recovering): one probe call allowed, reopens on failure

## Verification

```python
print(breaker.state)        # "closed" | "open" | "half_open"
print(breaker.failure_count) # current failure count
```

## Full docs: https://github.com/darshjme/arsenal
