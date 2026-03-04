"""
Handle GitHub webhooks for labeling events to credit reporters.
"""
import json
from bug_credit.report_crediting import credit_reporter

def handle_github_event(event_json: dict):
    """
    Process GitHub 'labeled' events: if an issue has both 'bug' and 'confirmed',
    credit the reporter with a flat token reward.
    """
    action = event_json.get('action')
    if action != 'labeled':
        return
    issue = event_json.get('issue', {})
    labels = [lbl.get('name') for lbl in issue.get('labels', [])]
    # check both labels present
    if 'bug' in labels and 'confirmed' in labels:
        reporter = issue.get('user', {}).get('login')
        if reporter:
            credit_reporter(reporter)
