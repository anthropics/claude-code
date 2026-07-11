# Skill Script Security Scan Report

- Generated at: `2026-07-10T15:33:08.853665+00:00`
- Skills root: `/some/nonexistent`
- Marketplaces root: `/Users/naoki/Desktop/code/claude-code/fix-reproducibility-audit`
- Scanned script files: **57**
- Scanned dependency files: **0**
- Scanned files (total): **57**
- Findings: **42**

## Severity Summary

| Severity | Count |
|---|---:|
| CRITICAL | 0 |
| HIGH | 41 |
| MEDIUM | 0 |
| LOW | 1 |

## Scope Summary

| Scope | Count |
|---|---:|
| marketplace-skills | 42 |

## Findings

| Severity | Rule | Scope | File | Line | Snippet |
|---|---|---|---|---:|---|
| HIGH | `python-eval-exec` | marketplace-skills | `/Users/naoki/Desktop/code/claude-code/fix-reproducibility-audit/plugins/security-guidance/hooks/security_reminder_hook.py` | 56 | `r"\s*\.\s*exec(?:Sync)?\s*\(",` |
| HIGH | `python-eval-exec` | marketplace-skills | `/Users/naoki/Desktop/code/claude-code/fix-reproducibility-audit/plugins/security-guidance/hooks/security_reminder_hook.py` | 65 | `r"\s*(exec(?:Sync)?)(?:(?:\s+as\s+\|\s*:\s*)"` |
| HIGH | `python-eval-exec` | marketplace-skills | `/Users/naoki/Desktop/code/claude-code/fix-reproducibility-audit/plugins/security-guidance/hooks/security_reminder_hook.py` | 90 | `rf"(?<![\w$]){re.escape(alias)}\s*\.\s*exec(?:Sync)?\s*\(",` |
| HIGH | `python-eval-exec` | marketplace-skills | `/Users/naoki/Desktop/code/claude-code/fix-reproducibility-audit/plugins/security-guidance/hooks/security_reminder_hook.py` | 188 | `re.compile(r"\bchild_process\s*\.\s*exec(?:sync)?\s*\(", re.IGNORECASE),` |
| HIGH | `python-eval-exec` | marketplace-skills | `/Users/naoki/Desktop/code/claude-code/fix-reproducibility-audit/plugins/security-guidance/hooks/security_reminder_hook.py` | 189 | `# Match an imported/bare exec call, but not regex.exec(), object.exec(),` |
| HIGH | `python-eval-exec` | marketplace-skills | `/Users/naoki/Desktop/code/claude-code/fix-reproducibility-audit/plugins/security-guidance/hooks/security_reminder_hook.py` | 191 | `re.compile(r"(?<![\w.])exec(?:sync)?\s*\(", re.IGNORECASE),` |
| HIGH | `python-eval-exec` | marketplace-skills | `/Users/naoki/Desktop/code/claude-code/fix-reproducibility-audit/plugins/security-guidance/hooks/security_reminder_hook.py` | 194 | `"reminder": """⚠️ Security Warning: Using child_process.exec() can lead to command injection vulnerabilities.` |
| HIGH | `python-eval-exec` | marketplace-skills | `/Users/naoki/Desktop/code/claude-code/fix-reproducibility-audit/plugins/security-guidance/hooks/security_reminder_hook.py` | 199 | `exec(`command ${userInput}`)` |
| HIGH | `python-eval-exec` | marketplace-skills | `/Users/naoki/Desktop/code/claude-code/fix-reproducibility-audit/plugins/security-guidance/hooks/security_reminder_hook.py` | 206 | `- Uses execFile instead of exec (prevents shell injection)` |
| HIGH | `python-eval-exec` | marketplace-skills | `/Users/naoki/Desktop/code/claude-code/fix-reproducibility-audit/plugins/security-guidance/hooks/security_reminder_hook.py` | 211 | `Only use exec() if you absolutely need shell features and the input is guaranteed to be safe.""",` |
| HIGH | `python-eval-exec` | marketplace-skills | `/Users/naoki/Desktop/code/claude-code/fix-reproducibility-audit/plugins/security-guidance/hooks/security_reminder_hook.py` | 225 | `"reminder": "⚠️ Security Warning: eval() executes arbitrary code and is a major security risk. Consider using JSON.parse() for data parsing or alternative design patterns that don't require code evaluation. Only use eval() if you truly need` |
| HIGH | `js-dynamic-eval` | marketplace-skills | `/Users/naoki/Desktop/code/claude-code/fix-reproducibility-audit/tests/automation/claude-workflow-authorization.test.ts` | 18 | `const evaluate = new Function(` |
| HIGH | `js-dynamic-eval` | marketplace-skills | `/Users/naoki/Desktop/code/claude-code/fix-reproducibility-audit/tests/automation/lifecycle-label-cleanup.test.ts` | 54 | `const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;` |
| HIGH | `js-dynamic-eval` | marketplace-skills | `/Users/naoki/Desktop/code/claude-code/fix-reproducibility-audit/tests/automation/lifecycle-label-cleanup.test.ts` | 98 | `const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;` |
| HIGH | `js-dynamic-eval` | marketplace-skills | `/Users/naoki/Desktop/code/claude-code/fix-reproducibility-audit/tests/automation/lock-retry.test.ts` | 28 | `const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;` |
| HIGH | `js-dynamic-eval` | marketplace-skills | `/Users/naoki/Desktop/code/claude-code/fix-reproducibility-audit/tests/automation/marker-authorship.test.ts` | 326 | `const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;` |
| HIGH | `js-dynamic-eval` | marketplace-skills | `/Users/naoki/Desktop/code/claude-code/fix-reproducibility-audit/tests/automation/triage-command-contract.test.ts` | 59 | `const evaluate = new Function(` |
| HIGH | `js-dynamic-eval` | marketplace-skills | `/Users/naoki/Desktop/code/claude-code/fix-reproducibility-audit/tests/automation/triage-command-contract.test.ts` | 102 | `new Function(` |
| HIGH | `js-dynamic-eval` | marketplace-skills | `/Users/naoki/Desktop/code/claude-code/fix-reproducibility-audit/tests/automation/triage-command-contract.test.ts` | 263 | `const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;` |
| HIGH | `python-eval-exec` | marketplace-skills | `/Users/naoki/Desktop/code/claude-code/fix-reproducibility-audit/tests/validator-security/test_validator_security.py` | 1208 | `"const match = regex.exec(value); const x = object.eval(value);",` |
| HIGH | `python-eval-exec` | marketplace-skills | `/Users/naoki/Desktop/code/claude-code/fix-reproducibility-audit/tests/validator-security/test_validator_security.py` | 1216 | `'const cp=require("child_process"); cp.exec(userInput);',` |
| HIGH | `python-eval-exec` | marketplace-skills | `/Users/naoki/Desktop/code/claude-code/fix-reproducibility-audit/tests/validator-security/test_validator_security.py` | 1224 | `"import childProcess from 'node:child_process'; childProcess.exec(userInput);",` |
| HIGH | `python-eval-exec` | marketplace-skills | `/Users/naoki/Desktop/code/claude-code/fix-reproducibility-audit/tests/validator-security/test_validator_security.py` | 1228 | `"import cp, { spawn } from 'node:child_process'; cp.exec(userInput);",` |
| HIGH | `python-eval-exec` | marketplace-skills | `/Users/naoki/Desktop/code/claude-code/fix-reproducibility-audit/tests/validator-security/test_validator_security.py` | 1236 | `"import cp, * as child from 'node:child_process'; child.exec(userInput);",` |
| HIGH | `python-eval-exec` | marketplace-skills | `/Users/naoki/Desktop/code/claude-code/fix-reproducibility-audit/tests/validator-security/test_validator_security.py` | 1248 | `"require('child_process').exec(userInput);",` |
| HIGH | `python-eval-exec` | marketplace-skills | `/Users/naoki/Desktop/code/claude-code/fix-reproducibility-audit/tests/validator-security/test_validator_security.py` | 1261 | `self.assertIn("child_process.exec()", result.stderr)` |
| HIGH | `python-eval-exec` | marketplace-skills | `/Users/naoki/Desktop/code/claude-code/fix-reproducibility-audit/tests/validator-security/test_validator_security.py` | 1269 | `"const a = exec (input); const b = EVAL (input);",` |
| HIGH | `python-eval-exec` | marketplace-skills | `/Users/naoki/Desktop/code/claude-code/fix-reproducibility-audit/tests/validator-security/test_validator_security.py` | 1272 | `self.assertIn("child_process.exec()", first.stderr)` |
| HIGH | `python-eval-exec` | marketplace-skills | `/Users/naoki/Desktop/code/claude-code/fix-reproducibility-audit/tests/validator-security/test_validator_security.py` | 1273 | `self.assertIn("eval()", first.stderr)` |
| HIGH | `python-eval-exec` | marketplace-skills | `/Users/naoki/Desktop/code/claude-code/fix-reproducibility-audit/tests/validator-security/test_validator_security.py` | 1279 | `"const a = exec (input); const b = EVAL (input);",` |
| HIGH | `python-eval-exec` | marketplace-skills | `/Users/naoki/Desktop/code/claude-code/fix-reproducibility-audit/tests/validator-security/test_validator_security.py` | 1287 | `"const a = exec (input); const b = EVAL (input); new Function (input);",` |
| HIGH | `python-eval-exec` | marketplace-skills | `/Users/naoki/Desktop/code/claude-code/fix-reproducibility-audit/tests/validator-security/test_validator_security.py` | 1291 | `self.assertNotIn("child_process.exec()", new_rule.stderr)` |
| HIGH | `python-eval-exec` | marketplace-skills | `/Users/naoki/Desktop/code/claude-code/fix-reproducibility-audit/tests/validator-security/test_validator_security.py` | 1292 | `self.assertNotIn("eval()", new_rule.stderr)` |
| HIGH | `python-eval-exec` | marketplace-skills | `/Users/naoki/Desktop/code/claude-code/fix-reproducibility-audit/tests/validator-security/test_validator_security.py` | 1315 | `["const safe = true;", "const value = eVaL   (input);"],` |
| HIGH | `python-eval-exec` | marketplace-skills | `/Users/naoki/Desktop/code/claude-code/fix-reproducibility-audit/tests/validator-security/test_validator_security.py` | 1319 | `self.assertIn("eval()", multi_edit.stderr)` |
| HIGH | `python-eval-exec` | marketplace-skills | `/Users/naoki/Desktop/code/claude-code/fix-reproducibility-audit/tests/validator-security/test_validator_security.py` | 1327 | `"result = eval(user_input)",` |
| HIGH | `python-eval-exec` | marketplace-skills | `/Users/naoki/Desktop/code/claude-code/fix-reproducibility-audit/tests/validator-security/test_validator_security.py` | 1331 | `self.assertIn("eval()", first.stderr)` |
| HIGH | `python-eval-exec` | marketplace-skills | `/Users/naoki/Desktop/code/claude-code/fix-reproducibility-audit/tests/validator-security/test_validator_security.py` | 1337 | `"result = eval(user_input)",` |
| HIGH | `python-eval-exec` | marketplace-skills | `/Users/naoki/Desktop/code/claude-code/fix-reproducibility-audit/tests/validator-security/test_validator_security.py` | 1371 | `"eval(input);",` |
| HIGH | `python-eval-exec` | marketplace-skills | `/Users/naoki/Desktop/code/claude-code/fix-reproducibility-audit/tests/validator-security/test_validator_security.py` | 1385 | `"eval(input);",` |
| HIGH | `python-eval-exec` | marketplace-skills | `/Users/naoki/Desktop/code/claude-code/fix-reproducibility-audit/tests/validator-security/test_validator_security.py` | 1403 | `"eval(input);",` |
| LOW | `shell-missing-strict-mode` | marketplace-skills | `/Users/naoki/Desktop/code/claude-code/fix-reproducibility-audit/plugins/ralph-wiggum/scripts/ralph-state.sh` | 1 | `#!/bin/bash` |
