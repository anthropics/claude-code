# Retry with Jitter Skill

**Problem:** Transient failures (429s, timeouts, 503s) kill your agent pipeline without recovery.

**Library:** `punarjanma` (Sanskrit: पुनर्जन्म — rebirth)

```bash
pip install punarjanma
```

## Drop-in Example

```python
from punarjanma import retry, RetryExhaustedError
import anthropic

@retry(
    max_attempts=4,
    backoff="exponential",  # 1s, 2s, 4s, 8s
    jitter=True,            # full jitter prevents thundering herd
    retry_on=(anthropic.RateLimitError, anthropic.APITimeoutError)
)
def call_llm_with_retry(prompt: str) -> str:
    client = anthropic.Anthropic()
    response = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}]
    )
    return response.content[0].text

try:
    result = call_llm_with_retry("Analyze this data")
except RetryExhaustedError as e:
    print(f"All {e.attempts} attempts failed. Last error: {e.last_exception}")
```

## Why Jitter?

Without jitter, all retrying clients fire at the same time after backoff → second thundering herd. Full jitter randomizes the retry window so each client retries at a different moment.

## Verification

```bash
# Test retry behavior with a simulated failure rate
python3 -c "
from punarjanma import retry
import random

@retry(max_attempts=3, backoff='exponential', jitter=True)
def flaky():
    if random.random() < 0.7:
        raise ConnectionError('simulated failure')
    return 'success'

print(flaky())
"
```

## Full docs: https://github.com/darshjme/arsenal
