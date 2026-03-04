"""
Layer 1: auto-detect bug-impacted conversation logs,
estimate wasted tokens and credit users automatically.
"""
import json
from .token_accounting import credit_user

def detect_bug_impacted_conversations(log_path: str):  # returns list of (user_id, wasted_tokens)
    """
    Parse JSONL conversation at `log_path`, look for >=2 consecutive errors,
    credit the user for all tokens in the log as wasted tokens.
    """
    try:
        with open(log_path, 'r') as f:
            messages = [json.loads(line) for line in f if line.strip()]
    except Exception:
        return []
    errors = []
    consec = 0
    # simple heuristic: two consecutive error messages
    for msg in messages:
        text = msg.get('message', '') or ''
        if 'error' in text.lower():
            consec += 1
        else:
            consec = 0
        if consec >= 2:
            user_id = msg.get('user_id') or msg.get('user') or 'unknown'
            wasted = sum(m.get('tokens', 0) for m in messages)
            credit_user(user_id, wasted)
            errors.append((user_id, wasted))
            break
    return errors
