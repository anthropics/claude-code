"""Regression tests for agentic review prompt path handling."""
import os
import sys
import tempfile
import unittest


HOOKS_DIR = os.path.dirname(__file__)
if HOOKS_DIR not in sys.path:
    sys.path.insert(0, HOOKS_DIR)

import review_api


class ReviewPathNormalizationTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.repo_root = os.path.realpath(self.tmp.name)
        os.makedirs(os.path.join(self.repo_root, "TaxEngine"))
        with open(
            os.path.join(self.repo_root, "TaxEngine", "Package.swift"),
            "w",
            encoding="utf-8",
        ) as fixture:
            fixture.write("// fixture\n")

    def tearDown(self):
        self.tmp.cleanup()

    def test_relative_path_becomes_absolute(self):
        readable, missing = review_api.normalize_review_paths(
            self.repo_root, ["TaxEngine/Package.swift"]
        )

        self.assertEqual(
            readable,
            [os.path.join(self.repo_root, "TaxEngine", "Package.swift")],
        )
        self.assertEqual(missing, [])

    def test_foreign_absolute_path_is_excluded_and_flagged(self):
        readable, missing = review_api.normalize_review_paths(
            self.repo_root, ["/home/user/App/missing.py"]
        )

        self.assertEqual(readable, [])
        self.assertEqual(missing, ["/home/user/App/missing.py"])

    def test_root_anchored_repo_path_is_normalized_when_present(self):
        readable, missing = review_api.normalize_review_paths(
            self.repo_root, ["/TaxEngine/Package.swift"]
        )

        self.assertEqual(
            readable,
            [os.path.join(self.repo_root, "TaxEngine", "Package.swift")],
        )
        self.assertEqual(missing, [])

    def test_foreign_absolute_path_maps_by_existing_repo_suffix(self):
        readable, missing = review_api.normalize_review_paths(
            self.repo_root,
            ["/Users/other-dev/App/TaxEngine/Package.swift"],
        )

        self.assertEqual(
            readable,
            [os.path.join(self.repo_root, "TaxEngine", "Package.swift")],
        )
        self.assertEqual(missing, [])

    def test_prompt_contains_repo_root_and_guarded_paths(self):
        prompt = review_api.build_investigate_prompt(
            ["/TaxEngine/Package.swift", "/home/user/App/missing.py"],
            [("TaxEngine/Package.swift", "@@ -0,0 +1 @@\n+// fixture")],
            repo_root=self.repo_root,
        )

        expected = os.path.join(self.repo_root, "TaxEngine", "Package.swift")
        self.assertIn(f"Repository root: {self.repo_root}", prompt)
        self.assertIn(f"  - {expected}", prompt)
        self.assertIn(
            "  - /home/user/App/missing.py (not present in this checkout)",
            prompt,
        )
        readable_section = prompt.split(
            "Changed paths not present in this checkout", 1
        )[0]
        self.assertNotIn("  - /home/user/App/missing.py", readable_section)


class FindingsContractTest(unittest.TestCase):
    def test_prompt_requires_findings_array_for_zero_one_or_many_results(self):
        self.assertIn(
            "findings MUST always be a JSON array",
            review_api.AGENTIC_INVESTIGATE_SYSTEM,
        )
        findings_schema = review_api.FINDINGS_SCHEMA["properties"]["findings"]
        self.assertEqual(findings_schema["type"], "array")
        self.assertIn("Always a JSON array", findings_schema["description"])


if __name__ == "__main__":
    unittest.main()
