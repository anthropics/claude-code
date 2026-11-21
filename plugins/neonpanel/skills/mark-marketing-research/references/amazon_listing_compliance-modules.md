# Amazon Listing Compliance — Module Map

## content-policy-rules

Amazon's Content Policy rules that govern what can and cannot appear in product listing copy — titles, bullet points, and descriptions. Covers prohibited content types such as pricing, reviews, promotional claims, ALL CAPS formatting, and cross-product references.

**Common user intents:**
- What formatting rules apply to Amazon bullets?
- Can I mention price in bullet points?
- What gets a listing suppressed?
- Are ALL CAPS allowed in bullets?
- Can I reference reviews or ratings in copy?

**Common confusions:**
- Thinking ALL CAPS headers in bullets are acceptable for emphasis — they violate Amazon policy
- Including price mentions in bullets — prices differ by seller and change over time
- Referencing star ratings or review counts — these are dynamic and not allowed in static copy
- Adding promotional claims like 'Save 10%' in titles — Amazon prohibits promotional language in titles

**Key objects:** Bullet point formatting rules, Title formatting rules, Prohibited content types, Amazon Content Policy, Listing suppression triggers

## marketplace-accuracy

Ensuring factual accuracy in listing copy for the target marketplace — correct unit conversions (metric vs imperial), marketplace-appropriate measurements, and avoiding cross-product references. Includes a mandatory unit conversion validation step with reference conversion factors and reverse-check verification to prevent errors like stating 0.2 inches = 2mm.

**Common user intents:**
- What units should I use for US Amazon listings?
- How do I convert mm to inches correctly?
- Can I reference other products in my listing?
- What measurement format does Amazon US expect?
- Is this conversion correct?
- Validate my product dimensions

**Common confusions:**
- Incorrectly converting metric to imperial (e.g., claiming 0.2 inch = 2mm when 0.2 inch = 5.08mm)
- Relying on memory or estimation instead of calculating conversions with exact factors
- Rounding conversions too aggressively, changing the actual measurement
- Using metric units on US marketplace listings where imperial is standard
- Referencing competitor products or other ASINs in bullet copy
- Assuming product specs from one marketplace apply to another

**Artifacts to request:**
- Original product specifications with units
- Manufacturer documentation for dimension verification

**Key objects:** Unit conversion reference table, Conversion validation step, Reverse-check verification, US marketplace standards (inches, ounces, Fahrenheit), Metric to imperial conversion factors (1 in = 25.4 mm, 1 oz = 29.5735 ml, 1 lb = 0.4536 kg), Cross-product reference policy, Factual accuracy requirements, Known error patterns (e.g., 0.2 in ≠ 2 mm)

## pre-submission-validation

The self-validation checklist the agent must run against all generated listing copy before presenting it to the user. Covers every known compliance rule including a mandatory unit conversion verification step to catch errors before the user sees them.

**Common user intents:**
- Check my listing copy for compliance
- Validate these bullet points
- Does this title meet Amazon requirements?
- Review my listing before submission
- Are my measurements accurate?

**Common confusions:**
- Skipping validation because the copy 'looks fine'
- Only checking some rules instead of the full checklist
- Assuming compliance rules are suggestions rather than requirements
- Not verifying unit conversions because the numbers 'seem right'

**Key objects:** Compliance checklist, Pre-submission review, Violation detection, Copy validation steps, Listing quality gate, Unit conversion verification gate
