import os
import json
temp_log = 'tmp_conversation.jsonl'

def write_log(lines):
    with open(temp_log, 'w') as f:
        for l in lines:
            f.write(json.dumps(l) + '\n')

def test_detect_and_credit(tmp_path, monkeypatch):
    # prepare fake log with tokens and errors
    lines = [
        {'user_id': 'alice', 'message': 'Hello', 'tokens': 10},
        {'user_id': 'alice', 'message': 'Error: Rate limit', 'tokens': 5},
        {'user_id': 'alice', 'message': 'Error: Crash', 'tokens': 7},
    ]
    log_path = tmp_path / 'conv.jsonl'
    write_log = lambda: None
    with open(log_path, 'w') as f:
        for l in lines:
            f.write(json.dumps(l) + '\n')
    from bug_credit.auto_detection import detect_bug_impacted_conversations
    from bug_credit.token_accounting import get_user_credits
    # detect and credit
    result = detect_bug_impacted_conversations(str(log_path))
    assert result == [('alice', 22)]
    assert get_user_credits('alice') == 22

def test_no_errors(tmp_path):
    lines = [
        {'user_id': 'bob', 'message': 'All good', 'tokens': 3},
        {'user_id': 'bob', 'message': 'Still fine', 'tokens': 4},
    ]
    log_path = tmp_path / 'conv2.jsonl'
    with open(log_path, 'w') as f:
        for l in lines:
            f.write(json.dumps(l) + '\n')
    from bug_credit.auto_detection import detect_bug_impacted_conversations
    from bug_credit.token_accounting import get_user_credits
    result = detect_bug_impacted_conversations(str(log_path))
    assert result == []
    assert get_user_credits('bob') == 0
