# Rate Limiting Skill

**Problem:** Burst traffic to your LLM provider triggers 429s and gets your API key banned.

**Library:** `maryada` (Sanskrit: मर्यादा — boundary/limit)

```bash
pip install maryada
```

## Drop-in Example

```python
from maryada import RateLimiter, RateLimitExceeded

# Token bucket: 60 requests per minute, burst of 10
limiter = RateLimiter(rate=60, per="minute", burst=10)

def call_llm_rate_limited(prompt: str) -> str:
    import anthropic
    
    # Acquire a token before calling
    with limiter.acquire():
        client = anthropic.Anthropic()
        response = client.messages.create(
            model="claude-opus-4-6",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.content[0].text

# Process 100 items without exceeding rate limit
items = ["item1", "item2", ...]  # your batch
results = []

for item in items:
    try:
        result = call_llm_rate_limited(f"Process: {item}")
        results.append(result)
    except RateLimitExceeded:
        # Rate limit exceeded — wait or skip
        import time
        time.sleep(1)
        results.append(None)
```

## Per-Provider Limits

```python
# Different limits per provider
openai_limiter = RateLimiter(rate=500, per="minute")
anthropic_limiter = RateLimiter(rate=50, per="minute")

# Apply correct limiter per call
def call_any_provider(provider: str, prompt: str) -> str:
    limiter = openai_limiter if provider == "openai" else anthropic_limiter
    with limiter.acquire():
        return do_llm_call(provider, prompt)
```

## Full docs: https://github.com/darshjme/arsenal
