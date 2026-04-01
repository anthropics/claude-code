# Reliability Audit Skill

**Problem:** Your agent code works in demos but you don't know what will fail in production.

**Audit checklist:** Ask Claude Code to run this against any agent codebase.

## Audit Procedure

When asked to audit agent code for reliability, check these 7 failure modes:

### 1. No Circuit Breaker (Cascade Risk)
```python
# ❌ Dangerous — if LLM is down, entire pipeline hangs
result = llm.complete(prompt)

# ✅ Safe with kavacha
from kavacha import CircuitBreaker
breaker = CircuitBreaker(failure_threshold=3, recovery_timeout=30)

@breaker
def safe_complete(prompt): return llm.complete(prompt)
```

### 2. No Retry on Transient Failures
```python
# ❌ One timeout = permanent failure
result = requests.post(llm_endpoint, json=payload, timeout=10)

# ✅ Retry with jitter via punarjanma
from punarjanma import retry

@retry(max_attempts=3, backoff="exponential", jitter=True)
def resilient_call(payload): ...
```

### 3. No Output Validation
```python
# ❌ LLM returns wrong schema → downstream crash
data = json.loads(llm_response)
result = data["key_that_might_not_exist"]

# ✅ Validate first with pariksha
from pariksha import validate_output
result = validate_output(llm_response, schema=MySchema)
```

### 4. No Rate Limiting
```python
# ❌ Batch of 1000 items fires all at once → 429 ban
for item in items:
    llm.complete(item)  # THUNDERING HERD

# ✅ Rate limit with maryada
from maryada import RateLimiter
limiter = RateLimiter(rate=60, per="minute")
for item in items:
    with limiter.acquire():
        llm.complete(item)
```

### 5. No Tracing
```python
# ❌ 5-hop chain fails, no idea which hop
result = hop1(hop2(hop3(hop4(query))))

# ✅ Trace with anusarana
from anusarana import trace, Tracer
tracer = Tracer()
@trace(tracer=tracer, name="hop-1")
def hop1(x): ...
```

### 6. Session State Lost Between Hops
```python
# ❌ Multi-turn context lost at hop 5
context = []  # local variable, dies on restart

# ✅ Persist with sanga
from sanga import SessionManager
sessions = SessionManager()
context = sessions.get_or_create(session_id)
```

### 7. Silent Exception Swallowing
```python
# ❌ Errors hidden, agent returns wrong answer silently
try:
    result = llm.complete(prompt)
except:
    pass  # NEVER DO THIS

# ✅ Log, alert, or re-raise
except Exception as e:
    logger.error(f"LLM call failed: {e}")
    raise  # or: return fallback_response
```

## Scoring

| Issues Found | Reliability Grade |
|---|---|
| 0 | A — Production-ready |
| 1-2 | B — Low risk, fix before scale |
| 3-4 | C — Medium risk, fix this sprint |
| 5+ | D — High risk, fix before launch |

## Full docs: https://github.com/darshjme/arsenal
