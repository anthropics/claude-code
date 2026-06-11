from datetime import datetime, timedelta

def calculate_prorated_charge(current_plan, new_plan, billing_cycle_start, upgrade_date):
    # Calculate the charge based on the remaining days in the billing cycle
    # Adjust the effective_at timestamp to be at the start of the next day
    effective_at = (upgrade_date + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    # Proration logic here
    pass