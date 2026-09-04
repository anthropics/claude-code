"""Tests for the security-patterns.json glob matcher in extensibility.py.

Run with: python3 test_extensibility.py  (or: python3 -m unittest test_extensibility)

Covers the two independent axes from
https://github.com/anthropics/claude-code/issues/86545 :
  (a) an absolute, in-project payload and a relative payload for the same
      file must produce the same include/exclude decision against a
      project-relative glob (path canonicalization).
  (b) ``**/`` must match zero path segments, not just one-or-more
      (depth semantics).
"""

import os
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from extensibility import _glob_match  # noqa: E402


class DepthSemantics(unittest.TestCase):
    """Axis (b): ``**`` matches any depth, including zero directories."""

    def test_double_star_matches_top_level_file(self):
        self.assertTrue(_glob_match("config.ts", ("**/*.ts",), ()))

    def test_double_star_matches_nested_file(self):
        self.assertTrue(_glob_match("src/a.ts", ("**/*.ts",), ()))

    def test_double_star_does_not_match_other_extension(self):
        self.assertFalse(_glob_match("config.py", ("**/*.ts",), ()))

    def test_mid_pattern_double_star_matches_zero_and_more_segments(self):
        self.assertTrue(_glob_match("utils/x.ts", ("utils/**/*.ts",), ()))
        self.assertTrue(_glob_match("utils/sub/x.ts", ("utils/**/*.ts",), ()))
        self.assertFalse(_glob_match("other/x.ts", ("utils/**/*.ts",), ()))

    def test_exclude_still_applies_on_top_of_double_star_include(self):
        self.assertTrue(_glob_match("config.ts", ("**/*.ts",), ("**/*.test.ts",)))
        self.assertFalse(
            _glob_match("config.test.ts", ("**/*.ts",), ("**/*.test.ts",))
        )


class PathCanonicalization(unittest.TestCase):
    """Axis (a): absolute in-project payloads and relative payloads for the
    same file must agree, for directory-anchored (non-``**``) globs."""

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = self._tmp.name
        os.makedirs(os.path.join(self.root, "src"), exist_ok=True)

    def tearDown(self):
        self._tmp.cleanup()

    def test_absolute_in_project_path_matches_directory_anchored_glob(self):
        abs_path = os.path.join(self.root, "src", "f.ts")
        self.assertTrue(_glob_match(abs_path, ("src/*.ts",), (), cwd=self.root))

    def test_relative_payload_for_same_file_gets_same_decision(self):
        rel_path = os.path.join("src", "f.ts")
        self.assertTrue(_glob_match(rel_path, ("src/*.ts",), (), cwd=self.root))

    def test_absolute_and_relative_payloads_agree(self):
        abs_path = os.path.join(self.root, "src", "f.ts")
        rel_path = os.path.join("src", "f.ts")
        include = ("src/*.ts",)
        self.assertEqual(
            _glob_match(abs_path, include, (), cwd=self.root),
            _glob_match(rel_path, include, (), cwd=self.root),
        )

    def test_double_star_and_directory_anchor_together_absolute(self):
        nested = os.path.join(self.root, "src", "sub", "f.ts")
        self.assertTrue(_glob_match(nested, ("src/**/*.ts",), (), cwd=self.root))

    def test_absolute_path_outside_project_root_is_not_forced_to_match(self):
        outside = os.path.join(tempfile.gettempdir(), "elsewhere", "src", "f.ts")
        # Not under self.root, so canonicalization is skipped and the glob
        # is compared against the path as delivered (normalized separators
        # only) rather than a guessed relative form.
        self.assertFalse(_glob_match(outside, ("src/*.ts",), (), cwd=self.root))

    def test_no_cwd_falls_back_to_matching_path_as_delivered(self):
        rel_path = os.path.join("src", "f.ts")
        self.assertTrue(_glob_match(rel_path, ("src/*.ts",), (), cwd=None))
        abs_path = os.path.join(self.root, "src", "f.ts")
        self.assertFalse(_glob_match(abs_path, ("src/*.ts",), (), cwd=None))


class CharacterClassFnmatchCompat(unittest.TestCase):
    """``[...]`` classes must keep fnmatch semantics: a leading ``!``
    negates (regex uses ``^``, which fnmatch gives no special meaning), and
    a ``]`` immediately after ``[`` or ``[!`` is a literal member, not the
    closing bracket. Each case is checked against real ``fnmatch`` so this
    stays pinned to the semantics the plugin's existing patterns were
    written against."""

    CASES = [
        ("[!t]*.ts", "t.ts"),
        ("[!t]*.ts", "x.ts"),
        ("[]t]*.ts", "]x.ts"),
        ("[]t]*.ts", "t.ts"),
        ("[]t]*.ts", "a.ts"),
        ("[![]*.ts", "[.ts"),
        ("[![]*.ts", "a.ts"),
        ("[a-z]*.ts", "a.ts"),
        ("[a-z]*.ts", "A.ts"),
        ("[^abc]*.ts", "^.ts"),
        ("[^abc]*.ts", "a.ts"),
        ("[!abc]*.ts", "a.ts"),
        ("[!abc]*.ts", "x.ts"),
    ]

    def test_matches_fnmatch_for_each_case(self):
        import fnmatch

        for pattern, path in self.CASES:
            with self.subTest(pattern=pattern, path=path):
                expected = fnmatch.fnmatch(path, pattern)
                actual = _glob_match(path, (pattern,), ())
                self.assertEqual(actual, expected)

    def test_negated_class_excludes_matching_file_from_security_rule(self):
        # The motivating case: a rule meant to cover every .ts file except
        # ones starting with 't' must not silently include t.ts.
        self.assertFalse(_glob_match("t.ts", ("**/[!t]*.ts",), ()))
        self.assertTrue(_glob_match("x.ts", ("**/[!t]*.ts",), ()))


class StarAndQuestionMarkStayRecursive(unittest.TestCase):
    """A bare ``*`` and ``?`` must keep crossing ``/`` exactly like
    ``fnmatch`` always did — that recursion is relied on by real deployed
    configs (see the #86545 thread) and is deliberately preserved. Only
    ``**/`` gets new (zero-depth) behavior fnmatch can't express; nothing
    about plain ``*``/``?`` should change."""

    CASES = [
        ("*.ts", "src/deep/f.ts"),
        ("src/*.ts", "src/deep/f.ts"),
        ("src/*.ts", "src/sub/deep/f.ts"),
        ("src/*", "src/deep/f.ts"),
        ("*/*.ts", "src/deep/f.ts"),
        ("a*b*c.ts", "aXbYc.ts"),
        ("a?c.ts", "abc.ts"),
    ]

    def test_matches_fnmatch_for_each_case(self):
        import fnmatch

        for pattern, path in self.CASES:
            with self.subTest(pattern=pattern, path=path):
                expected = fnmatch.fnmatch(path, pattern)
                actual = _glob_match(path, (pattern,), ())
                self.assertEqual(actual, expected)


class CaseSensitivity(unittest.TestCase):
    """fnmatch.fnmatch() case-normalizes via os.path.normcase, which
    lowercases on Windows and is a no-op elsewhere. Matching must follow
    the same split rather than being unconditionally case-sensitive."""

    def test_case_sensitive_on_posix(self):
        with mock.patch("extensibility.os.name", "posix"):
            self.assertFalse(_glob_match("FOO.TS", ("*.ts",), ()))

    def test_case_insensitive_on_windows(self):
        with mock.patch("extensibility.os.name", "nt"):
            self.assertTrue(_glob_match("FOO.TS", ("*.ts",), ()))


if __name__ == "__main__":
    unittest.main()
