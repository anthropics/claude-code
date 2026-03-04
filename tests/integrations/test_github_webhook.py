import pytest
from integrations.github_webhook_handler import handle_github_event
from bug_credit.token_accounting import get_user_credits

def make_issue_event(labels, reporter='charlie'):
    return {
        'action': 'labeled',
        'issue': {
            'user': {'login': reporter},
            'labels': [{'name': name} for name in labels]
        }
    }

def test_credit_on_confirmed_bug(monkeypatch):
    # clear any existing
    from bug_credit.models import CREDITS
    CREDITS.clear()
    e = make_issue_event(['bug', 'confirmed'])
    handle_github_event(e)
    assert get_user_credits('charlie') == 500000

def test_no_credit_on_partial_labels(monkeypatch):
    from bug_credit.models import CREDITS
    CREDITS.clear()
    e = make_issue_event(['bug'])
    handle_github_event(e)
    assert get_user_credits('charlie') == 0
