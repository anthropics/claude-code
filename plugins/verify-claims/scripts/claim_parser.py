"""Parse and extract claims from Claude's responses."""

import re
from dataclasses import dataclass


@dataclass
class Claim:
    """A claim extracted from Claude's response."""
    claim_type: str
    claim_text: str
    confidence: float
    extracted_value: str | None = None  # e.g., file path for file_created


# Claim detection patterns with confidence weights
# Note: For file_created patterns, we search on original text to preserve paths
CLAIM_PATTERNS: dict[str, list[tuple[str, float]]] = {
    "file_created": [
        # High confidence - explicit creation statements
        (r"(?:I've |I have |I )?(?:created|wrote|added|generated) (?:a )?(?:new )?(?:the )?(?:file )?(?:called |named )?[`'\"]?([^\s`'\",:]+\.[a-zA-Z0-9]+)[`'\"]?", 0.9),
        (r"(?:created|wrote|written) (?:to )?(?:the )?(?:file )?[`'\"]?([^\s`'\",:]+\.[a-zA-Z0-9]+)[`'\"]?", 0.9),
        # Medium confidence - references to files being done
        (r"[`'\"]([^\s`'\"]+\.[a-zA-Z0-9]+)[`'\"]? (?:has been |is now )?(?:created|written|saved)", 0.8),
        (r"saved (?:the )?(?:changes )?(?:to )?[`'\"]?([^\s`'\"]+\.[a-zA-Z0-9]+)[`'\"]?", 0.7),
        # File written/created passively
        (r"file [`'\"]?([^\s`'\",:]+\.[a-zA-Z0-9]+)[`'\"]? (?:was |has been )?(?:created|written|saved)", 0.85),
    ],
    "tests_pass": [
        # High confidence - explicit pass statements
        (r"(?:all )?tests? (?:are )?(?:now )?pass(?:ing|ed)?", 0.9),
        (r"tests? (?:run |completed? )?successfully", 0.9),
        (r"all (?:\d+ )?tests? pass(?:ed)?", 0.95),
        # Medium confidence
        (r"tests? (?:should )?(?:now )?work", 0.7),
        (r"(?:the )?tests? (?:are )?(?:now )?green", 0.8),
    ],
    "lint_clean": [
        # High confidence
        (r"no (?:lint(?:ing)? )?(?:errors?|issues?|warnings?)", 0.9),
        (r"lint(?:ing)? (?:is )?(?:now )?(?:clean|passing|passes)", 0.9),
        (r"(?:all )?lint(?:ing)? (?:checks? )?pass(?:ed|ing)?", 0.9),
        # Medium confidence
        (r"code (?:is )?(?:now )?lint(?:-)?free", 0.8),
        (r"(?:eslint|ruff|pylint|clippy) (?:shows? )?no (?:errors?|issues?)", 0.85),
    ],
    "build_success": [
        # High confidence
        (r"build (?:succeeded|successful(?:ly)?|completed? (?:successfully)?|passes)", 0.9),
        (r"(?:compiled?|built) (?:successfully|without errors?)", 0.9),
        (r"(?:the )?(?:project|app|code) (?:now )?builds?(?: successfully)?", 0.85),
        # Medium confidence
        (r"(?:npm|yarn|cargo|make|gradle) (?:run )?build (?:succeeded|passed|completed)", 0.9),
        (r"no (?:build|compilation) errors?", 0.8),
    ],
    "bug_fixed": [
        # High confidence
        (r"(?:I've |I have |I )?(?:fixed|resolved|addressed|corrected) (?:the )?(?:bug|issue|problem|error)", 0.9),
        (r"(?:the )?(?:bug|issue|problem|error) (?:is )?(?:now )?(?:fixed|resolved|addressed|corrected)", 0.9),
        # Medium confidence
        (r"(?:bug|issue|problem) (?:should be )?(?:now )?(?:fixed|resolved)", 0.75),
        (r"(?:this )?(?:fix|change|update) (?:should )?(?:resolve|fix|address)", 0.7),
    ],
}


def parse_claims(text: str, confidence_threshold: float = 0.7) -> list[Claim]:
    """
    Parse text for claims that can be verified.

    Args:
        text: Text content from Claude's response
        confidence_threshold: Minimum confidence to include a claim

    Returns:
        List of Claim objects found in the text
    """
    claims = []

    for claim_type, patterns in CLAIM_PATTERNS.items():
        for pattern, confidence in patterns:
            if confidence < confidence_threshold:
                continue

            # For file_created, search on original text to preserve file path case
            # For other claims, use case-insensitive matching
            search_text = text if claim_type == "file_created" else text.lower()
            matches = re.finditer(pattern, search_text, re.IGNORECASE | re.MULTILINE)

            for match in matches:
                # Extract the matched claim text
                claim_text = match.group(0)

                # Extract any captured value (e.g., file path)
                extracted_value = None
                if match.groups():
                    extracted_value = match.group(1)

                # Avoid duplicate claims of the same type with same value
                existing = [c for c in claims if c.claim_type == claim_type]
                if claim_type == "file_created":
                    # For files, check if extracted value already captured
                    if extracted_value and any(c.extracted_value == extracted_value for c in existing):
                        continue
                else:
                    # For other claims, just check we don't have the same type already
                    if existing:
                        continue

                claims.append(Claim(
                    claim_type=claim_type,
                    claim_text=claim_text,
                    confidence=confidence,
                    extracted_value=extracted_value
                ))

    return claims


def extract_file_paths(text: str) -> list[str]:
    """
    Extract file paths mentioned in text.

    Args:
        text: Text to search for file paths

    Returns:
        List of file paths found
    """
    paths = []

    # Match paths in backticks or quotes
    quoted_patterns = [
        r'`([^\s`]+\.[a-zA-Z0-9]+)`',
        r'"([^\s"]+\.[a-zA-Z0-9]+)"',
        r"'([^\s']+\.[a-zA-Z0-9]+)'",
    ]

    for pattern in quoted_patterns:
        matches = re.findall(pattern, text)
        paths.extend(matches)

    # Match Unix-style paths
    unix_pattern = r'(?:^|[\s(])(/[^\s:,)]+\.[a-zA-Z0-9]+)'
    paths.extend(re.findall(unix_pattern, text))

    # Match relative paths
    relative_pattern = r'(?:^|[\s(])(\./[^\s:,)]+\.[a-zA-Z0-9]+)'
    paths.extend(re.findall(relative_pattern, text))

    # Remove duplicates while preserving order
    seen = set()
    unique_paths = []
    for path in paths:
        if path not in seen:
            seen.add(path)
            unique_paths.append(path)

    return unique_paths


def get_claim_summary(claims: list[Claim]) -> dict[str, list[str]]:
    """
    Summarize claims by type.

    Args:
        claims: List of Claim objects

    Returns:
        Dictionary mapping claim types to extracted values or claim texts
    """
    summary: dict[str, list[str]] = {}

    for claim in claims:
        if claim.claim_type not in summary:
            summary[claim.claim_type] = []

        value = claim.extracted_value or claim.claim_text
        if value not in summary[claim.claim_type]:
            summary[claim.claim_type].append(value)

    return summary
