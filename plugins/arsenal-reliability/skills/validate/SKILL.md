# Output Validation Skill

**Problem:** LLM returns malformed JSON or wrong schema — your downstream code crashes silently.

**Library:** `pariksha` (Sanskrit: परीक्षा — evaluation/testing)

```bash
pip install pariksha
```

## Drop-in Example

```python
from pariksha import validate_output, ValidationError
from pydantic import BaseModel
from typing import List

class AnalysisResult(BaseModel):
    summary: str
    key_points: List[str]
    confidence: float  # 0.0-1.0

def analyze_document(text: str) -> AnalysisResult:
    # LLM call that returns JSON
    import anthropic
    client = anthropic.Anthropic()
    response = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=1024,
        messages=[{
            "role": "user",
            "content": f"Analyze this text and return JSON matching the schema: {text}"
        }],
        response_format={"type": "json_object"}
    )
    
    raw = response.content[0].text
    
    # Validate before returning — catches schema mismatches
    result = validate_output(raw, schema=AnalysisResult)
    return result

try:
    result = analyze_document("The model showed 95% accuracy...")
    print(f"Summary: {result.summary}")
    print(f"Confidence: {result.confidence}")
except ValidationError as e:
    print(f"LLM returned invalid schema: {e.field} — {e.message}")
    # Handle gracefully: retry, fallback, or log
```

## Full docs: https://github.com/darshjme/arsenal
