"""
Basic token accounting: credit and query user balances.
"""
from .models import CREDITS

def credit_user(user_id: str, amount: int):
    """Add `amount` tokens to `user_id` balance."""
    if not user_id:
        return
    CREDITS[user_id] = CREDITS.get(user_id, 0) + amount

def get_user_credits(user_id: str) -> int:
    """Return total credited tokens for `user_id`."""
    return CREDITS.get(user_id, 0)
