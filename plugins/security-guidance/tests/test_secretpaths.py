"""Regression tests for anthropics/claude-code#96276: the reviewer must not
put files the session's Read deny/ask rules cover (or well-known secret
files) into a review prompt, and its SDK sub-agents must carry the same
rules as disallowed_tools.

Run: python3 -m unittest discover -s plugins/security-guidance/tests -v
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import types
import unittest

HOOKS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "hooks")
sys.path.insert(0, HOOKS_DIR)

_tmp_state = tempfile.mkdtemp(prefix="sg-test-state-")
os.environ["SECURITY_WARNINGS_STATE_DIR"] = _tmp_state
os.environ["SECURITY_GUIDANCE_DEBUG_LOG"] = os.path.join(_tmp_state, "log.txt")

import gitutil  # noqa: E402
import llm  # noqa: E402
import secretpaths  # noqa: E402

SHELL_TOOLS = ["Bash"] + (["PowerShell"] if sys.platform == "win32" else [])


def tearDownModule():
    shutil.rmtree(_tmp_state, ignore_errors=True)


def _diff(*paths):
    """A minimal unified diff touching each path with one added line."""
    out = []
    for p in paths:
        out.append(
            f"diff --git a/{p} b/{p}\n"
            f"--- a/{p}\n+++ b/{p}\n"
            "@@ -0,0 +1,1 @@\n"
            f"+value_for_{p.replace('/', '_')} = \"DUMMY-SECRET\"\n"
        )
    return "".join(out)


class _Env:
    """Isolated project, config and managed dirs; restores env and module state."""

    def __init__(self, project_settings=None, user_settings=None, local_settings=None,
                 managed_settings=None):
        self.project_settings = project_settings
        self.user_settings = user_settings
        self.local_settings = local_settings
        self.managed_settings = managed_settings

    def __enter__(self):
        self._saved = dict(os.environ)
        self._saved_managed_dir = secretpaths._managed_settings_dir
        self.root = os.path.realpath(tempfile.mkdtemp(prefix="sg-test-"))
        self.project = os.path.join(self.root, "project")
        self.config = os.path.join(self.root, "config-dir")
        self.managed = os.path.join(self.root, "managed")
        os.makedirs(os.path.join(self.project, ".claude"))
        os.makedirs(self.config)
        os.makedirs(os.path.join(self.managed, "managed-settings.d"))
        secretpaths._managed_settings_dir = lambda: self.managed
        if self.managed_settings is not None:
            with open(os.path.join(self.managed, "managed-settings.d", "10-sec.json"), "w") as f:
                json.dump(self.managed_settings, f)
        if self.project_settings is not None:
            with open(os.path.join(self.project, ".claude", "settings.json"), "w") as f:
                json.dump(self.project_settings, f)
        if self.local_settings is not None:
            with open(os.path.join(self.project, ".claude", "settings.local.json"), "w") as f:
                json.dump(self.local_settings, f)
        if self.user_settings is not None:
            with open(os.path.join(self.config, "settings.json"), "w") as f:
                json.dump(self.user_settings, f)
        os.environ["CLAUDE_CONFIG_DIR"] = self.config
        os.environ["CLAUDE_PROJECT_DIR"] = self.project
        os.environ.pop("SG_SKIP_SECRET_FILES", None)
        secretpaths.load_for_session(self.project)
        return self

    def __exit__(self, *exc):
        os.environ.clear()
        os.environ.update(self._saved)
        secretpaths._managed_settings_dir = self._saved_managed_dir
        secretpaths.load_for_session(None)
        shutil.rmtree(self.root, ignore_errors=True)


class DiffFilterTests(unittest.TestCase):
    DIFF = _diff(
        "app.py",
        "config/prod.json",         # denied by Read(./config/**)
        "docs/config/notes.json",   # also denied: Claude Code reads `x/**` as `x`, any depth
        "docs/settings/ui.json",    # Read(./settings/*.json) is anchored: NOT denied
        "private/report.json",      # ask rule Read(/private/**) → excluded
        "secrets.yaml",             # well-known secret store name
        "deploy/credentials",       # well-known secret store name (extensionless)
        "keys/server.pem",          # already non-reviewable by extension
        "src/secrets.py",           # code that handles secrets: reviewable
    )

    def _reviewed(self):
        return [p for p, _ in gitutil.parse_diff_into_files(self.DIFF)]

    def test_denied_and_secret_files_are_dropped_from_review_diff(self):
        settings = {"permissions": {"deny": ["Read(./config/**)", "Read(./settings/*.json)",
                                             "Bash(curl:*)"],
                                    "ask": ["Read(/private/**)"]}}
        with _Env(project_settings=settings):
            self.assertEqual(
                self._reviewed(),
                ["app.py", "docs/settings/ui.json", "src/secrets.py"],
            )

    def test_opt_out_restores_secret_named_files_but_not_denied_ones(self):
        settings = {"permissions": {"deny": ["Read(./config/**)"]}}
        with _Env(project_settings=settings):
            os.environ["SG_SKIP_SECRET_FILES"] = "0"
            self.assertEqual(
                self._reviewed(),
                ["app.py", "docs/settings/ui.json", "private/report.json",
                 "secrets.yaml", "deploy/credentials", "src/secrets.py"],
            )

    def test_no_settings_still_skips_well_known_secret_files(self):
        with _Env():
            reviewed = self._reviewed()
            self.assertIn("config/prod.json", reviewed)
            self.assertNotIn("secrets.yaml", reviewed)
            self.assertNotIn("deploy/credentials", reviewed)

    def test_bare_read_deny_excludes_everything(self):
        with _Env(local_settings={"permissions": {"deny": ["Read"]}}):
            self.assertEqual(self._reviewed(), [])

    def test_user_settings_slash_rule_anchors_at_config_dir_not_project(self):
        # `/x` in user settings means <config dir>/x, so it must not hide the
        # project's reports/ — but `~/` and `//` rules reach anywhere.
        user = {"permissions": {"deny": ["Read(/reports/**)", "Read(//**/vault/*.json)"]}}
        with _Env(user_settings=user):
            reviewed = [p for p, _ in gitutil.parse_diff_into_files(
                _diff("reports/q3.json", "app/vault/keys.json", "app.py"))]
            self.assertEqual(reviewed, ["reports/q3.json", "app.py"])

    def test_managed_dropin_rules_and_utf8_bom_are_honored(self):
        with _Env(managed_settings={"permissions": {"deny": ["Read(/private/**)"]}}) as env:
            # PowerShell 5 writes settings.json with a BOM; Claude Code strips it.
            with open(os.path.join(env.project, ".claude", "settings.json"), "w", encoding="utf-8-sig") as f:
                json.dump({"permissions": {"deny": ["Read(./config/**)"]}}, f)
            secretpaths.load_for_session(env.project)
            reviewed = self._reviewed()
            self.assertNotIn("private/report.json", reviewed)
            self.assertNotIn("config/prod.json", reviewed)
            self.assertIn("app.py", reviewed)

    def test_empty_patterns_match_nothing_instead_of_everything(self):
        with _Env(project_settings={"permissions": {"deny": ["Read(./)", "Read(/)", "Read(~/)"]}}):
            self.assertIn("app.py", self._reviewed())

    def test_worktree_session_reads_local_settings_at_canonical_root(self):
        with _Env() as env:
            git = ["git", "-c", "user.email=t@example.com", "-c", "user.name=t"]
            run = lambda *a, cwd=env.project: subprocess.run([*git, *a], cwd=cwd, check=True,
                                                             capture_output=True)
            run("init", "-q")
            run("commit", "-q", "--allow-empty", "-m", "init")
            worktree = os.path.join(env.root, "wt")
            run("worktree", "add", "-q", worktree)
            # Claude Code keeps settings.local.json at the main repo root.
            with open(os.path.join(env.project, ".claude", "settings.local.json"), "w") as f:
                json.dump({"permissions": {"deny": ["Read(./config/**)"]}}, f)
            os.environ["CLAUDE_PROJECT_DIR"] = worktree
            secretpaths.load_for_session(worktree)
            self.assertNotIn("config/prod.json", self._reviewed())
            self.assertIn("app.py", self._reviewed())

    def test_malformed_settings_file_is_ignored(self):
        with _Env() as env:
            with open(os.path.join(env.project, ".claude", "settings.json"), "w") as f:
                f.write("{not json")
            secretpaths.load_for_session(env.project)
            self.assertIn("app.py", self._reviewed())


class PatternSemanticsTests(unittest.TestCase):
    CASES = [
        # (pattern, root-relative path, matches)
        ("secrets.yaml", "secrets.yaml", True),
        ("secrets.yaml", "a/b/secrets.yaml", True),      # slashless → any depth
        ("secrets.yaml", "SECRETS.YAML", True),          # case-insensitive, like Claude Code
        ("config/*.json", "config/a.json", True),
        ("config/*.json", "x/config/a.json", False),     # contains slash → anchored
        ("config/*.json", "config/sub/a.json", False),   # * does not cross /
        ("config/**", "config/sub/a.json", True),
        ("config/**", "docs/config/a.json", True),       # Claude Code strips /** → slashless
        ("/config/**", "docs/config/a.json", False),
        ("config", "config/sub/a.json", True),           # dir name covers contents
        ("/private", "private/x", True),
        ("/private", "docs/private/x", False),
        ("**/vault/*.json", "a/b/vault/k.json", True),
        ("**/vault/*.json", "vault/k.json", True),
        ("*.pem", "keys/a.PEM", True),
        ("id_?sa", "home/id_rsa", True),
        ("key[0-9]", "key7", True),
        ("key[!0-9]", "key7", False),
        (r"a\*b", "a*b", True),
        (r"a\*b", "axb", False),
        ("docs/", "docs/readme.md", True),
        ("!keep.json", "keep.json", False),              # negation never excludes
    ]

    def test_gitignore_style_matching(self):
        for pattern, path, expected in self.CASES:
            with self.subTest(pattern=pattern, path=path):
                rx = secretpaths._compile(pattern)
                self.assertEqual(bool(rx and rx.match(path)), expected)


class SubagentDisallowedToolsTests(unittest.TestCase):
    def test_rules_are_forwarded_with_absolute_anchors(self):
        settings = {"permissions": {
            "deny": ["Read(./config/**)", "Read(/private/**)", "Read(~/.ssh/**)",
                     "Read(//etc/shadow)", "Grep", "Bash(curl:*)", "Edit(**)"],
            "ask": ["Read(*.tfstate)"],
        }}
        with _Env(project_settings=settings) as env:
            tools = secretpaths.subagent_disallowed_tools(env.project)
            proj = env.project.strip("/")
            for expected in (*SHELL_TOOLS, "Read(./config/**)", f"Read(//{proj}/private/**)",
                             "Read(~/.ssh/**)", "Read(//etc/shadow)", "Grep",
                             "Read(*.tfstate)", "Read(.env)", "Read(id_rsa*)",
                             "Read(secrets.yaml)", "Read(credentials.json)"):
                self.assertIn(expected, tools)
            # Only read-path rules are forwarded; other tools' rules are not ours.
            self.assertFalse(any(t.startswith(("Bash(", "Edit")) for t in tools))
            # Sub-agent rooted at an alternate checkout: the verbatim relative
            # rule covers that root, the session cwd gets an absolute copy, and
            # the project-anchored rule is mirrored into the checkout.
            alt = os.path.join(env.root, "alt-checkout")
            elsewhere = secretpaths.subagent_disallowed_tools(alt)
            for expected in (f"Read(//{proj}/config/**)", f"Read(//{alt.strip('/')}/private/**)"):
                self.assertIn(expected, elsewhere)
                self.assertNotIn(expected, tools)

    def test_opt_out_drops_only_the_builtin_globs(self):
        with _Env(project_settings={"permissions": {"deny": ["Read(./config/**)"]}}) as env:
            os.environ["SG_SKIP_SECRET_FILES"] = "0"
            self.assertEqual(secretpaths.subagent_disallowed_tools(env.project),
                             SHELL_TOOLS + ["Read(./config/**)"])

    def test_diff_only_call_gets_no_file_or_shell_tools(self):
        self.assertEqual(secretpaths.no_file_tools(), SHELL_TOOLS + ["Read", "Grep", "Glob"])


class _FakeSDK(types.ModuleType):
    """Stand-in for claude_agent_sdk that records the options each query got."""

    def __init__(self):
        super().__init__("claude_agent_sdk")
        self.options_seen = []
        sdk = self

        class ClaudeAgentOptions:
            def __init__(self, **kwargs):
                self.__dict__.update(kwargs)
                sdk.options_seen.append(kwargs)

        class AssistantMessage:
            pass

        class ResultMessage:
            subtype = "success"
            structured_output = {"findings": []}
            usage = None
            total_cost_usd = None

        async def query(prompt, options):
            async for _ in prompt:
                pass
            yield ResultMessage()

        self.ClaudeAgentOptions = ClaudeAgentOptions
        self.AssistantMessage = AssistantMessage
        self.ResultMessage = ResultMessage
        self.query = query


class AgenticReviewWiringTests(unittest.TestCase):
    def test_agentic_review_passes_deny_rules_as_disallowed_tools(self):
        fake = _FakeSDK()
        saved = sys.modules.get("claude_agent_sdk")
        sys.modules["claude_agent_sdk"] = fake
        try:
            with _Env(project_settings={"permissions": {"deny": ["Read(./config/**)"]}}) as env:
                os.environ["SG_AGENTIC_CLI_PATH"] = os.path.join(env.root, "no-such-claude")
                llm.agentic_review(env.project, [("app.py", _diff("app.py"))], ["app.py"])
        finally:
            if saved is None:
                del sys.modules["claude_agent_sdk"]
            else:
                sys.modules["claude_agent_sdk"] = saved
        self.assertTrue(fake.options_seen, "agentic_review never built ClaudeAgentOptions")
        for opts in fake.options_seen:
            self.assertEqual(opts.get("setting_sources"), [])  # still no recursive plugins/hooks
            for expected in ("Bash", "Read(./config/**)", "Read(.env)"):
                self.assertIn(expected, opts.get("disallowed_tools", []))


if __name__ == "__main__":
    unittest.main()
