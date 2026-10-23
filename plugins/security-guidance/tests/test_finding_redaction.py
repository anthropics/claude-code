"""Findings are fed back into the main conversation and kept in session
state; a hardcoded-secret finding quotes the secret itself. These tests pin
that credential-shaped values are masked at every formatting and storage
boundary while code quotes and location strings survive
(anthropics/claude-code#96276, the reporter's Stop-hook case).

Run: python3 -m unittest discover -s plugins/security-guidance/tests -v
"""

import os
import sys
import tempfile
import time
import unittest
from unittest import mock

HOOKS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "hooks")
sys.path.insert(0, HOOKS_DIR)

_tmp_state = tempfile.mkdtemp(prefix="sg-test-state-")
os.environ.setdefault("SECURITY_WARNINGS_STATE_DIR", _tmp_state)
os.environ.setdefault("SECURITY_GUIDANCE_DEBUG_LOG", os.path.join(_tmp_state, "log.txt"))

import llm  # noqa: E402
import review_api  # noqa: E402
import security_reminder_hook  # noqa: E402

MARKER = "SG_FAKE_MARKER_A2_7f3a91"
SECRET_FINDING = {
    "filePath": "secrets.yml",
    "category": "Hardcoded Secrets",
    "vulnerableCode": f"password: {MARKER}",
    "explanation": "A plaintext credential is committed to the working tree.",
    "fix": f"Move {MARKER} into a secret manager and read it from the environment.",
    "severity": "high",
}
SQLI_FINDING = {
    "filePath": "app.py",
    "category": "SQL Injection",
    "vulnerableCode": 'cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")',
    "explanation": "user_id flows from the request into the query string.",
    "fix": "Use a parameterized query: cursor.execute(sql, (user_id,)).",
    "severity": "high",
}


def R(text, category="Hardcoded Secrets"):
    return review_api.redact_secret_values(text, category=category)


class MaskedValuesTests(unittest.TestCase):
    def test_reporter_case_keeps_key_and_masks_value(self):
        self.assertEqual(R(f"password: {MARKER}"), "password: ****91")
        self.assertEqual(R(f"db:\n  host: db.example.invalid\n  password: {MARKER}"),
                         "db:\n  host: db.example.invalid\n  password: ****91")

    def test_bare_marker_in_fix_prose_is_masked_for_secret_findings(self):
        out = R(f"Move {MARKER} out of secrets.yml")
        self.assertNotIn(MARKER, out)
        self.assertEqual(out, "Move ****91 out of secrets.yml")

    def test_quoted_value_is_masked_whole_whatever_it_contains(self):
        # Punctuation, spaces and brackets inside the quotes must not cut the mask short.
        self.assertEqual(R("SECRET_KEY = 'django-insecure-)x7@k!p#q2wz&8'"), "SECRET_KEY = '****&8'")
        self.assertEqual(R("password: 'my secret pass phrase'"), "password: '****se'")
        self.assertEqual(R('api_key = "abcd1234<efgh5678>ijkl"', "SSRF"), 'api_key = "****kl"')

    def test_config_line_bare_value_is_masked_to_end_of_line(self):
        for text, want in (
            ("password: correct horse battery staple", "password: ****le"),
            ("  - password: correct horse  # dev only", "  - password: ****se  # dev only"),
            ("+  password: prodpassword", "+  password: ****rd"),  # quoted `+` diff line
            ("secrets.yml:3:  password: prodpassword", "secrets.yml:3:  password: ****rd"),
            ("export API_TOKEN=abcdefgh1", "export API_TOKEN=****h1"),
            ("DB_PASSWORD=SUPERSECRET99", "DB_PASSWORD=****99"),
            ("PGPASSWORD=s3cretvalue psql -h db", "PGPASSWORD=****ue psql -h db"),
            ("PASSWORD=hunter2\nUSER=bob", "PASSWORD=****\nUSER=bob"),
        ):
            with self.subTest(text=text):
                self.assertEqual(R(text, "X"), want)

    def test_key_forms(self):
        for text, want in (
            ("app.config['SECRET_KEY'] = 'p9Zxnotsosecret'", "app.config['SECRET_KEY'] = '****et'"),
            ("$config['db']['password'] = 'Pr0duction!';", "$config['db']['password'] = '****n!';"),
            ("password => 'perlish123'", "password => '****23'"),
            ('{"password": "hunter2", "user": "bob"}', '{"password": "****", "user": "bob"}'),
            ("<password>hunter22x</password>", "<password>****2x</password>"),
            ("X-Api-Key: abcd1234efgh", "X-Api-Key: ****gh"),
            ("mysql --password=hunter2 -u root", "mysql --password=**** -u root"),
            ("if token == 'abc123secret':", "if token == '****et':"),
            ('if (token === "abc123") {', 'if (token === "****") {'),
            ('if password != "S3cr3tAdm1n":', 'if password != "****1n":'),
            ('password: str = "hunter2"', 'password: str = "****"'),
            ('const apiKey: string = "abcd1234efgh5678";', 'const apiKey: string = "****78";'),
            ('key = b"0123456789abcdef"', 'key = b"0123456789abcdef"'),  # `key` alone is not a credential name
            ('password = b"hunter2xyz"', 'password = b"****yz"'),
            ("app.secret_key = 'super secret key'", "app.secret_key = '****ey'"),
            ("self.api_key = 'abcdefgh1234'", "self.api_key = '****34'"),
            ("password: cGFzc3dvcmQ=", "password: ****Q="),  # base64, not a type annotation
            ('password = "ABCDEF123456"', 'password = "****56"'),  # a quoted RHS is a literal
            ('token = "Zq9.Lm3xTv8pQw2n"', 'token = "****2n"'),
            ("--token abcdef123456 --verbose", "--token ****56 --verbose"),
            ("-H 'X-Api-Key: abcdefghijklmnop'", "-H 'X-Api-Key: ****op'"),
            ("ENV DB_PASSWORD s3cret", "ENV DB_PASSWORD ****"),
            ("POSTGRES_PASSWORD: postgrespass", "POSTGRES_PASSWORD: ****ss"),
            ("db.password=changeitplease", "db.password=****se"),
        ):
            with self.subTest(text=text):
                self.assertEqual(R(text, "Insecure Configuration"), want)

    def test_known_token_shapes_masked_in_any_category(self):
        for value in (
            "sk_live_DUMMYENVMARKER111abc",
            "AKIAABCDEFGHIJKLMNOP",
            "ghp_abcdefghijklmnopqrstuvwx0123456789",
            "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnop",
        ):
            with self.subTest(value=value):
                out = R(f"requests.get(url + '{value}')", "SSRF")
                self.assertNotIn(value, out)
                self.assertIn("****" + value[-2:], out)

    def test_http_credentials(self):
        self.assertEqual(R('connect("postgres://admin:s3cr3tpass@db/prod")', "SQL Injection"),
                         'connect("postgres://admin:****ss@db/prod")')
        self.assertEqual(R("redis://:sup3rs3cretlongvalue99@cache.internal:6379/0", "SSRF"),
                         "redis://:****99@cache.internal:6379/0")
        self.assertEqual(R("mongodb://root:P@ssw0rd!2024@mongo:27017/db", "SSRF"),
                         "mongodb://root:****24@mongo:27017/db")
        self.assertEqual(R('{"Authorization": "Bearer abcdEFGH1234ijkl"}', "SSRF"),
                         '{"Authorization": "Bearer ****kl"}')
        self.assertEqual(R('{"Authorization": "Basic YWRtaW46cGFzc3dvcmQ="}', "SSRF"),
                         '{"Authorization": "Basic ****Q="}')
        self.assertEqual(R("Authorization: Token 9944b09199c62bcf9418ad846dd0e4bbdfc6ee4b", "IDOR"),
                         "Authorization: Token ****4b")
        self.assertEqual(R("curl -u admin:Passw0rd! https://host/api", "Command Injection"),
                         "curl -u admin:****d! https://host/api")
        self.assertEqual(R("curl --user 'admin:Passw0rd!' https://host/api", "Command Injection"),
                         "curl --user 'admin:****d!' https://host/api")

    def test_private_key_bodies_are_dropped(self):
        for kind in ("RSA PRIVATE KEY", "PRIVATE KEY", "PGP PRIVATE KEY BLOCK"):
            pem = f"-----BEGIN {kind}-----\nlQOYBGRk3xkBCAC7n0v9Zq1mX2pL8sT4uY\nabcd\n-----END {kind}-----"
            with self.subTest(kind=kind):
                out = R(pem, "Key management")
                self.assertNotIn("lQOYBGRk", out)
                self.assertIn(f"-----BEGIN {kind}-----", out)

    def test_positional_secret_in_secret_category(self):
        out = R("client = Client('AKIAABCDEFGHIJKLMNOP', 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY')",
                "Hardcoded AWS credentials")
        self.assertEqual(out, "client = Client('****OP', '****EY')")
        self.assertEqual(R("jwt.decode(tok, 'mysupersecretkey', algorithms=['HS256'])", "Hardcoded JWT secret"),
                         "jwt.decode(tok, '****ey', algorithms=['HS256'])")
        self.assertEqual(R('API_KEYS = ["key1abcdx", "key2efghx"]'), 'API_KEYS = ["****dx", "****hx"]')
        self.assertEqual(R('if ("Adm1nP@ssw0rd!" == pw) {'), 'if ("****d!" == pw) {')
        self.assertEqual(R("Rotate wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY now"), "Rotate ****EY now")


class UnmaskedTextTests(unittest.TestCase):
    """The finding must still say where the problem is."""

    def test_code_quotes_survive(self):
        for code, category in (
            (SQLI_FINDING["vulnerableCode"], "SQL Injection"),
            ("subprocess.run(cmd, shell=True)", "Command Injection"),
            ("password_hash = bcrypt.hashpw(pw, salt)", "Weak crypto"),
            ("password = derive_key(salt)", "Hardcoded Secrets"),
            ("token = await getToken()", "Hardcoded Secrets"),
            ("auth_token=request.args['t']", "IDOR"),
            ("token = request.headers['X-Token']", "Hardcoded Secrets"),
            ("if token == expected:", "Timing attack"),
            ("password: ${DB_PASS}", "Hardcoded Secrets"),
            ("<password>${DB_PASS}</password>", "Hardcoded Secrets"),
            ('logger.debug("password=" + password)', "Secrets in logs"),
            ('pw = getpass.getpass("Password: ")', "Hardcoded Secrets"),
        ):
            with self.subTest(code=code):
                self.assertEqual(R(code, category), code)

    def test_fix_advice_survives(self):
        for text in (
            "Replace with password = os.environ['DB_PASSWORD']",
            "const apiKey = process.env.API_KEY;",
            "os.environ.get('DB_PASSWORD')",
            "Rotate the password: anyone with repo access already has it",
            "Credentials: move the database password into the environment and rotate it.",
            "Token: see line 12 of auth.py",
            "const t = fetchOAuth2AccessTokenForUser(req)",
            "see commit 9944b09199c62bcf9418ad846dd0e4bbdfc6ee4b",
            'password_file = "/run/secrets/db"',
            "--password $DB_PASS",
            "Move the value out of `config/database.yml` (use `bin/rails credentials:edit`)",
            "client.get_secret_value(SecretId='prod/db')['SecretString']",
            "Replace with `process.env.STRIPE_SECRET_KEY` from `.env.production`",
            'headers = {"Content-Type": ctype, "X-Api-Key": key}',
        ):
            with self.subTest(text=text):
                self.assertEqual(R(text, "Hardcoded Secrets"), text)
        self.assertEqual(R("os.environ.get('DB_PASSWORD', 'changeme123')"),
                         "os.environ.get('DB_PASSWORD', '****23')")

    def test_locations_survive_in_secret_findings(self):
        for text in (
            "config/settings_v2.py, /api/v1/auth/login endpoint",
            "src/server/routes/auth2fa.ts — POST /api/v2/sessions",
            "deploy/k8s/prod-secrets-2024.yaml",
            "see 'src/Components/App.tsx' and '/etc/app/conf'",
            "config/secrets.yml:12",
            "src/auth/token.py:45 — GET /api/v2/users/12345/tokens",
            "`docker-compose.prod.yml`",
        ):
            with self.subTest(text=text):
                self.assertEqual(R(text, "Hardcoded credential"), text)

    def test_credential_metadata_keys_are_not_values(self):
        for text, category in (
            ("OAUTH_CALLBACK = 'https://attacker.example.net/cb'", "Open Redirect"),
            ("auth_url = 'http://sso.example.com/login'", "Cleartext Transmission"),
            ("author_id = 12345", "IDOR"),
            ("PASSWORD_RESET_TIMEOUT = 259200", "Auth"),
            ("MAX_TOKENS = 4096", "LLM"),
            ("Require bearer authentication on this route", "Missing Authentication"),
        ):
            with self.subTest(text=text):
                self.assertEqual(R(text, category), text)

    def test_token_named_categories_that_are_not_about_secret_values(self):
        for text, category in (
            ('<form action="/transfer/confirm2" method="POST">', "CSRF token missing"),
            ("fetch('/api/v1/users/delete', {method: 'POST'})", "Missing CSRF token"),
            ("headers['X-CSRF-Token'] = getCookie('csrftoken')", "CSRF Token"),
            ("user = User.objects.get(reset_token=request.GET['t'])", "Password reset token not invalidated"),
        ):
            with self.subTest(text=text):
                self.assertEqual(R(text, category), text)

    def test_non_string_fields_do_not_raise(self):
        self.assertEqual(R(None), "")
        self.assertEqual(R(12345, ["Secrets"]), "12345")
        out = review_api.format_findings([{"filePath": "a", "category": ["Secrets"], "vulnerableCode": 7,
                                          "fix": None, "severity": "high"}])
        self.assertIn("[['Secrets']] 7", out)

    def test_hostile_input_stays_linear(self):
        # The quoted code comes from the repository under review, so no input
        # shape may make the scan quadratic: 4x the input stays well under
        # 16x the time.
        def timed(probe):
            started = time.perf_counter()
            R(probe, "Hardcoded Secrets")
            return time.perf_counter() - started

        for unit in ("auth.", "token-", "a", "'b", "a:", " ", "\t", "=", "x.]", '"'):
            with self.subTest(unit=unit):
                small = min(timed(unit * 2500) for _ in range(3))
                large = min(timed(unit * 10000) for _ in range(3))
                self.assertLess(large, small * 10 + 0.02)


class BoundaryTests(unittest.TestCase):
    """Every block that reaches the main conversation, and the state file,
    goes through the mask."""

    def test_guidance_block_masks_secret_but_keeps_location(self):
        out = llm._format_vulns_guidance([SQLI_FINDING, SECRET_FINDING])
        self.assertNotIn(MARKER, out)
        self.assertIn("secrets.yml:", out)
        self.assertIn("[Hardcoded Secrets] password: ****91", out)
        self.assertIn("Suggested fix: Move ****91 into a secret manager", out)
        self.assertIn(SQLI_FINDING["vulnerableCode"], out)  # code quote untouched
        self.assertEqual(out, review_api.format_findings([SQLI_FINDING, SECRET_FINDING]))

    def test_concerns_review_masks_evidence_line(self):
        analysis = {
            "hasConcerns": True,
            "concerns": [{
                "category": "Hardcoded credential",
                "area": "secrets.yml",
                "concern": f"Confirm whether {MARKER} is a live credential.",
                "evidenceLine": f"  password: {MARKER}",
                "severity": "high",
            }],
        }
        with mock.patch.object(llm, "HAS_API_CREDENTIALS", True), \
                mock.patch.object(llm, "_call_claude_dual_or", return_value=analysis):
            out = llm.analyze_security_concerns([("secrets.yml", f"+  password: {MARKER}\n")], is_diff=True)
        self.assertIsNotNone(out)
        self.assertNotIn(MARKER, out)
        self.assertIn("secrets.yml", out)
        self.assertIn("Evidence:   password: ****91", out)

    def test_state_snapshot_stores_masked_code(self):
        snap = security_reminder_hook._finding_snapshot(SECRET_FINDING)
        self.assertEqual(snap, {"filePath": "secrets.yml", "category": "Hardcoded Secrets",
                                "vulnerableCode": "password: ****91"})


if __name__ == "__main__":
    unittest.main()
