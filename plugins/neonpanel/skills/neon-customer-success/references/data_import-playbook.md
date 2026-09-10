# Data Import — Playbook

# Data Import Playbooks

1. **Template request** (`imp-template`)
   - Symptom: Need template
   - Checks: import type
   - Outcome: request template version

2. **Validation errors** (`imp-validation-errors`)
   - Symptom: File rejected
   - Checks: import job ID
   - Outcome: request validation report

3. **Partial import** (`imp-partial`)
   - Symptom: Missing rows
   - Checks: file name, missing rows
   - Outcome: request reconciliation report

4. **Format questions** (`imp-format-questions`)
   - Symptom: format requirements
   - Checks: import type
   - Outcome: request template version

5. **Reconciliation mismatch** (`imp-reconcile`)
   - Symptom: totals mismatch
   - Checks: report period
   - Outcome: request reconciliation report

6. **Repeated failures** (`imp-validation-errors`)
   - Symptom: repeated import errors
   - Checks: job IDs
   - Outcome: escalate

7. **Template version confusion** (`imp-template`)
   - Symptom: which template
   - Checks: import type
   - Outcome: request template version

8. **Missing fields** (`imp-format-questions`)
   - Symptom: required fields unclear
   - Checks: import type
   - Outcome: request template version

9. **Data mismatch after import** (`imp-reconcile`)
   - Symptom: totals mismatch
   - Checks: reconciliation report
   - Outcome: request report

10. **Row errors** (`imp-validation-errors`)
    - Symptom: row errors
    - Checks: validation report
    - Outcome: request validation report

11. **Template field guidance** (`imp-template`)
   - Symptom: column definitions or field requirements
   - Checks: import type
   - Outcome: use `template_instructions.md` to select the correct template file