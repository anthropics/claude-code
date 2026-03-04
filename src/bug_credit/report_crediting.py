"""
Layer 2 simplified: credit flat token reward to issue reporter
upon staff confirmation of a bug.
"""
from .token_accounting import credit_user

# Flat credit amount for confirmed bug reports
FLAT_CREDIT = 500_000

def credit_reporter(user_id: str):
    """Award flat credit to the reporter's account."""
    credit_user(user_id, FLAT_CREDIT)
