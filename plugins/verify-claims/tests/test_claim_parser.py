"""Tests for claim_parser.py"""

from claim_parser import Claim, extract_file_paths, get_claim_summary, parse_claims


class TestParseClaims:
    """Tests for the parse_claims function."""

    def test_parse_file_created_claim(self):
        """Test parsing file creation claims."""
        text = "I've created the config.json file for you."
        claims = parse_claims(text, confidence_threshold=0.7)

        assert len(claims) >= 1
        file_claims = [c for c in claims if c.claim_type == "file_created"]
        assert len(file_claims) == 1
        assert file_claims[0].extracted_value == "config.json"

    def test_parse_file_created_with_path(self):
        """Test parsing file creation with full path."""
        text = "I wrote the file src/components/Button.tsx"
        claims = parse_claims(text, confidence_threshold=0.7)

        file_claims = [c for c in claims if c.claim_type == "file_created"]
        assert len(file_claims) == 1
        assert "Button.tsx" in file_claims[0].extracted_value

    def test_parse_tests_pass_claim(self):
        """Test parsing test passing claims."""
        text = "All tests pass now."
        claims = parse_claims(text, confidence_threshold=0.7)

        test_claims = [c for c in claims if c.claim_type == "tests_pass"]
        assert len(test_claims) == 1

    def test_parse_tests_pass_variations(self):
        """Test various ways of expressing tests passing."""
        test_cases = [
            "Tests are now passing",
            "All 42 tests passed",
            "The tests completed successfully",
            "Tests should now work",
        ]

        for text in test_cases:
            claims = parse_claims(text, confidence_threshold=0.7)
            test_claims = [c for c in claims if c.claim_type == "tests_pass"]
            assert len(test_claims) >= 1, f"Failed for: {text}"

    def test_parse_lint_clean_claim(self):
        """Test parsing lint clean claims."""
        text = "No lint errors found."
        claims = parse_claims(text, confidence_threshold=0.7)

        lint_claims = [c for c in claims if c.claim_type == "lint_clean"]
        assert len(lint_claims) == 1

    def test_parse_lint_clean_variations(self):
        """Test various ways of expressing lint clean."""
        test_cases = [
            "Linting is now clean",
            "No linting issues",
            "All lint checks pass",
            "ESLint shows no errors",
        ]

        for text in test_cases:
            claims = parse_claims(text, confidence_threshold=0.7)
            lint_claims = [c for c in claims if c.claim_type == "lint_clean"]
            assert len(lint_claims) >= 1, f"Failed for: {text}"

    def test_parse_build_success_claim(self):
        """Test parsing build success claims."""
        text = "Build succeeded."
        claims = parse_claims(text, confidence_threshold=0.7)

        build_claims = [c for c in claims if c.claim_type == "build_success"]
        assert len(build_claims) == 1

    def test_parse_build_success_variations(self):
        """Test various ways of expressing build success."""
        test_cases = [
            "The project builds successfully",
            "Build completed successfully",
            "Compiled without errors",
            "npm run build succeeded",
        ]

        for text in test_cases:
            claims = parse_claims(text, confidence_threshold=0.7)
            build_claims = [c for c in claims if c.claim_type == "build_success"]
            assert len(build_claims) >= 1, f"Failed for: {text}"

    def test_parse_bug_fixed_claim(self):
        """Test parsing bug fix claims."""
        text = "I've fixed the bug in the login handler."
        claims = parse_claims(text, confidence_threshold=0.7)

        fix_claims = [c for c in claims if c.claim_type == "bug_fixed"]
        assert len(fix_claims) == 1

    def test_parse_bug_fixed_variations(self):
        """Test various ways of expressing bug fixes."""
        test_cases = [
            "Fixed the issue",
            "The problem is now resolved",
            "I've addressed the error",
            "Bug is fixed",
        ]

        for text in test_cases:
            claims = parse_claims(text, confidence_threshold=0.7)
            fix_claims = [c for c in claims if c.claim_type == "bug_fixed"]
            assert len(fix_claims) >= 1, f"Failed for: {text}"

    def test_parse_multiple_claims(self):
        """Test parsing multiple claims in one text."""
        text = """
        I've created the config.json file.
        All tests pass now.
        The build succeeded.
        """
        claims = parse_claims(text, confidence_threshold=0.7)

        claim_types = {c.claim_type for c in claims}
        assert "file_created" in claim_types
        assert "tests_pass" in claim_types
        assert "build_success" in claim_types

    def test_no_claims_in_neutral_text(self):
        """Test that neutral text doesn't produce false positives."""
        text = "Let me explain how the configuration system works."
        claims = parse_claims(text, confidence_threshold=0.7)

        # Should not have file_created claim just because "config" is mentioned
        file_claims = [c for c in claims if c.claim_type == "file_created"]
        assert len(file_claims) == 0

    def test_confidence_threshold(self):
        """Test that confidence threshold filters low-confidence claims."""
        text = "Tests should now work."  # Lower confidence phrase

        # With low threshold, should match
        claims_low = parse_claims(text, confidence_threshold=0.5)
        test_claims_low = [c for c in claims_low if c.claim_type == "tests_pass"]

        # With high threshold, might not match
        claims_high = parse_claims(text, confidence_threshold=0.95)
        test_claims_high = [c for c in claims_high if c.claim_type == "tests_pass"]

        assert len(test_claims_low) >= len(test_claims_high)

    def test_duplicate_file_claims_deduplicated(self):
        """Test that duplicate file claims are deduplicated."""
        text = """
        I created config.json.
        The file config.json has been saved.
        """
        claims = parse_claims(text, confidence_threshold=0.7)

        file_claims = [c for c in claims if c.claim_type == "file_created"]
        file_values = [c.extracted_value for c in file_claims]
        # Should only have one entry for config.json
        assert file_values.count("config.json") == 1

    def test_preserve_file_path_case(self):
        """Test that file paths preserve their original case."""
        text = "I created MyComponent.tsx"
        claims = parse_claims(text, confidence_threshold=0.7)

        file_claims = [c for c in claims if c.claim_type == "file_created"]
        assert len(file_claims) >= 1
        # The file path should preserve case
        assert any("MyComponent.tsx" in (c.extracted_value or "") for c in file_claims)


class TestExtractFilePaths:
    """Tests for the extract_file_paths function."""

    def test_extract_backtick_paths(self):
        """Test extracting paths in backticks."""
        text = "The file `src/config.json` was updated."
        paths = extract_file_paths(text)
        assert "src/config.json" in paths

    def test_extract_quoted_paths(self):
        """Test extracting paths in quotes."""
        text = 'Created "src/utils/helper.ts" file.'
        paths = extract_file_paths(text)
        assert "src/utils/helper.ts" in paths

    def test_extract_unix_paths(self):
        """Test extracting Unix-style paths."""
        text = "Modified /usr/local/config.json"
        paths = extract_file_paths(text)
        assert "/usr/local/config.json" in paths

    def test_extract_relative_paths(self):
        """Test extracting relative paths."""
        text = "See ./src/index.ts for details."
        paths = extract_file_paths(text)
        assert "./src/index.ts" in paths

    def test_deduplicate_paths(self):
        """Test that duplicate paths are deduplicated."""
        text = "`config.json` and `config.json` again"
        paths = extract_file_paths(text)
        assert paths.count("config.json") == 1


class TestGetClaimSummary:
    """Tests for the get_claim_summary function."""

    def test_summarize_claims(self):
        """Test summarizing claims by type."""
        claims = [
            Claim("file_created", "created config.json", 0.9, "config.json"),
            Claim("file_created", "wrote utils.ts", 0.9, "utils.ts"),
            Claim("tests_pass", "all tests pass", 0.9),
        ]
        summary = get_claim_summary(claims)

        assert "file_created" in summary
        assert len(summary["file_created"]) == 2
        assert "config.json" in summary["file_created"]
        assert "utils.ts" in summary["file_created"]
        assert "tests_pass" in summary

    def test_empty_claims(self):
        """Test summary with no claims."""
        summary = get_claim_summary([])
        assert summary == {}
